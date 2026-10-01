/**
 * The generated explanation, on the advisory screen.
 *
 * Two rules shape how this looks, and both come out of F1/F4.
 *
 * It is visually separated from everything above it. Every other card on this
 * screen renders a measurement; this one renders prose a model wrote about those
 * measurements, and a farmer — or a judge — must be able to tell which is which
 * without being told. It carries its own header, its own tint, and the word
 * GENERATED in the same mono micro-label the rest of the app uses for
 * provenance.
 *
 * And it is never the only place a piece of advice appears. The advisory's own
 * `actions[]` are rendered above by ActionsCard, offline, from the Jetson. This
 * block explains those actions; it does not replace them. If it is missing, the
 * screen is still complete.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { getExplanation, saveExplanation } from '../db/explanations.ts';
import { explainAdvisory, isConfigured } from '../llm/client.ts';
import type { Figure } from '../llm/guard.ts';
import { LANGUAGES } from '../llm/prompt.ts';
import type { Language } from '../llm/prompt.ts';
import { useLlmSettings } from '../llm/settings.ts';
import { currentLanguage, dateLocale, tr } from '../i18n/tr.ts';
import type { Advisory } from '../schema/advisory.ts';
import { Card, Panel, StatusChip } from './components.tsx';
import { color, radius, space, type } from './theme.ts';

type State =
  | { phase: 'loading' }
  | { phase: 'absent' }
  | { phase: 'generating' }
  | { phase: 'ready'; text: string; model: string; generatedAtUtc: string }
  | { phase: 'rejected'; offending: Figure[] }
  | { phase: 'error'; reason: string };

export function ExplanationCard({ advisory }: { advisory: Advisory }) {
  // Starts on the app's language; the picker below can still switch it.
  const [language, setLanguage] = useState<Language>(currentLanguage());
  const [state, setState] = useState<State>({ phase: 'loading' });
  // Subscribes to the Profile screen's AI settings, so saving a key there makes
  // this card appear without leaving the advisory. `isConfigured()` reads them.
  useLlmSettings();

  // Reload from the cache whenever the language changes — each language is its
  // own cached row, so switching is free once both have been generated.
  useEffect(() => {
    let live = true;
    setState({ phase: 'loading' });
    void getExplanation(advisory.advisory_id, language).then((cached) => {
      if (!live) return;
      setState(
        cached
          ? {
              phase: 'ready',
              text: cached.text,
              model: cached.model,
              generatedAtUtc: cached.generatedAtUtc,
            }
          : { phase: 'absent' },
      );
    });
    return () => {
      live = false;
    };
  }, [advisory.advisory_id, language]);

  const generate = useCallback(async () => {
    setState({ phase: 'generating' });
    const result = await explainAdvisory(advisory, language);

    if (result.status === 'ok') {
      const saved = await saveExplanation({
        advisoryId: advisory.advisory_id,
        language,
        text: result.text,
        model: result.model,
      });
      setState({
        phase: 'ready',
        text: saved.text,
        model: saved.model,
        generatedAtUtc: saved.generatedAtUtc,
      });
      return;
    }
    if (result.status === 'rejected') {
      setState({ phase: 'rejected', offending: result.offending });
      return;
    }
    setState({ phase: 'error', reason: result.reason });
  }, [advisory, language]);

  // No endpoint on this build and nothing cached: there is nothing this card
  // could ever show, and the screen is complete without it. Saying "not
  // configured" at a farmer took a whole card to tell them nothing.
  if (state.phase === 'absent' && !isConfigured()) return null;

  return (
    <View>
      <Card
        eyebrow={tr('Generated · not a measurement')}
        title={tr('In plain language')}
        right={<StatusChip label={tr('AI')} tone="unknown" />}
      >
        <Text
          style={[
            type.small,
            { color: color.mutedForeground, marginBottom: space.md },
          ]}
        >
          {tr('Written by AI from the readings above. Every figure is checked against them, and the advice itself comes from the readings, not the AI.')}
        </Text>

        <LanguagePicker value={language} onChange={setLanguage} />

        <View style={{ marginTop: space.md }}>
          <Body state={state} onGenerate={generate} />
        </View>
      </Card>
    </View>
  );
}

function LanguagePicker({
  value,
  onChange,
}: {
  value: Language;
  onChange: (l: Language) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {LANGUAGES.map((l) => {
        const active = l.code === value;
        return (
          <Pressable
            key={l.code}
            onPress={() => onChange(l.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? color.primary : color.border,
              backgroundColor: active ? color.secondary : 'transparent',
            }}
          >
            <Text
              style={[
                type.chipValue,
                { color: active ? color.secondaryForeground : color.mutedForeground },
              ]}
            >
              {l.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Body({ state, onGenerate }: { state: State; onGenerate: () => void }) {
  switch (state.phase) {
    case 'loading':
      return null;

    case 'absent':
      return isConfigured() ? (
        <>
          <Text style={[type.small, { color: color.mutedForeground, marginBottom: space.sm }]}>
            {tr('Not generated yet. This step needs an internet connection. The advisory above does not.')}
          </Text>
          <GenerateButton onPress={onGenerate} label={tr('Explain this advisory')} />
        </>
      ) : (
        <Panel label={tr('Not configured')} tone="unknown">
          {tr('No AI provider is set, so explanations cannot be generated. Add an API key on the Profile tab. Everything else on this screen works without one.')}
        </Panel>
      );

    case 'generating':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <ActivityIndicator color={color.primary} />
          <Text style={[type.small, { color: color.mutedForeground }]}>
            {tr('Writing the explanation…')}
          </Text>
        </View>
      );

    case 'ready':
      return (
        <>
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: color.unknownBorder,
              backgroundColor: color.unknownSurface,
              borderRadius: radius.sm,
              padding: space.md,
            }}
          >
            {state.text.split(/\n{2,}/).map((para, i) => (
              <Text
                key={i}
                style={[
                  type.body,
                  { color: color.foreground, marginTop: i === 0 ? 0 : space.md },
                ]}
              >
                {para.trim()}
              </Text>
            ))}
          </View>
          <Text style={[type.micro, { color: color.fgSubtle, marginTop: space.sm }]}>
            {`${tr('GENERATED')} ${new Date(state.generatedAtUtc)
              .toLocaleString(dateLocale())
              .toUpperCase()} · ${state.model.toUpperCase()}`}
          </Text>
          <View style={{ marginTop: space.sm }}>
            <GenerateButton onPress={onGenerate} label={tr('Write it again')} subtle />
          </View>
        </>
      );

    // The guard fired. This is a success of the system, not a bug, and it says
    // so — naming the invented figure is more convincing than hiding the whole
    // event would be.
    case 'rejected':
      return (
        <>
          <Panel label={tr('Explanation refused')} tone="bad">
            {tr('The model wrote figures that are not in this advisory: {figs}. It was discarded rather than shown. A number that was never measured must not reach this screen.', {
              figs: state.offending.map((f) => f.raw).join(', '),
            })}
          </Panel>
          <View style={{ marginTop: space.sm }}>
            <GenerateButton onPress={onGenerate} label={tr('Try again')} subtle />
          </View>
        </>
      );

    case 'error':
      return (
        <>
          <Panel label={tr('Could not generate')} tone="warn">
            {state.reason}
          </Panel>
          <View style={{ marginTop: space.sm }}>
            <GenerateButton onPress={onGenerate} label={tr('Try again')} subtle />
          </View>
        </>
      );
  }
}

function GenerateButton({
  onPress,
  label,
  subtle = false,
}: {
  onPress: () => void;
  label: string;
  subtle?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: subtle ? color.border : color.primary,
        backgroundColor: subtle ? 'transparent' : color.primary,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={[
          type.label,
          { color: subtle ? color.mutedForeground : color.primaryForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
