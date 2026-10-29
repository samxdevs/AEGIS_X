/**
 * The top of Home: is the pod ready, and the one button that starts a walk.
 *
 * It also stands in for the live screen when the farmer is somewhere else while
 * a walk is under way, finishing or done, so a walk is never something that can
 * only be reached by remembering where it was.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { usePodLink } from '../scan/health.ts';
import { displayElapsed, formatTimer } from '../scan/logic.ts';
import { dismissWalk, joinRunningWalk, useScanSession } from '../scan/session.ts';
import { StatusChip } from './components.tsx';
import { StartScanSheet } from './start-scan-sheet.tsx';
import { color, radius, shadow, space, type, themed } from './theme.ts';
import { tr } from '../i18n/tr.ts';

export function ScanPanel() {
  const link = usePodLink();
  const session = useScanSession();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [joining, setJoining] = useState(false);

  const openLive = () => router.push('/live');

  // A scan the pod is running that this phone is not part of: the app was closed
  // mid-walk, or another phone started it. Offered, never joined on its own.
  const podBusy =
    session.phase === 'idle' &&
    link.kind !== 'unreachable' &&
    link.kind !== 'checking' &&
    ['starting', 'scanning', 'finalizing'].includes(link.health.scan_state ?? 'idle');

  const join = async () => {
    setJoining(true);
    const ok = await joinRunningWalk();
    setJoining(false);
    if (ok) openLive();
  };

  // ---- A walk this phone is part of ------------------------------------

  if (session.phase !== 'idle') {
    const finishing = session.phase === 'stopping' || session.phase === 'fetching';
    const elapsed = displayElapsed(
      session.status?.elapsed_s,
      session.statusAtMs,
      session.nowMs,
      session.status?.max_duration_s,
    );

    if (session.phase === 'report' && session.advisoryId) {
      const id = session.advisoryId;
      return (
        <View style={[s.card, s.cardGood]}>
          <Text style={[type.micro, { color: color.secondaryForeground }]}>{tr('WALK REPORT READY')}</Text>
          <Text style={[type.title, { color: color.foreground, marginTop: 6 }]}>{tr('Your walk is finished')}</Text>
          <Pressable
            onPress={() => {
              dismissWalk();
              router.push({ pathname: '/advisory/[id]', params: { id } });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [s.go, pressed && { opacity: 0.8 }]}
          >
            <Text style={[type.label, s.goText]}>{tr('Open report')}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={[s.card, s.cardGood]}>
        <Text style={[type.micro, { color: color.secondaryForeground }]}>
          {session.phase === 'lost' || session.phase === 'failed'
            ? tr('SCAN STOPPED')
            : finishing
              ? tr('FINISHING')
              : tr('SCAN IN PROGRESS')}
        </Text>
        <Text style={[type.title, { color: color.foreground, marginTop: 6 }]}>
          {session.fieldId ? tr('Field {id}', { id: session.fieldId }) : tr('Scan')}
          {elapsed !== null && session.phase === 'running' ? `  ${formatTimer(elapsed)}` : ''}
        </Text>
        <Pressable
          onPress={openLive}
          accessibilityRole="button"
          style={({ pressed }) => [s.go, pressed && { opacity: 0.8 }]}
        >
          <Text style={[type.label, s.goText]}>{tr('Open scan')}</Text>
        </Pressable>
      </View>
    );
  }

  // ---- No walk: the pod's state, and Start ------------------------------

  const ready = link.kind === 'ready';
  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[type.micro, { color: color.fgSubtle }]}>{tr('SCAN A FIELD')}</Text>
          <Text
            style={[
              type.title,
              { color: ready ? color.secondaryForeground : color.foreground, marginTop: 6 },
            ]}
          >
            {link.kind === 'ready'
              ? tr('Pod ready ✓')
              : link.kind === 'starting'
                ? tr('Pod is starting up')
                : link.kind === 'checking'
                  ? tr('Checking the pod')
                  : tr('Pod not found')}
          </Text>
        </View>
        {link.kind === 'ready' ? <StatusChip label={tr('READY')} tone="good" /> : null}
      </View>

      {link.kind === 'starting' ? (
        <Text style={[type.small, s.note]}>
          {tr('The pod answers but is not ready yet. It takes about a minute or two after it is switched on.')}
        </Text>
      ) : null}
      {link.kind === 'unreachable' ? (
        <Text style={[type.small, s.note]}>
          {tr("Check the pod is switched on and this phone is on the pod's WiFi. The Pod tab has the details.")}
        </Text>
      ) : null}

      {podBusy ? (
        <>
          <Text style={[type.small, s.note]}>
            {tr('A scan is already running on the pod. You can open it from here.')}
          </Text>
          <Pressable
            onPress={() => void join()}
            disabled={joining}
            accessibilityRole="button"
            style={({ pressed }) => [s.go, (pressed || joining) && { opacity: 0.7 }]}
          >
            <Text style={[type.label, s.goText]}>{tr('Open running scan')}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => setSheet(true)}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          style={({ pressed }) => [s.go, !ready && s.goOff, pressed && { opacity: 0.8 }]}
        >
          <Text style={[type.label, s.goText]}>{tr('Start scan')}</Text>
        </Pressable>
      )}

      <StartScanSheet visible={sheet} source="camera" onClose={() => setSheet(false)} />
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginBottom: space.lg,
    ...shadow.card,
  },
  cardGood: { backgroundColor: color.secondary, borderColor: color.accent },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  note: { color: color.mutedForeground, marginTop: space.sm },
  go: {
    marginTop: space.lg,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goOff: { opacity: 0.4 },
  goText: { color: color.primaryForeground, fontSize: 16 },
}));
