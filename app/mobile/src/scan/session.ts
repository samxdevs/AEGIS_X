/**
 * The walk in progress, wired to the real phone.
 *
 * `session-core.ts` holds the logic and runs under node with a fake pod; this
 * file only supplies the real pod endpoints, vibration motor, GPS, battery and
 * wake lock, and runs the one-second heartbeat. One session exists for the whole
 * app, so a walk keeps going if the farmer changes tab or opens a report.
 *
 * Foreground only, as agreed: the screen is kept awake for the walk, so the GPS
 * and the polling are not left to an Android background service.
 */

import { useSyncExternalStore } from 'react';
import { Vibration } from 'react-native';
import * as Battery from 'expo-battery';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';

import { getScanStatus, postTrack, pullWalkAdvisory, stopScan } from './api.ts';
import { toTrackFix } from './logic.ts';
import type { ScanStatus } from './logic.ts';
import { ScanSessionCore } from './session-core.ts';
import type { Session } from './session-core.ts';

export type { Session } from './session-core.ts';

const KEEP_AWAKE_TAG = 'aegis-scan';

/** A fix about every 2 s while walking. */
const LOCATION_INTERVAL_MS = 2000;

/** One buzz is ~0.5 s; several new alerts in one poll buzz that many times, up to three. */
function vibrate(count: number): void {
  const buzzes = Math.min(Math.max(count, 1), 3);
  const pattern: number[] = [0];
  for (let i = 0; i < buzzes; i++) pattern.push(500, 250);
  Vibration.vibrate(pattern);
}

const core = new ScanSessionCore({
  now: () => Date.now(),
  getStatus: getScanStatus,
  postTrack,
  stopScan,
  pullAdvisory: pullWalkAdvisory,
  vibrate,
  async readBattery() {
    const level = await Battery.getBatteryLevelAsync();
    return Number.isFinite(level) ? level : null;
  },
  async watchLocation(onFix) {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { stop() {}, note: 'denied' };
    if (!(await Location.hasServicesEnabledAsync())) return { stop() {}, note: 'off' };
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: 0,
      },
      (location) => {
        const fix = toTrackFix(location.coords, location.timestamp);
        if (fix) onFix(fix);
      },
    );
    return { stop: () => subscription.remove(), note: 'on' };
  },
  keepAwake(on) {
    try {
      if (on) void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      else void deactivateKeepAwake(KEEP_AWAKE_TAG).catch?.(() => {});
    } catch {
      // A phone that will not hold the screen awake still walks the field.
    }
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

// ---- Heartbeat --------------------------------------------------------------

let heartbeat: ReturnType<typeof setInterval> | null = null;

const BEATING = ['running', 'stopping', 'fetching'];

function beat(): void {
  if (heartbeat === null) heartbeat = setInterval(() => void core.tick(), 1000);
}

// The heartbeat stops itself once the walk is over, so an idle app does nothing.
core.subscribe(() => {
  if (heartbeat !== null && !BEATING.includes(core.getState().phase)) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
});

// ---- What the screens call --------------------------------------------------

/** The session as React state: re-renders on every change, including each second. */
export function useScanSession(): Session {
  return useSyncExternalStore(core.subscribe, core.getState, core.getState);
}

/**
 * Asks for phone location now, while the farmer is looking at the Start sheet,
 * so the system dialog does not appear over the live screen a moment later.
 * The answer does not block the scan: a refusal only means no phone positions.
 */
export async function askForLocation(): Promise<void> {
  try {
    await Location.requestForegroundPermissionsAsync();
  } catch {
    // Reported on the live screen if it matters.
  }
}

export function beginWalk(info: { scanId: string; fieldId: string; crop: string; replay: boolean }): void {
  core.begin(info);
  beat();
}

/** Picks up a scan the pod is already running. True when there was one. */
export async function joinRunningWalk(): Promise<boolean> {
  if (core.getState().phase !== 'idle') return true;
  let status: ScanStatus;
  try {
    status = await getScanStatus();
  } catch {
    return false;
  }
  if (!status.scan_id || !['starting', 'scanning', 'finalizing'].includes(status.state)) return false;
  core.attach(status);
  beat();
  return true;
}

export const stopWalk = (): Promise<void> => core.requestStop();

export function retryReport(): void {
  beat();
  void core.retryReport();
}

export const dismissWalk = (): void => core.dismiss();
