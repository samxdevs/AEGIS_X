/**
 * The Ask tab: a farmer taps the microphone, asks about their fields in their
 * own language, and hears the answer back in that language.
 *
 *   speak -> live draft on screen as they talk (src/voice/live.ts), greyed
 *         -> stop: Sarvam speech-to-text on the whole recording, which
 *            replaces the draft (language detected, not chosen)
 *         -> the AI provider, given this phone's own recent scans
 *         -> the F2 guard, exactly as on an explanation
 *         -> Sarvam voice, saved so it replays with no signal
 *
 * Like the explanation card, this is the fourth tier and purely additive. It
 * needs a connection, says so when it has none, and nothing else in the app
 * waits on it. Every answer is labelled as generated, and every one has been
 * through the guard: an answer that invents a figure is refused, not read out.
 *
 * What the farmer said is shown back to them ("you said") before the answer,
 * because speech recognition in a noisy field will mishear, and a farmer who
 * can see the question was misheard knows not to trust the answer to it.
 *
 * The conversation lives only as long as the app is open.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioStream,
} from 'expo-audio';

import { listRecentAdvisories } from '../src/db/advisories.ts';
import { askAboutFarm, describeFailure, isConfigured } from '../src/llm/client.ts';
import type { Figure } from '../src/llm/guard.ts';
import type { Turn } from '../src/llm/ask-prompt.ts';
import { useLlmSettings } from '../src/llm/settings.ts';
import {
  openSarvamSocket,
  playAnswer,
  recordingUpload,
  saveAnswerAudio,
  sarvamKey,
  stopAnswer,
} from '../src/voice/device.ts';
import { LiveTranscriber, STREAM_RATE, toStreamPcm } from '../src/voice/live.ts';
import { MAX_RECORDING_MS, canSpeak, scriptLanguage, synthesize, transcribe, voiceLanguage } from '../src/voice/sarvam.ts';
import type { VoiceFailure } from '../src/voice/sarvam.ts';
import { Panel } from '../src/ui/components.tsx';
import { useBarClearance } from '../src/ui/floating-bar.ts';
import { PressScale } from '../src/ui/motion.tsx';
import { useStatusBarStyle } from '../src/ui/status-bar.ts';
import { MicIcon } from '../src/ui/tab-icons.tsx';
import { useLanguage } from '../src/i18n/language.tsx';
import { tr } from '../src/i18n/tr.ts';
import { color, radius, shadow, space, type, themed } from '../src/ui/theme.ts';

/** How many recent scans the answer is written from. Enough for "my other field", small enough to stay quick. */
const SCANS_IN_CONTEXT = 3;

type Voice = 'none' | 'loading' | 'ready' | 'failed';

type Message =
  | { id: string; role: 'farmer'; text: string; language: string; spoken: boolean }
  | {
      id: string;
      role: 'assistant';
      language: string;
      result:
        | { status: 'ok'; text: string; model: string }
        | { status: 'rejected'; offending: Figure[] }
        | { status: 'error'; reason: string };
      voice: Voice;
      audioUri?: string;
    };

type Phase = 'idle' | 'recording' | 'transcribing' | 'thinking';

/**
 * A voice failure in words. A bad key or no signal reads the same as for the
 * AI provider, but a 400 here means Sarvam would not take the audio, not a
 * wrong model name, so it must not send anyone off to the Profile screen.
 */
function voiceFailure(f: VoiceFailure): string {
  if (f.kind !== 'http') return describeFailure(f, 'Sarvam');
  return `Sarvam could not use the recording (${f.status ?? 'error'}).${f.detail ? ` ${f.detail}` : ''} Try again.`;
}

let nextId = 0;
const newId = (): string => `${Date.now()}-${nextId++}`;

