/**
 * One walk, from Start to the report, as a state machine.
 *
 * It is driven by a one-second `tick()` and takes everything with a side effect
 * (the network, the vibration motor, the GPS, the battery, the clock) through
 * `Deps`, so the whole lifecycle runs under `node --test` with a fake pod. The
 * thin React Native wrapper in `session.ts` only supplies the real ones.
 *
 * It lives outside any screen on purpose. The farmer can switch tab, or open a
 * report, in the middle of a walk, and GPS tracking and polling must not stop
 * because a screen unmounted.
 *
 * Phases:
 *
 *   running    the pod is starting or scanning, as `status.state` says
 *   stopping   Stop was tapped; waiting for the pod to finish ("Finishing...")
 *   fetching   the pod says done; pulling the report
 *   report     the report is on the phone and ready to open
 *   lost       the pod stopped reporting a scan this phone believed in
 *   failed     the pod reported an error, or the report could not be fetched
 */

import { TrackQueue, freshAlerts, highestAlertId } from './logic.ts';
import type { ScanStatus, TrackFix } from './logic.ts';
import { tr } from '../i18n/tr.ts';

export type Phase = 'idle' | 'running' | 'stopping' | 'fetching' | 'report' | 'lost' | 'failed';

/** Whether phone location is being read: on, refused by the farmer, or off in settings. */
export type LocationNote = 'on' | 'denied' | 'off';

export type Session = {
  phase: Phase;
  scanId: string | null;
  /** What the farmer picked, shown until the pod's own status says it. */
  fieldId: string | null;
  crop: string | null;
  replay: boolean;
  status: ScanStatus | null;
  /** When the last status poll succeeded; null before the first. */
  statusAtMs: number | null;
  nowMs: number;
  batteryLevel: number | null;
  location: LocationNote;
  /** Why Stop did not go through, so the button can say so and be tapped again. */
  stopError: string | null;
  /** Why the walk ended badly, or why the report could not be fetched. */
  error: string | null;
  advisoryId: string | null;
};

export type Deps = {
  now(): number;
  getStatus(): Promise<ScanStatus>;
  postTrack(scanId: string, fixes: TrackFix[]): Promise<void>;
  stopScan(scanId: string): Promise<void>;
  pullAdvisory(advisoryId: string): Promise<{ advisoryId: string; valid: boolean }>;
  /** Buzz the phone `count` times. */
  vibrate(count: number): void;
  readBattery(): Promise<number | null>;
  /** Starts reading the phone's position; resolves once it is running or refused. */
  watchLocation(onFix: (fix: TrackFix) => void): Promise<{ stop(): void; note: LocationNote }>;
  keepAwake(on: boolean): void;
  sleep(ms: number): Promise<void>;
};

/** Consecutive "idle" answers before the phone decides the scan is gone. */
export const LOST_AFTER_IDLE_POLLS = 5;

/** Report fetch attempts: the link is the thing most likely to be shaky here. */
const REPORT_ATTEMPTS = 3;
const REPORT_RETRY_MS = 2000;

/** How long Stop waits for the last positions to go out before stopping anyway. */
const FINAL_FLUSH_MS = 2500;

const ACTIVE: readonly Phase[] = ['running', 'stopping'];

const EMPTY = (now: number): Session => ({
  phase: 'idle',
  scanId: null,
  fieldId: null,
  crop: null,
  replay: false,
  status: null,
  statusAtMs: null,
  nowMs: now,
  batteryLevel: null,
  location: 'on',
  stopError: null,
  error: null,
  advisoryId: null,
});

export class ScanSessionCore {
  private state: Session;
  private listeners = new Set<() => void>();
  private queue = new TrackQueue();
  private ticks = 0;
  private polling = false;
  private idlePolls = 0;
  private lastAlertId = 0;
  private tracker: { stop(): void } | null = null;
  private trackerStarting = false;
  private fetching = false;
  private readonly deps: Deps;

  // No `private deps` parameter property: Node's type stripping, which runs the
  // tests, does not support them.
  constructor(deps: Deps) {
    this.deps = deps;
    this.state = EMPTY(deps.now());
  }

