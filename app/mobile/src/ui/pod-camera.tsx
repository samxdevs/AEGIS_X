/**
 * What the pod camera sees, live, with a Capture button (SCAN_CONTROL_API.md
 * §1.7, §1.8).
 *
 * The picture is drawn by a small page inside a WebView. React Native's Image
 * flickers and caches every frame to disk when its address changes eight times
 * a second; the page instead fetches each frame into a hidden image and swaps
 * it in once decoded, so the picture never blanks. The page is loaded with the
 * pod as its base address, which makes the frame requests same-origin, so the
 * X-Frame-Seq header is readable and no CORS setup is needed on the pod.
 *
 * Each new frame number is posted back here, and that alone decides whether the
 * badge says LIVE (see scan/camera.ts). A frozen camera behind a healthy
 * connection shows PAUSED, not a still picture labelled live.
 *
 * Capture asks the pod to check the full-resolution frame it is seeing now.
 * The result is one photo's worth of evidence and every card says so.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

import { tr } from '../i18n/tr.ts';
import type { Capture } from '../schema/advisory.ts';
import { describeReliability } from '../schema/reliability.ts';
import { captureFrame, podBaseUrl } from '../scan/api.ts';
import { FRAME_INTERVAL_MS, POD_CAMERA_UPSIDE_DOWN, describeCapture, feedState } from '../scan/camera.ts';
import type { FeedEvidence, FeedState } from '../scan/camera.ts';
import { formatClock } from '../scan/report.ts';
import { TONE } from './components.tsx';
import { color, radius, shadow, space, type, themed } from './theme.ts';

/** Cards shown under the feed; every photo is in the report. */
const CAPTURE_CARDS = 3;

/**
 * The page in the WebView. Plain ES5 on purpose: it runs in whatever WebView
 * the phone has, and nothing here is worth a build step.
 */
