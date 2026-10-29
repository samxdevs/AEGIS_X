/**
 * A confirm dialog that looks and behaves the same on a phone and in a browser.
 *
 * `Alert.alert` does nothing on the web build, and a Stop or Shut down that
 * silently does not ask is worse than one that asks in a slightly plainer box.
 * The destructive button is the right-hand one and is filled, so it is not the
 * one a thumb lands on by accident when the dialog opens: Cancel is first.
 */

import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius, shadow, space, type, themed } from './theme.ts';

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityViewIsModal>
          <Text style={[type.title, { color: color.foreground }]}>{title}</Text>
          <Text style={[type.body, { color: color.mutedForeground, marginTop: space.sm }]}>{body}</Text>
          <View style={s.buttons}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [s.button, s.cancel, (pressed || busy) && { opacity: 0.6 }]}
            >
              <Text style={[type.label, { color: color.secondaryForeground }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [s.button, s.confirm, (pressed || busy) && { opacity: 0.7 }]}
            >
              {busy ? (
                <ActivityIndicator color={color.destructiveForeground} />
              ) : (
                <Text style={[type.label, { color: color.destructiveForeground }]}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = themed(() => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,31,12,0.55)',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    backgroundColor: color.card,
    borderRadius: radius.xxl,
    padding: space.xl,
    ...shadow.lifted,
  },
  buttons: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  cancel: { backgroundColor: color.secondary, borderWidth: 1, borderColor: color.accent },
  confirm: { backgroundColor: color.destructive },
}));