export default function AskScreen() {
  useStatusBarStyle('light');
  useLanguage();
  // Saving a key on Profile should switch this screen on without a restart.
  useLlmSettings();
  const clearance = useBarClearance();

  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // The latest messages, for code that runs after an await and must not read a
  // stale render's copy.
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What has been heard so far, while the farmer is still speaking. `null` when
  // nothing is being captured; '' when capturing but no words have come back yet.
  const [liveDraft, setLiveDraft] = useState<string | null>(null);
  const liveRef = useRef<LiveTranscriber | null>(null);
  const captureMode = useRef<'stream' | 'recorder'>('stream');

  // Asked for in exactly the shape the stream sends, so on most phones the
  // buffers go out untouched; toStreamPcm covers the ones whose hardware
  // could not be converted natively.
  const { stream: audioStream } = useAudioStream({
    sampleRate: STREAM_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer: (b) => liveRef.current?.push(toStreamPcm(b.data, b.sampleRate, b.channels)),
  });
  // The fallback, for when the live stream cannot start.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      liveRef.current?.close();
      stopAnswer();
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<Extract<Message, { role: 'assistant' }>>) => {
    setMessages((all) => all.map((m) => (m.id === id && m.role === 'assistant' ? { ...m, ...patch } : m)));
  }, []);

  const speak = useCallback(
    async (id: string) => {
      const msg = messagesRef.current.find((m) => m.id === id);
      if (!msg || msg.role !== 'assistant' || msg.result.status !== 'ok') return;
      if (msg.audioUri) {
        await playAnswer(msg.audioUri);
        return;
      }
      const key = sarvamKey();
      if (!key) return;
      update(id, { voice: 'loading' });
      const res = await synthesize({ apiKey: key, text: msg.result.text, language: msg.language });
      if (!res.ok) {
        console.warn('[ask] voice failed', res);
        update(id, { voice: 'failed' });
        setNotice(voiceFailure(res));
        return;
      }
      const audioUri = saveAnswerAudio(id, res.mp3Base64);
      update(id, { voice: 'ready', audioUri });
      await playAnswer(audioUri);
    },
    [update],
  );

  const ask = useCallback(
    async (question: string, language: string, spoken: boolean) => {
      setNotice(null);
      const history: Turn[] = messagesRef.current.flatMap((m): Turn[] =>
        m.role === 'farmer'
          ? [{ role: 'farmer', text: m.text }]
          : m.result.status === 'ok'
            ? [{ role: 'assistant', text: m.result.text }]
            : [],
      );
      setMessages((all) => [...all, { id: newId(), role: 'farmer', text: question, language, spoken }]);
      setPhase('thinking');

      // Only records that pass the contract: an answer must not be written from
      // a scan the advisory screen itself refuses to show.
      const advisories = (await listRecentAdvisories(SCANS_IN_CONTEXT))
        .filter((a) => a.valid)
        .map((a) => a.advisory);
      const result = await askAboutFarm({ question, language: voiceLanguage(language), history, advisories });

      const id = newId();
      const answer: Message = {
        id,
        role: 'assistant',
        language,
        result:
          result.status === 'ok'
            ? { status: 'ok', text: result.text, model: result.model }
            : result.status === 'rejected'
              ? { status: 'rejected', offending: result.offending }
              : { status: 'error', reason: result.reason },
        voice: 'none',
      };
      messagesRef.current = [...messagesRef.current, answer];
      setMessages((all) => [...all, answer]);
      setPhase('idle');

      // Asked out loud, answered out loud. A typed question waits for a tap.
      if (spoken && result.status === 'ok' && canSpeak(language) && sarvamKey()) void speak(id);
    },
    [speak],
  );

  const lastLanguage = (): string | null => {
    const last = [...messagesRef.current].reverse().find((m) => m.role === 'farmer');
    return last?.language ?? null;
  };

  /** Ends whichever capture is running and returns the recording's file. */
  const stopCapture = useCallback(async (): Promise<string | null> => {
    if (captureMode.current === 'stream') {
      liveRef.current?.finish();
      liveRef.current = null;
      try {
        const file = await audioStream.stopFileRecordingAsync();
        return file.uri;
      } finally {
        audioStream.stop();
      }
    }
    await recorder.stop();
    return recorder.uri;
  }, [audioStream, recorder]);

  const stopAndSend = useCallback(async () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    setPhase('transcribing');
    let uri: string | null;
    try {
      uri = await stopCapture();
    } catch (err) {
      console.warn('[ask] stopping the recording failed', err);
      uri = null;
    }
    const key = sarvamKey();
    if (!uri || !key) {
      setLiveDraft(null);
      setPhase('idle');
      return;
    }
    let heard: Awaited<ReturnType<typeof transcribe>>;
    try {
      heard = await transcribe({ apiKey: key, audio: await recordingUpload(uri) });
    } catch (err) {
      // Reading the recording back off disk failed before any request was made.
      heard = { ok: false, kind: 'http', detail: err instanceof Error ? err.message : String(err) };
    }
    // The accurate transcript is in (or the attempt failed): the draft has done
    // its job either way, and must not linger looking like what was asked.
    setLiveDraft(null);
    if (!heard.ok) {
      // The screen gives the farmer's version; the log keeps the developer's.
      console.warn('[ask] speech-to-text failed', heard, uri);
      setPhase('idle');
      setNotice(
        heard.kind === 'empty'
          ? tr('Nothing was heard. Hold the phone a little closer and try again.')
          : voiceFailure(heard),
      );
      return;
    }
    await ask(heard.transcript, heard.language, true);
  }, [ask, stopCapture]);

  /**
   * Starts capture. The live stream is preferred: it records the file the final
   * pass needs and feeds the draft at the same time. If the native stream is
   * missing or will not start, the plain recorder still gets the question
   * answered, just without words appearing as the farmer speaks.
   */
  const startCapture = useCallback(
    async (key: string) => {
      try {
        await audioStream.start();
        await audioStream.startFileRecordingAsync({ format: 'wav' });
        captureMode.current = 'stream';
        setLiveDraft('');
        const live = new LiveTranscriber(key, (d) => setLiveDraft(d), openSarvamSocket);
        live.start();
        liveRef.current = live;
        return;
      } catch (err) {
        console.warn('[ask] live stream unavailable, recording without captions', err);
        try {
          audioStream.stop();
        } catch {
          // It never started.
        }
      }
      captureMode.current = 'recorder';
      await recorder.prepareToRecordAsync();
      recorder.record();
    },
    [audioStream, recorder],
  );

  const onMic = useCallback(async () => {
    if (phase === 'recording') {
      await stopAndSend();
      return;
    }
    if (phase !== 'idle') return;
    setNotice(null);
    stopAnswer();
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice(tr('The microphone is switched off for this app. Turn it on in your phone settings to ask by voice.'));
      return;
    }
    const key = sarvamKey();
    if (!key) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await startCapture(key);
    setPhase('recording');
    // Sarvam's quick endpoint takes clips under thirty seconds; stop before it.
    stopTimer.current = setTimeout(() => void stopAndSend(), MAX_RECORDING_MS);
  }, [phase, startCapture, stopAndSend]);

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || phase !== 'idle') return;
      setDraft('');
      void ask(q, scriptLanguage(q, lastLanguage()), false);
    },
    [ask, phase],
  );

  const canAnswer = isConfigured();
  const canListen = canAnswer && sarvamKey() !== null;
  const busy = phase === 'transcribing' || phase === 'thinking';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.lg }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <Intro canAnswer={canAnswer} canListen={canListen} onAsk={send} />
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} onListen={() => void speak(m.id)} />)
        )}

        {liveDraft !== null ? <LiveBubble draft={liveDraft} checking={phase === 'transcribing'} /> : null}

        {busy ? (
          <View style={s.status}>
            <ActivityIndicator color={color.primary} />
            <Text style={[type.small, { color: color.mutedForeground }]}>
              {phase === 'transcribing' ? tr('Listening to what you said…') : tr('Writing the answer…')}
            </Text>
          </View>
        ) : null}

        {notice ? (
          <View style={{ marginTop: space.md }}>
            <Panel label={tr('Could not answer')} tone="warn">
              {notice}
            </Panel>
          </View>
        ) : null}
      </ScrollView>

      <View style={[s.composer, { paddingBottom: clearance - 12 }]}>
        {phase === 'recording' ? (
          <Text style={[type.small, s.hint, { color: color.destructive }]}>
            {tr('Listening… tap again when you have finished.')}
          </Text>
        ) : canListen ? (
          <Text style={[type.small, s.hint]}>{tr('Tap the microphone and ask in your own language.')}</Text>
        ) : null}

        <View style={s.row}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft)}
            placeholder={tr('Or type a question')}
            placeholderTextColor={color.fgSubtle}
            editable={canAnswer && phase === 'idle'}
            returnKeyType="send"
            style={s.input}
          />
          <PressScale
            onPress={() => void onMic()}
            disabled={!canListen || busy}
            accessibilityRole="button"
            accessibilityLabel={phase === 'recording' ? tr('Stop and send') : tr('Ask by voice')}
            scaleTo={0.92}
            style={[
              s.mic,
              {
                backgroundColor: phase === 'recording' ? color.destructive : color.primary,
                opacity: !canListen || busy ? 0.4 : 1,
              },
            ]}
          >
            <MicIcon color={color.primaryForeground} size={28} />
          </PressScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Before the first question: what this is, what it answers from, and a few questions to tap. */
