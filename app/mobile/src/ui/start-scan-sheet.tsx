/**
 * The Start scan sheet: which field, which crop, then go.
 *
 * The crop is declared by the farmer and the pod holds the walk to it: a tile
 * that looks like another crop's disease is counted as unclear, never as that
 * disease. So the crop is never pre-selected. A remembered default would be
 * right most days and silently wrong on the day the farmer walks a different
 * field, and a wrong declared crop quietly turns real findings into "unclear".
 *
 * The same sheet starts the demo replay (a recorded crop video instead of the
 * camera); only the button and one line of explanation differ.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listAdvisories } from '../db/advisories.ts';
import { getState, setState } from '../db/client.ts';
import { StartRefused, startScan } from '../scan/api.ts';
import { CROPS } from '../scan/logic.ts';
import type { Crop, ScanSource } from '../scan/logic.ts';
import { askForLocation, beginWalk, joinRunningWalk } from '../scan/session.ts';
import { Panel } from './components.tsx';
import { color, radius, space, type, themed } from './theme.ts';
import { msg, tr } from '../i18n/tr.ts';

const CROP_LABEL: Record<Crop, string> = {
  wheat: msg('Wheat'),
  rice: msg('Rice'),
  sugarcane: msg('Sugarcane'),
};

/** The same shape the pod's scan id and the app's field parsing accept. */
const FIELD_ID = /^[A-Za-z0-9-]{1,16}$/;

const LAST_FIELD_KEY = 'last_field_id';

export function StartScanSheet({
  visible,
  source,
  onClose,
}: {
  visible: boolean;
  source: ScanSource;
  onClose: () => void;
}) {
  const [field, setField] = useState('');
  const [crop, setCrop] = useState<Crop | null>(null);
  const [known, setKnown] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const replay = source === 'replay';

  // Fresh each time it opens: the field the last walk used, no crop picked.
  useEffect(() => {
    if (!visible) return;
    setCrop(null);
    setError(null);
    setBusy(false);
    void (async () => {
      const [last, rows] = await Promise.all([getState(LAST_FIELD_KEY), listAdvisories()]);
      const ids = [...new Set(rows.map((r) => r.fieldId).filter((x): x is string => !!x))].sort();
      setKnown(ids);
      setField((current) => current || last || ids[0] || '');
    })();
  }, [visible]);

  const trimmed = field.trim();
  const fieldOk = FIELD_ID.test(trimmed);
  const canStart = fieldOk && crop !== null && !busy;

  const openLive = () => {
    onClose();
    router.push('/live');
  };

  const start = async () => {
    if (!canStart || crop === null) return;
    setBusy(true);
    setError(null);
    // Location is asked for here, with the farmer looking at this sheet.
    await askForLocation();
    try {
      const started = await startScan({ fieldId: trimmed, crop, source });
      await setState(LAST_FIELD_KEY, trimmed);
      beginWalk({ scanId: started.scanId, fieldId: trimmed, crop, replay: started.replay || replay });
      openLive();
    } catch (err) {
      // A scan already running is not a failure to the farmer: open it.
      if (err instanceof StartRefused && err.kind === 'in_progress' && (await joinRunningWalk())) {
        openLive();
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.backdrop}
      >
        <Pressable style={s.dismiss} onPress={busy ? undefined : onClose} accessibilityLabel={tr('Close')} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[type.title, { color: color.foreground }]}>
              {replay ? tr('Demo: replay crop video') : tr('Start scan')}
            </Text>
            <Text style={[type.small, { color: color.mutedForeground, marginTop: 4 }]}>
              {replay
                ? tr('Plays a recorded crop video through the pod instead of its camera. The report is labelled as a replay.')
                : tr('Pick the field and the crop you are about to walk, then carry the pod through the rows.')}
            </Text>

            <Text style={[type.micro, s.label]}>{tr('FIELD')}</Text>
            {known.length > 0 ? (
              <View style={s.chips}>
                {known.map((id) => {
                  const on = trimmed === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setField(id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[s.chip, on && s.chipOn]}
                    >
                      <Text style={[type.label, { color: on ? color.primaryForeground : color.foreground }]}>
                        {id}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <TextInput
              value={field}
              onChangeText={setField}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={16}
              placeholder={tr('Field name, for example F01')}
              placeholderTextColor={color.fgSubtle}
              style={s.input}
            />
            {trimmed.length > 0 && !fieldOk ? (
              <Text style={[type.small, { color: color.destructive, marginTop: space.xs }]}>
                {tr('Use letters, numbers and dashes only.')}
              </Text>
            ) : null}

            <Text style={[type.micro, s.label]}>{tr('CROP')}</Text>
            <View style={s.cropRow}>
              {CROPS.map((c) => {
                const on = crop === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCrop(c)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[s.crop, on && s.chipOn]}
                  >
                    <Text style={[type.label, { color: on ? color.primaryForeground : color.foreground }]}>
                      {tr(CROP_LABEL[c])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[type.small, { color: color.fgSubtle, marginTop: space.sm }]}>
              {tr('Choose the crop you are walking. Anything that looks like a different crop is counted as unclear, not as a disease.')}
            </Text>

            {error ? (
              <View style={{ marginTop: space.md }}>
                <Panel label={tr('Could not start')} tone="bad">
                  {error}
                </Panel>
              </View>
            ) : null}

            <Pressable
              onPress={() => void start()}
              disabled={!canStart}
              accessibilityRole="button"
              style={({ pressed }) => [s.go, !canStart && s.goOff, pressed && { opacity: 0.8 }]}
            >
              {busy ? (
                <ActivityIndicator color={color.primaryForeground} />
              ) : (
                <Text style={[type.label, { color: color.primaryForeground, fontSize: 16 }]}>
                  {replay ? tr('Start replay') : tr('Start scan')}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [s.cancel, (pressed || busy) && { opacity: 0.6 }]}
            >
              <Text style={[type.label, { color: color.mutedForeground }]}>{tr('Cancel')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,31,12,0.55)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    maxHeight: '88%',
  },
  label: { color: color.fgSubtle, marginTop: space.lg, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.primary, borderColor: color.primary },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: 'SourceCodePro_400Regular',
    fontSize: 15,
    color: color.foreground,
    backgroundColor: color.background,
  },
  cropRow: { flexDirection: 'row', gap: space.sm },
  crop: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  go: {
    marginTop: space.xl,
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goOff: { opacity: 0.4 },
  cancel: { alignItems: 'center', paddingVertical: space.md, marginTop: space.xs },
}));