  // ---- Observation --------------------------------------------------------

  getState = (): Session => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<Session>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  get active(): boolean {
    return ACTIVE.includes(this.state.phase);
  }

  // ---- Beginning and ending ----------------------------------------------

  /** A scan this phone has just started. */
  begin(info: { scanId: string; fieldId: string; crop: string; replay: boolean }): void {
    this.reset();
    this.lastAlertId = 0;
    this.set({
      phase: 'running',
      scanId: info.scanId,
      fieldId: info.fieldId,
      crop: info.crop,
      replay: info.replay,
      nowMs: this.deps.now(),
    });
    this.deps.keepAwake(true);
    void this.startTracking();
  }

  /**
   * A scan that was already running when the app opened (it was closed, or the
   * phone restarted, mid-walk). Alerts raised before now do not buzz: the farmer
   * was not there for them, and a burst of old ones is noise.
   */
  attach(status: ScanStatus): void {
    if (!status.scan_id) return;
    this.reset();
    this.lastAlertId = highestAlertId(status.alerts);
    const finishing = status.state === 'finalizing' || status.state === 'done';
    this.set({
      phase: finishing ? 'stopping' : 'running',
      scanId: status.scan_id,
      fieldId: status.field_id ?? null,
      crop: status.crop ?? null,
      replay: status.replay === true,
      status,
      statusAtMs: this.deps.now(),
      nowMs: this.deps.now(),
    });
    this.deps.keepAwake(true);
    if (!finishing) void this.startTracking();
    if (status.state === 'done' || status.state === 'error') void this.applyStatus(status);
  }

  /** Forget the walk: after its report was opened, or the farmer closed a failure. */
  dismiss(): void {
    this.reset();
    this.set({ ...EMPTY(this.deps.now()) });
    this.deps.keepAwake(false);
  }

  private reset(): void {
    this.stopTracking();
    this.queue = new TrackQueue();
    this.ticks = 0;
    this.idlePolls = 0;
    this.polling = false;
    this.fetching = false;
  }

  // ---- The one-second heartbeat ------------------------------------------

  async tick(): Promise<void> {
    const nowMs = this.deps.now();
    if (this.state.phase === 'idle') return;
    this.ticks++;
    this.set({ nowMs });
    if (!this.active) return;
    const work: Promise<unknown>[] = [this.poll()];
    // Positions go out about every 5 s; the first battery read is immediate.
    if (this.ticks % 5 === 0) work.push(this.flushTrack());
    if (this.ticks % 15 === 1) work.push(this.readBattery());
    await Promise.all(work);
  }

  // ---- Status -------------------------------------------------------------

  private async poll(): Promise<void> {
    // One poll in flight at a time: a slow one must not queue others behind it.
    if (this.polling) return;
    this.polling = true;
    const scanId = this.state.scanId;
    try {
      const status = await this.deps.getStatus();
      // The walk ended or was replaced while this was in flight.
      if (this.state.scanId !== scanId || !this.active) return;
      this.set({ statusAtMs: this.deps.now() });
      await this.applyStatus(status);
    } catch {
      // Unreachable. Nothing to do but let `statusAtMs` age: after 6 s the
      // screen says the phone is too far from the pod.
    } finally {
      this.polling = false;
    }
  }

  private async applyStatus(status: ScanStatus): Promise<void> {
    // A status for some other scan (the pod's last one, say) says nothing about
    // this one. The pod did answer, so the link is fine.
    if (status.scan_id && this.state.scanId && status.scan_id !== this.state.scanId) return;

    // Alerts first, whatever else the status says.
    const { fresh, lastSeenId } = freshAlerts(status.alerts, this.lastAlertId);
    this.lastAlertId = lastSeenId;
    if (fresh.length > 0) this.deps.vibrate(fresh.length);

    if (status.state === 'idle') {
      this.idlePolls++;
      if (this.idlePolls >= LOST_AFTER_IDLE_POLLS) {
        this.stopTracking();
        this.set({ status, phase: 'lost' });
        this.deps.keepAwake(false);
      }
      return;
    }
    this.idlePolls = 0;

    if (status.state === 'finalizing') this.stopTracking();

    this.set({ status });

    if (status.state === 'done' || (status.state === 'error' && status.advisory_id)) {
      await this.fetchReport(status.advisory_id ?? null);
    } else if (status.state === 'error') {
      this.stopTracking();
      this.set({
        phase: 'failed',
        error: tr('The pod stopped this scan because of a problem, and no report was made. Check the pod, then start again.'),
      });
      this.deps.keepAwake(false);
    }
  }