function feedPage(intervalMs: number): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;visibility:hidden${POD_CAMERA_UPSIDE_DOWN ? ';transform:rotate(180deg)' : ''}}</style>
</head><body><img id="a"><img id="b"><script>
(function () {
  var post = function (m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var imgs = [document.getElementById('a'), document.getElementById('b')];
  var front = 0, lastSeq = null, shown = null;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }
  function tick() {
    var t0 = Date.now();
    fetch('/api/v1/camera/frame.jpg?t=' + t0, { cache: 'no-store' }).then(function (r) {
      if (r.status !== 200) { post({ type: 'status', status: r.status }); return wait(1000); }
      var seq = r.headers.get('X-Frame-Seq');
      var replay = r.headers.get('X-Frame-Source') === 'replay';
      if (seq !== null && seq === lastSeq) return wait(${intervalMs} - (Date.now() - t0));
      return r.blob().then(function (b) {
        lastSeq = seq;
        var u = URL.createObjectURL(b);
        var back = imgs[1 - front];
        back.onload = function () {
          back.style.visibility = 'visible';
          imgs[front].style.visibility = 'hidden';
          if (shown) URL.revokeObjectURL(shown);
          shown = u;
          front = 1 - front;
          post({ type: 'frame', seq: seq, replay: replay });
        };
        back.src = u;
        return wait(${intervalMs} - (Date.now() - t0));
      });
    }).catch(function () {
      post({ type: 'status', status: 0 });
      return wait(1000);
    }).then(tick);
  }
  tick();
})();
</script></body></html>`;
}

export function PodCamera({ scanId, canCapture }: { scanId: string; canCapture: boolean }) {
  const [base, setBase] = useState<string | null>(null);
  const [state, setState] = useState<FeedState>({ kind: 'waiting' });
  const [capturing, setCapturing] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [error, setError] = useState<string | null>(null);
  const evidence = useRef<FeedEvidence>({ lastNewFrameAtMs: null, replay: false, lastStatus: null });

  useEffect(() => {
    void podBaseUrl().then(setBase);
  }, []);

  // Frames arrive ~8 a second; the badge is re-judged twice a second and the
  // screen re-renders only when the verdict actually changes.
  useEffect(() => {
    const timer = setInterval(() => {
      const next = feedState(evidence.current, Date.now());
      setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let m: { type?: string; status?: number; replay?: boolean };
    try {
      m = JSON.parse(e.nativeEvent.data) as typeof m;
    } catch {
      return;
    }
    if (m.type === 'frame') {
      evidence.current = { lastNewFrameAtMs: Date.now(), replay: m.replay === true, lastStatus: null };
    } else if (m.type === 'status') {
      evidence.current = { ...evidence.current, lastStatus: m.status ?? 0 };
    }
  }, []);

  const capture = useCallback(async () => {
    setCapturing(true);
    setError(null);
    const out = await captureFrame(scanId);
    setCapturing(false);
    if (out.ok) setCaptures((all) => [out.capture, ...all]);
    else if (out.reason) setError(out.reason);
  }, [scanId]);

  const broken = state.kind === 'unsupported' || state.kind === 'unavailable';

  return (
    <View style={{ marginBottom: space.md }}>
      <View style={s.frame}>
        {Platform.OS === 'web' ? (
          <Overlay text={tr('The pod camera shows in the phone app, not in a browser.')} />
        ) : base ? (
          <WebView
            source={{ html: feedPage(FRAME_INTERVAL_MS), baseUrl: `${base}/` }}
            originWhitelist={['*']}
            onMessage={onMessage}
            scrollEnabled={false}
            bounces={false}
            style={{ backgroundColor: '#000' }}
            containerStyle={{ backgroundColor: '#000' }}
          />
        ) : null}

        {state.kind === 'waiting' && Platform.OS !== 'web' ? (
          <Overlay spinner text={tr('Waiting for the pod camera…')} />
        ) : null}
        {state.kind === 'paused' ? (
          <Overlay text={tr('Camera picture paused. What you see is not live. Stay close to the pod.')} />
        ) : null}
        {state.kind === 'unsupported' ? (
          <Overlay text={tr('This pod does not send a camera picture yet. It needs the newer pod software.')} />
        ) : null}
        {state.kind === 'unavailable' ? (
          <Overlay text={tr('The pod camera is not available. Check the camera cable, then switch the pod off and on.')} />
        ) : null}

        <View style={s.badgeRow} pointerEvents="none">
          <Badge state={state} />
        </View>

        {canCapture && !broken ? (
          <View style={s.shutterRow}>
            <Pressable
              onPress={() => void capture()}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel={tr('Capture a photo to check')}
              style={({ pressed }) => [s.shutter, (pressed || capturing) && { opacity: 0.7 }]}
            >
              {capturing ? <ActivityIndicator color={color.primary} /> : <View style={s.shutterDot} />}
            </Pressable>
            <Text style={s.shutterLabel}>{capturing ? tr('Checking photo…') : tr('Capture')}</Text>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={[s.note, { borderColor: TONE.warn.border, backgroundColor: TONE.warn.bg }]}>
          <Text style={[type.small, { color: TONE.warn.fg }]}>{error}</Text>
        </View>
      ) : null}

      {captures.length > 0 ? (
        <View style={{ marginTop: space.md }}>
          <Text style={[type.micro, { color: color.fgSubtle, marginBottom: space.sm }]}>{tr('YOUR PHOTOS')}</Text>
          {captures.slice(0, CAPTURE_CARDS).map((c) => (
            <CaptureCard key={c.capture_id} capture={c} base={base} />
          ))}
          {captures.length > CAPTURE_CARDS ? (
            <Text style={[type.small, { color: color.fgSubtle }]}>
              {tr('{n} earlier photos. They are all in the report.', { n: captures.length - CAPTURE_CARDS })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Badge({ state }: { state: FeedState }) {
  if (state.kind === 'live') {
    return (
      <View style={[s.badge, { backgroundColor: state.replay ? 'rgba(80,80,80,0.85)' : 'rgba(185,28,28,0.9)' }]}>
        {!state.replay ? <View style={s.liveDot} /> : null}
        <Text style={s.badgeText}>{state.replay ? tr('REPLAY') : tr('LIVE')}</Text>
      </View>
    );
  }
  if (state.kind === 'paused') {
    return (
      <View style={[s.badge, { backgroundColor: 'rgba(120,90,10,0.9)' }]}>
        <Text style={s.badgeText}>{tr('PAUSED')}</Text>
      </View>
    );
  }
  return null;
}

function Overlay({ text, spinner = false }: { text: string; spinner?: boolean }) {
  return (
    <View style={s.overlay} pointerEvents="none">
      {spinner ? <ActivityIndicator color="#fff" style={{ marginBottom: space.sm }} /> : null}
      <Text style={[type.small, { color: '#fff', textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

/** One photo and what the pod made of it. */
export function CaptureCard({ capture, base }: { capture: Capture; base: string | null }) {
  const { headline, tone } = describeCapture(capture);
  const t = TONE[tone];
  // The photo lives on the pod. Away from it, or once the pod has pruned it,
  // the result still stands on its own, so the thumbnail just steps aside.
  const [photoGone, setPhotoGone] = useState(false);
  const reliability =
    capture.verdict === 'DISEASE' && capture.cross_source_reliability
      ? describeReliability(capture.cross_source_reliability)
      : null;
  return (
    <View style={[s.card, { borderColor: t.border, backgroundColor: t.bg }]}>
      {base && !photoGone ? (
        <Image
          source={{ uri: `${base}${capture.image_path}` }}
          style={[s.thumb, POD_CAMERA_UPSIDE_DOWN && { transform: [{ rotate: '180deg' }] }]}
          onError={() => setPhotoGone(true)}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: t.fg, lineHeight: 20 }]}>{headline}</Text>
        {reliability ? (
          <Text style={[type.small, { color: t.fg, marginTop: 4 }]}>
            {`${reliability.label}. ${tr('From one photo: an alert needs several frames to agree.')}`}
          </Text>
        ) : null}
        <Text style={[type.micro, { color: color.fgSubtle, marginTop: 6 }]}>
          {`${tr('PHOTO {n}', { n: capture.capture_id })} · ${formatClock(capture.utc)}`}
        </Text>
      </View>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  frame: {
    aspectRatio: 4 / 3,
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...shadow.card,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  badgeRow: { position: 'absolute', top: space.md, left: space.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  badgeText: { ...type.micro, color: '#fff', letterSpacing: 1.2 },
  shutterRow: { position: 'absolute', bottom: space.md, left: 0, right: 0, alignItems: 'center' },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDot: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff' },
  shutterLabel: {
    ...type.micro,
    color: '#fff',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  note: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  card: {
    flexDirection: 'row',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.md,
    marginBottom: space.sm,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.lg, backgroundColor: '#000' },
}));
