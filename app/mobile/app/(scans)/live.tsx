/**
 * The live scanning screen: the farmer is walking, the pod is scanning.
 *
 * Read at arm's length, in sun, one-handed. So: what the pod camera sees with a
 * Capture button under the thumb, one big timer, three big counts, warnings as
 * banners that cannot be missed, and a Stop button the size of the thumb that
 * presses it. The walk itself does not live here. It lives in
 * `scan/session.ts`, so leaving this screen does not stop anything, and Home
 * brings the farmer back to it.
 *
 * Nothing on this screen is a diagnosis. An alert says "possible" and "check
 * this plant by eye", in those words, always.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  appWarnings,
  displayElapsed,
  formatTimer,
  podWarningText,
} from '../../src/scan/logic.ts';
import type { ScanAlert } from '../../src/scan/logic.ts';
import { formatClock, inSentence } from '../../src/scan/report.ts';
import { dismissWalk, retryReport, stopWalk, useScanSession } from '../../src/scan/session.ts';
import { describeClass } from '../../src/schema/classes.ts';
import { StatusChip, TONE } from '../../src/ui/components.tsx';
import type { Tone } from '../../src/ui/components.tsx';
import { ConfirmDialog } from '../../src/ui/confirm.tsx';
import { PodCamera } from '../../src/ui/pod-camera.tsx';
import { useBarClearance } from '../../src/ui/floating-bar.ts';
import { useStatusBarStyle } from '../../src/ui/status-bar.ts';
import { color, radius, shadow, space, type, themed } from '../../src/ui/theme.ts';
import { useLanguage } from '../../src/i18n/language.tsx';
import { msg, tr } from '../../src/i18n/tr.ts';

const CROP_LABEL: Record<string, string> = {
  wheat: msg('Wheat'),
  rice: msg('Rice'),
  sugarcane: msg('Sugarcane'),
};

/** How many alert cards show; the pod's list is the last 20. */
const ALERT_CARDS = 3;

