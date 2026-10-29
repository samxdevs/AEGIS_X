/**
 * The "AI explanations" card on the Profile screen: pick a provider, paste a key.
 *
 * Only the plain-language explanation on each scan uses this. The readings, the
 * verdict and the advice are all computed without it, so leaving it empty costs
 * nothing, which is why the card says so instead of nagging.
 *
 * The details are edited as a draft and only saved on "Save", so "Test key" can
 * check what is on screen before it is trusted. Each provider keeps its own key,
 * so trying Gemini does not throw away the Claude key.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { testConnection } from '../llm/client.ts';
import { EMPTY_SETTINGS, PROVIDERS, getProvider, isUsable } from '../llm/providers.ts';
import type { ProviderId, ProviderSettings } from '../llm/providers.ts';
import { removeProvider, saveProvider, useLlmSettings } from '../llm/settings.ts';
import { tr } from '../i18n/tr.ts';
import { Panel, StatusChip } from './components.tsx';
import { color, font, radius, shadow, space, type, themed } from './theme.ts';

type Note = { tone: 'good' | 'bad'; label: string; text: string };

export function AiSettingsCard() {
  const settings = useLlmSettings();
  const [selected, setSelected] = useState<ProviderId>(settings.active ?? 'anthropic');
  const [draft, setDraft] = useState<ProviderSettings>(
    settings.providers[settings.active ?? 'anthropic'] ?? EMPTY_SETTINGS,
  );
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const provider = getProvider(selected);
  const hasSaved = Boolean(settings.providers[selected]);
  const inUse = settings.active === selected;
  const usable = isUsable(provider, draft);

  const choose = (id: ProviderId) => {
    setSelected(id);
    setDraft(settings.providers[id] ?? EMPTY_SETTINGS);
    setReveal(false);
    setNote(null);
  };

  const edit = (patch: Partial<ProviderSettings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNote(null);
  };

  const test = async () => {
    setBusy('test');
    setNote(null);
    const result = await testConnection(provider, draft);
    setBusy(null);
    setNote(
      result.ok
        ? { tone: 'good', label: tr('Key works'), text: tr('{name} answered using {model}.', { name: provider.name, model: result.model }) }
        : { tone: 'bad', label: tr('Could not connect'), text: result.reason },
    );
  };

  const save = async () => {
    setBusy('save');
    await saveProvider(selected, draft);
    setBusy(null);
    setNote({
      tone: 'good',
      label: tr('Saved'),
      text: tr('Explanations will now use {name}.', { name: provider.name }),
    });
  };

  const remove = async () => {
    await removeProvider(selected);
    setDraft(EMPTY_SETTINGS);
    setNote(null);
  };

  return (
    <View style={s.card}>
      <View style={s.titleRow}>
        <Text style={[type.cardTitle, { color: color.foreground, flex: 1 }]}>
          {tr('AI explanations')}
        </Text>
        {inUse ? <StatusChip label={tr('IN USE')} tone="good" /> : null}
      </View>
      <Text style={[type.small, { color: color.mutedForeground, marginTop: 4, marginBottom: space.md }]}>
        {tr('Optional. Add your own API key to get a plain-language explanation on each scan. The scan and its advice work fully without it.')}
      </Text>

      <Label>{tr('Provider')}</Label>
      <View style={s.pills}>
        {PROVIDERS.map((p) => {
          const active = p.id === selected;
          const name = p.id === 'custom' ? tr('Other') : p.name;
          return (
            <Pressable
              key={p.id}
              onPress={() => choose(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={name}
              style={[s.pill, active && s.pillActive]}
            >
              <Text
                style={[
                  type.chipValue,
                  { color: active ? color.secondaryForeground : color.mutedForeground },
                ]}
              >
                {settings.active === p.id ? `${name} ✓` : name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Label>{tr('API key')}</Label>
      <View style={s.keyRow}>
        <TextInput
          value={draft.apiKey}
          onChangeText={(apiKey) => edit({ apiKey })}
          placeholder={provider.keyHint}
          placeholderTextColor={color.fgSubtle}
          secureTextEntry={!reveal}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          accessibilityLabel={tr('API key')}
          style={[s.input, { flex: 1 }]}
        />
        <Pressable
          onPress={() => setReveal((r) => !r)}
          accessibilityRole="button"
          style={s.showButton}
        >
          <Text style={[type.label, { color: color.mutedForeground }]}>
            {reveal ? tr('Hide') : tr('Show')}
          </Text>
        </Pressable>
      </View>
      {provider.keyPage ? (
        <Text style={[type.small, { color: color.fgSubtle, marginTop: space.xs }]}>
          {tr('Get a key at {site}', { site: provider.keyPage })}
        </Text>
      ) : null}

      {provider.id === 'custom' ? (
        <>
          <Label>{tr('Server address')}</Label>
          <TextInput
            value={draft.baseUrl}
            onChangeText={(baseUrl) => edit({ baseUrl })}
            placeholder="https://your-server.example/v1"
            placeholderTextColor={color.fgSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="url"
            accessibilityLabel={tr('Server address')}
            style={s.input}
          />
          <Text style={[type.small, { color: color.fgSubtle, marginTop: space.xs }]}>
            {tr('Any service that speaks the OpenAI format, including one running on your own computer.')}
          </Text>
        </>
      ) : null}

      <Label>{tr('Model')}</Label>
      <TextInput
        value={draft.model}
        onChangeText={(model) => edit({ model })}
        placeholder={provider.defaultModel || 'model-name'}
        placeholderTextColor={color.fgSubtle}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        accessibilityLabel={tr('Model')}
        style={s.input}
      />
      {provider.defaultModel ? (
        <Text style={[type.small, { color: color.fgSubtle, marginTop: space.xs }]}>
          {tr('Leave empty to use the one shown. Type a model name to use a different one.')}
        </Text>
      ) : null}

      <View style={s.actions}>
        <ActionButton
          label={tr('Save')}
          onPress={save}
          disabled={!usable || busy !== null}
          busy={busy === 'save'}
          primary
        />
        <ActionButton
          label={busy === 'test' ? tr('Testing…') : tr('Test key')}
          onPress={test}
          disabled={!usable || busy !== null}
          busy={busy === 'test'}
        />
        {hasSaved ? <ActionButton label={tr('Remove')} onPress={remove} disabled={busy !== null} danger /> : null}
      </View>

      {note ? (
        <View style={{ marginTop: space.md }}>
          <Panel label={note.label} tone={note.tone}>
            {note.text}
          </Panel>
        </View>
      ) : null}

      <Text style={[type.small, { color: color.fgSubtle, marginTop: space.md }]}>
        {tr('The key stays on this phone. When you ask for an explanation, that scan is sent to the provider you chose, and nothing else is.')}
      </Text>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text style={[type.micro, { color: color.fgSubtle, marginTop: space.md, marginBottom: space.xs }]}>
      {children.toUpperCase()}
    </Text>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  busy,
  primary,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const tint = danger ? color.destructive : color.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(busy) }}
      style={({ pressed }) => [
        s.button,
        {
          borderColor: primary ? color.primary : danger ? color.destructiveBorder : color.border,
          backgroundColor: primary ? color.primary : 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? color.primaryForeground : tint} size="small" />
      ) : (
        <Text
          style={[
            type.label,
            { color: primary ? color.primaryForeground : danger ? color.destructive : color.foreground },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const s = themed(() => StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginTop: space.lg,
    ...shadow.card,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  pillActive: { borderColor: color.primary, backgroundColor: color.secondary },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    backgroundColor: color.background,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    fontFamily: font.sans,
    fontSize: 14,
    color: color.foreground,
  },
  showButton: {
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  button: {
    minWidth: 84,
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