  // ---- The report ---------------------------------------------------------

  private async fetchReport(advisoryId: string | null): Promise<void> {
    if (this.fetching) return;
    if (!advisoryId) {
      this.stopTracking();
      this.set({
        phase: 'failed',
        error: tr('The pod finished but did not name a report. Open the Pod tab and pull from the pod to get it.'),
      });
      this.deps.keepAwake(false);
      return;
    }
    this.fetching = true;
    this.stopTracking();
    this.set({ phase: 'fetching', advisoryId, error: null });
    let lastError = '';
    for (let attempt = 0; attempt < REPORT_ATTEMPTS; attempt++) {
      try {
        const stored = await this.deps.pullAdvisory(advisoryId);
        this.fetching = false;
        this.set({ phase: 'report', advisoryId: stored.advisoryId });
        this.deps.keepAwake(false);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < REPORT_ATTEMPTS - 1) await this.deps.sleep(REPORT_RETRY_MS);
      }
    }
    this.fetching = false;
    this.set({ phase: 'failed', advisoryId, error: lastError });
    this.deps.keepAwake(false);
  }

  /** Try the report again after a failure to fetch it. */
  async retryReport(): Promise<void> {
    if (this.state.phase !== 'failed' || !this.state.advisoryId) return;
    await this.fetchReport(this.state.advisoryId);
  }

  // ---- Stop ---------------------------------------------------------------

  async requestStop(): Promise<void> {
    const { phase, scanId } = this.state;
    if (phase !== 'running' || !scanId) return;
    this.set({ phase: 'stopping', stopError: null });
    this.stopTracking();

    // Last positions out before the pod closes the walk. Best effort: a pod that
    // cannot be reached for this must not hold up Stop.
    await Promise.race([this.flushTrack(), this.deps.sleep(FINAL_FLUSH_MS)]);

    try {
      await this.deps.stopScan(scanId);
    } catch (err) {
      // The pod never got it, so it is still scanning. Back to running, with the
      // reason, so the farmer can try again from where the pod can hear them.
      if (this.state.phase === 'stopping') {
        this.set({
          phase: 'running',
          stopError: err instanceof Error ? err.message : String(err),
        });
        void this.startTracking();
      }
    }
  }

  // ---- Phone location -----------------------------------------------------

  private async startTracking(): Promise<void> {
    if (this.tracker || this.trackerStarting) return;
    this.trackerStarting = true;
    try {
      const handle = await this.deps.watchLocation((fix) => this.queue.push(fix));
      // The walk may have ended, or Stop been tapped, while permission was being asked.
      if (this.state.phase !== 'running' || this.state.status?.state === 'finalizing') {
        handle.stop();
      } else {
        this.tracker = handle;
      }
      this.set({ location: handle.note });
    } catch {
      this.set({ location: 'off' });
    } finally {
      this.trackerStarting = false;
    }
  }

  private stopTracking(): void {
    this.tracker?.stop();
    this.tracker = null;
  }

  private async flushTrack(): Promise<void> {
    const scanId = this.state.scanId;
    if (!scanId || this.queue.size === 0) return;
    await this.queue.flush((batch) => this.deps.postTrack(scanId, batch));
  }

  // ---- Battery ------------------------------------------------------------

  private async readBattery(): Promise<void> {
    try {
      const level = await this.deps.readBattery();
      this.set({ batteryLevel: level });
    } catch {
      // No reading is no warning.
    }
  }
}