export default function LiveScreen() {
  const session = useScanSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [stopping, setStopping] = useState(false);
  // Set once this screen has sent the farmer somewhere else, so the walk being
  // cleared afterwards does not also send them home.
  const leaving = useRef(false);
  useStatusBarStyle('light');
  const clearance = useBarClearance();
  useLanguage();

  const { phase, status } = session;

  // The report is on the phone: open it, and let this walk go.
  useEffect(() => {
    if (phase === 'report' && session.advisoryId && !leaving.current) {
      leaving.current = true;
      const id = session.advisoryId;
      dismissWalk();
      router.replace({ pathname: '/advisory/[id]', params: { id } });
    }
  }, [phase, session.advisoryId, router]);

  // Nothing to show: no walk here (opened by a stale link, or already closed).
  useEffect(() => {
    if (phase === 'idle' && !leaving.current) {
      leaving.current = true;
      router.replace('/');
    }
  }, [phase, router]);

  const warnings = appWarnings({
    nowMs: session.nowMs,
    lastStatusAtMs: session.statusAtMs,
    batteryLevel: session.batteryLevel,
  });
  const podWarnings = status?.warnings ?? [];

  const elapsed = displayElapsed(
    status?.elapsed_s,
    session.statusAtMs,
    session.nowMs,
    status?.max_duration_s,
  );
  const counts = status?.counts ?? {};
  const alerts = [...(status?.alerts ?? [])].sort((a, b) => b.alert_id - a.alert_id);

  const finishing = phase === 'stopping' || phase === 'fetching' || status?.state === 'finalizing';
  const starting = status?.state === 'starting' || (status === null && phase === 'running');
  const ended = phase === 'lost' || phase === 'failed';

  const field = status?.field_id ?? session.fieldId;
  const crop = status?.crop ?? session.crop;
  const replay = status?.replay ?? session.replay;
  const maxMinutes = status?.max_duration_s ? Math.round(status.max_duration_s / 60) : null;

  const stop = async () => {
    setConfirming(false);
    setStopping(true);
    await stopWalk();
    setStopping(false);
  };

  const close = () => {
    leaving.current = true;
    dismissWalk();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Who and what is being walked. */}
        <View style={s.headRow}>
          <Text style={[type.title, { color: color.foreground, flex: 1 }]}>
            {[field ? tr('Field {id}', { id: field }) : null, crop ? tr(CROP_LABEL[crop] ?? crop) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {replay ? <StatusChip label={tr('REPLAY')} tone="unknown" /> : null}
        </View>

        {/* Warnings first, because they are what changes what the farmer does. */}
        {warnings.map((w) => (
          <Banner key={w.key} tone={w.key === 'pod_far' ? 'bad' : 'warn'} text={w.text} />
        ))}
        {podWarnings.map((w) => (
          <Banner key={w.code} tone="warn" text={podWarningText(w.code)} />
        ))}
        {session.stopError ? <Banner tone="bad" text={session.stopError} /> : null}

        {ended ? (
          <Ended
            lost={phase === 'lost'}
            message={session.error}
            canRetry={phase === 'failed' && !!session.advisoryId}
            onRetry={retryReport}
            onClose={close}
          />
        ) : (
          <>
            {/* What the pod sees, and Capture. Gone once the walk is finishing:
                the camera stops then, and a frozen picture would mislead. */}
            {session.scanId && !finishing ? (
              <PodCamera scanId={session.scanId} canCapture={status?.state === 'scanning'} />
            ) : null}

            {/* The timer. The one big number. */}
            <View style={s.timerCard}>
              <Text style={[type.micro, { color: color.fgSubtle }]}>
                {finishing ? tr('FINISHING') : tr('TIME SCANNING')}
              </Text>
              {finishing ? (
                <View style={s.finishing}>
                  <ActivityIndicator color={color.primary} size="large" />
                  <Text style={[type.title, { color: color.foreground, marginTop: space.md }]}>
                    {tr('Finishing…')}
                  </Text>
                  <Text style={[type.small, { color: color.mutedForeground, marginTop: 4, textAlign: 'center' }]}>
                    {tr('The pod is saving your walk and making the report. This takes a few seconds. Stay near the pod.')}
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={s.timer}
                    accessibilityLabel={elapsed === null ? undefined : formatTimer(elapsed)}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {elapsed === null ? '0:00' : formatTimer(elapsed)}
                  </Text>
                  <Text style={[type.small, { color: color.mutedForeground, textAlign: 'center' }]}>
                    {starting
                      ? tr('Starting. The pod is collecting readings from the field station.')
                      : maxMinutes
                        ? tr('The pod stops by itself after {m} minutes.', { m: maxMinutes })
                        : ''}
                  </Text>
                </>
              )}
            </View>

            {/* Stretches, and how they are going. */}
            <View style={s.countsCard}>
              <Text style={[type.micro, { color: color.fgSubtle }]}>{tr('STRETCHES CHECKED')}</Text>
              <Text style={[type.hero, { color: color.foreground, marginTop: 4 }]}>
                {String(counts.stretches ?? 0)}
              </Text>
              <View style={s.triple}>
                <Count value={counts.healthy ?? 0} label={tr('Healthy')} tone="good" />
                <Count value={counts.need_look ?? 0} label={tr('Need a look')} tone="bad" />
                <Count value={counts.unclear ?? 0} label={tr('Unclear')} tone="warn" />
              </View>
            </View>

            <View style={s.pair}>
              <View style={[s.smallCard, { flex: 1 }]}>
                <Text style={[type.micro, { color: color.fgSubtle }]}>{tr('LEAF TEMPERATURE')}</Text>
                <Text style={[type.value, { color: color.foreground, marginTop: 6 }]}>
                  {typeof status?.thermal_c_latest === 'number'
                    ? `${status.thermal_c_latest.toFixed(1)} °C`
                    : replay
                      ? tr('Not used in a replay')
                      : status
                        ? tr('No reading')
                        : tr('Waiting')}
                </Text>
              </View>
              <View style={[s.smallCard, { flex: 1 }]}>
                <Text style={[type.micro, { color: color.fgSubtle }]}>{tr('FIELD STATION')}</Text>
                <FieldStation reachable={status?.field_station?.reachable} readings={status?.field_station?.readings_collected} />
              </View>
            </View>

            {/* Possible diseases, newest first. */}
            {alerts.length > 0 ? (
              <View style={{ marginTop: space.sm }}>
                <Text style={[type.micro, { color: color.fgSubtle, marginBottom: space.sm }]}>
                  {tr('ALERTS')}
                </Text>
                {alerts.slice(0, ALERT_CARDS).map((a) => (
                  <AlertCard key={a.alert_id} alert={a} />
                ))}
                {alerts.length > ALERT_CARDS ? (
                  <Text style={[type.small, { color: color.fgSubtle }]}>
                    {tr('{n} earlier alerts. They are all in the report.', { n: alerts.length - ALERT_CARDS })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {session.location !== 'on' ? (
              <Text style={[type.small, { color: color.fgSubtle, marginTop: space.md }]}>
                {session.location === 'denied'
                  ? tr("Phone location is not allowed for this app. Positions will come from the pod's GPS if it has a fix.")
                  : tr("Phone location is switched off. Positions will come from the pod's GPS if it has a fix.")}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* The Stop bar. Out of the scroll, so it is always under the thumb. */}
      {!ended ? (
        <View style={[s.stopBar, { paddingBottom: clearance }]}>
          <Pressable
            onPress={() => setConfirming(true)}
            disabled={finishing || stopping}
            accessibilityRole="button"
            accessibilityLabel={tr('Stop scan')}
            style={({ pressed }) => [s.stop, (finishing || stopping) && s.stopOff, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.stopText}>{finishing ? tr('Finishing…') : tr('STOP')}</Text>
          </Pressable>
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirming}
        title={tr('Stop the scan?')}
        body={tr('The pod will finish and make your report. This takes a few seconds.')}
        confirmLabel={tr('Stop scan')}
        cancelLabel={tr('Keep scanning')}
        onConfirm={() => void stop()}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

// ---- Pieces ---------------------------------------------------------------

function Banner({ tone, text }: { tone: Tone; text: string }) {
  const t = TONE[tone];
  return (
    <View
      accessibilityRole="alert"
      style={[s.banner, { borderColor: t.border, backgroundColor: t.bg }]}
    >
      <Text style={[type.label, { color: t.fg, lineHeight: 20 }]}>{text}</Text>
    </View>
  );
}

function Count({ value, label, tone }: { value: number; label: string; tone: Tone }) {
  const t = TONE[tone];
  return (
    <View style={[s.count, { borderColor: t.border, backgroundColor: t.bg }]}>
      <Text style={[type.stat, { color: t.fg }]}>{String(value)}</Text>
      <Text style={[type.small, { color: t.fg, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function FieldStation({ reachable, readings }: { reachable: boolean | undefined; readings: number | undefined }) {
  if (reachable === undefined) {
    return <Text style={[type.value, { color: color.foreground, marginTop: 6 }]}>{tr('Checking')}</Text>;
  }
  return (
    <>
      <Text style={[type.value, { color: reachable ? color.secondaryForeground : color.destructive, marginTop: 6 }]}>
        {reachable ? `✓ ${tr('Reachable')}` : `✗ ${tr('Not reachable')}`}
      </Text>
      {reachable && typeof readings === 'number' ? (
        <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
          {tr('{n} readings', { n: readings })}
        </Text>
      ) : null}
    </>
  );
}

function AlertCard({ alert }: { alert: ScanAlert }) {
  const info = describeClass(alert.class);
  // "Possible brown (leaf) rust": the condition in running text, not a title.
  const disease = inSentence(info.condition);
  return (
    <View style={s.alert}>
      <Text style={[type.cardTitle, { color: color.destructive, fontSize: 17, lineHeight: 23 }]}>
        {tr('Possible {disease}. Check this plant by eye.', { disease })}
      </Text>
      <Text style={[type.small, { color: color.mutedForeground, marginTop: 4 }]}>
        {[
          formatClock(alert.utc),
          alert.frames_agreeing === 1
            ? tr('1 frame agreeing')
            : tr('{n} frames agreeing', { n: alert.frames_agreeing }),
        ].join(' · ')}
      </Text>
    </View>
  );
}

function Ended({
  lost,
  message,
  canRetry,
  onRetry,
  onClose,
}: {
  lost: boolean;
  message: string | null;
  canRetry: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const t = TONE[lost ? 'warn' : 'bad'];
  return (
    <View style={[s.endedCard, { borderColor: t.border, backgroundColor: t.bg }]}>
      <Text style={[type.title, { color: t.fg }]}>
        {lost ? tr('The pod is no longer scanning') : canRetry ? tr('Could not get the report') : tr('The scan stopped')}
      </Text>
      <Text style={[type.body, { color: t.fg, marginTop: space.sm }]}>
        {lost
          ? tr('The pod stopped answering as scanning. If it lost power, it will make a report of the walk when it next starts. Pull from the pod on the Pod tab to get it.')
          : (message ?? '')}
      </Text>
      {canRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => [s.endBtn, pressed && { opacity: 0.8 }]}>
          <Text style={[type.label, { color: color.primaryForeground }]}>{tr('Try again')}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [s.endBtn, s.endBtnQuiet, pressed && { opacity: 0.8 }]}>
        <Text style={[type.label, { color: color.secondaryForeground }]}>{tr('Close')}</Text>
      </Pressable>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  banner: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  timerCard: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginTop: space.xs,
    marginBottom: space.md,
    alignItems: 'center',
    ...shadow.card,
  },
  timer: {
    fontFamily: 'SourceCodePro_600SemiBold',
    fontSize: 68,
    lineHeight: 76,
    color: color.foreground,
    letterSpacing: -2,
    marginTop: space.xs,
  },
  finishing: { alignItems: 'center', paddingVertical: space.xl },
  countsCard: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginBottom: space.md,
    ...shadow.card,
  },
  triple: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  count: { flex: 1, borderWidth: 1, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.sm, alignItems: 'center' },
  pair: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  smallCard: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    ...shadow.card,
  },
  alert: {
    backgroundColor: color.destructiveMuted,
    borderColor: color.destructiveBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.lg,
    marginBottom: space.sm,
  },
  endedCard: { borderWidth: 1, borderRadius: radius.xl, padding: space.lg, marginTop: space.md },
  endBtn: {
    marginTop: space.lg,
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtnQuiet: { backgroundColor: color.secondary, borderWidth: 1, borderColor: color.accent },
  stopBar: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.background,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  stop: {
    minHeight: 72,
    borderRadius: radius.xxl,
    backgroundColor: color.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopOff: { opacity: 0.45 },
  stopText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    letterSpacing: 3,
    color: color.destructiveForeground,
  },
}));