function Intro({
  canAnswer,
  canListen,
  onAsk,
}: {
  canAnswer: boolean;
  canListen: boolean;
  onAsk: (q: string) => void;
}) {
  const examples = [
    tr('How is my crop doing?'),
    tr('What should I do this week?'),
    tr('Is there a pest problem in my field?'),
  ];
  return (
    <View style={s.card}>
      <Text style={[type.title, { color: color.foreground }]}>{tr('Ask about your fields')}</Text>
      <Text style={[type.body, { color: color.mutedForeground, marginTop: space.sm }]}>
        {tr('Speak in Hindi, Marathi, Tamil, Telugu, Bengali or any of 22 Indian languages. Answers come from the scans on this phone and are spoken back in your language.')}
      </Text>

      {!canAnswer ? (
        <View style={{ marginTop: space.md }}>
          <Panel label={tr('Not configured')} tone="unknown">
            {tr('Add a Sarvam key on the Profile tab to ask by voice. The rest of the app works without one.')}
          </Panel>
        </View>
      ) : !canListen ? (
        <View style={{ marginTop: space.md }}>
          <Panel label={tr('Typing only')} tone="unknown">
            {tr('Voice needs a Sarvam key. Add one on the Profile tab under Sarvam. You can still type a question.')}
          </Panel>
        </View>
      ) : null}

      {canAnswer ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          {examples.map((q) => (
            <Pressable
              key={q}
              onPress={() => onAsk(q)}
              accessibilityRole="button"
              style={({ pressed }) => [s.example, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[type.label, { color: color.secondaryForeground }]}>{q}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={[type.small, { color: color.fgSubtle, marginTop: space.md }]}>
        {tr('Needs an internet connection. Answers are written by AI and every figure is checked against your scans.')}
      </Text>
    </View>
  );
}

/**
 * The farmer's words as they speak: the live draft. Faded and labelled, because
 * it will mishear at the edges of each chunk and is replaced by the accurate
 * transcript the moment they stop. It must never look like what was asked.
 */
function LiveBubble({ draft, checking }: { draft: string; checking: boolean }) {
  return (
    <View style={[s.bubble, s.farmer, s.live]}>
      <Text style={[type.micro, { color: color.secondaryForeground, opacity: 0.75 }]}>
        {checking ? tr('CHECKING WHAT YOU SAID') : tr('HEARING YOU')}
      </Text>
      <Text style={[type.body, { color: color.secondaryForeground, opacity: 0.6, marginTop: 4 }]}>
        {draft || '…'}
      </Text>
    </View>
  );
}

function Bubble({ message, onListen }: { message: Message; onListen: () => void }) {
  if (message.role === 'farmer') {
    const lang = voiceLanguage(message.language);
    return (
      <View style={[s.bubble, s.farmer]}>
        <Text style={[type.micro, { color: color.secondaryForeground, opacity: 0.75 }]}>
          {`${message.spoken ? tr('YOU SAID') : tr('YOU ASKED')} · ${lang.native}`}
        </Text>
        <Text style={[type.body, { color: color.secondaryForeground, marginTop: 4 }]}>{message.text}</Text>
      </View>
    );
  }

  const { result } = message;
  if (result.status === 'rejected') {
    return (
      <View style={s.answerWrap}>
        <Panel label={tr('Answer refused')} tone="bad">
          {tr('The answer had figures that are not in your scans: {figs}. It was discarded rather than read out. Ask again, or check with your Krishi Vigyan Kendra.', {
            figs: result.offending.map((f) => f.raw).join(', '),
          })}
        </Panel>
      </View>
    );
  }
  if (result.status === 'error') {
    return (
      <View style={s.answerWrap}>
        <Panel label={tr('Could not answer')} tone="warn">
          {result.reason}
        </Panel>
      </View>
    );
  }

  const speakable = canSpeak(message.language);
  return (
    <View style={[s.bubble, s.answer]}>
      <Text style={[type.body, { color: color.foreground }]}>{result.text}</Text>
      <View style={s.answerFoot}>
        <Text style={[type.micro, { color: color.fgSubtle, flex: 1 }]}>
          {`${tr('GENERATED')} · ${result.model.toUpperCase()}`}
        </Text>
        {speakable ? (
          <Pressable
            onPress={onListen}
            disabled={message.voice === 'loading'}
            accessibilityRole="button"
            style={({ pressed }) => [s.listen, { opacity: pressed ? 0.7 : 1 }]}
          >
            {message.voice === 'loading' ? (
              <ActivityIndicator size="small" color={color.primary} />
            ) : (
              <Text style={[type.label, { color: color.primary }]}>
                {message.voice === 'ready' ? tr('Play again') : tr('Listen')}
              </Text>
            )}
          </Pressable>
        ) : (
          <Text style={[type.micro, { color: color.fgSubtle }]}>{tr('NO VOICE FOR THIS LANGUAGE YET')}</Text>
        )}
      </View>
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
    ...shadow.card,
  },
  example: {
    alignSelf: 'flex-start',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.secondary,
  },
  bubble: { borderRadius: radius.lg, padding: space.md, marginBottom: space.md, maxWidth: '88%' },
  farmer: { alignSelf: 'flex-end', backgroundColor: color.secondary },
  live: { borderWidth: 1, borderStyle: 'dashed', borderColor: color.primary },
  answer: {
    alignSelf: 'flex-start',
    backgroundColor: color.unknownSurface,
    borderLeftWidth: 3,
    borderLeftColor: color.unknownBorder,
  },
  answerWrap: { marginBottom: space.md },
  answerFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  listen: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.primary,
    minWidth: 72,
    alignItems: 'center',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  composer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
  hint: { color: color.mutedForeground, marginBottom: space.sm, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: {
    flex: 1,
    ...type.body,
    color: color.foreground,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  mic: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lifted,
  },
}));
