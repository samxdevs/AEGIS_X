/**
 * Findings over a satellite image of the field, with the offline plot as its
 * fallback.
 *
 * ── Why a satellite image now, when charts.tsx argues against one ───────────
 * The plot in `FieldMap` was built on two worries: that imagery would imply
 * more precision than a ~2.5 m handheld fix has, and that a map needing a
 * download would be the one screen that broke in a field. Both are handled
 * here rather than avoided:
 *
 *   Precision. Every finding is drawn as a circle of the fix's real error
 *   radius in metres, not as a pin, so zooming in shows the circle growing to
 *   cover several plants instead of pointing at one. The caption says so.
 *
 *   No signal. If no image tile loads within a few seconds (no internet, or
 *   the phone is on the pod's WiFi, which has none) the WebView is replaced by
 *   the offline plot, with a line saying why. The positions are identical;
 *   only the picture underneath is missing.
 *
 * What the image buys is recognition: a farmer finds their own field, bund and
 * tree line in it, which a graticule never gives them.
 *
 * ── Why a WebView and not react-native-maps ─────────────────────────────────
 * react-native-maps on Android needs a Google Maps API key baked into the
 * native build. Leaflet in a WebView with Esri's imagery tiles needs no key,
 * so the map works in Expo Go and in a dev build alike. Leaflet itself comes
 * from the CDN: when there is internet for the tiles there is internet for the
 * script, and when there is not, the fallback takes over either way.
 *
 * ── Panning ─────────────────────────────────────────────────────────────────
 * Inside a scrolling page a one-finger drag cannot both scroll the page and
 * pan the map, so the inline map keeps the page scroll and offers pinch and
 * +/- to zoom. Zoomed in, the farmer taps "Full screen": there is no page
 * around the map there, so one finger pans it.
 */

import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView as NativeWebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

/**
 * react-native-webview renders nothing in a browser, so the web build shows
 * the same page in an iframe. The page posts to its parent instead of to
 * ReactNativeWebView, and messages are handed on in the WebView's event shape.
 */
function IframeView({
  source,
  onMessage,
}: {
  source: { html: string };
  onMessage?: (e: WebViewMessageEvent) => void;
  [prop: string]: unknown;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || typeof e.data !== 'string') return;
      handler.current?.({ nativeEvent: { data: e.data } } as WebViewMessageEvent);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);
  return createElement('iframe', {
    ref,
    srcDoc: source.html,
    style: { border: 0, width: '100%', height: '100%', display: 'block' },
  });
}

const WebView = (Platform.OS === 'web' ? IframeView : NativeWebView) as typeof NativeWebView;

import type { Tone } from './components.tsx';
import { chart, color, radius, space, type, themed } from './theme.ts';
import { tr } from '../i18n/tr.ts';

export type GeoPoint = {
  lat: number;
  lon: number;
  tone: Tone;
  /** Shown in the popup when the circle is tapped. */
  label: string;
  sub?: string;
  /** Passed back through `onOpen` when the popup's link is tapped. */
  id?: string;
  /**
   * This point's own error radius in metres, when it has one (a walk's stretches
   * carry their position accuracy). 0 draws the dot with no circle. Left out, the
   * map-wide `radiusM` applies.
   */
  radiusM?: number;
};

/** The pod's stated fix error, CEP. See `gps.accuracy_note` on the wire. */
export const FIX_RADIUS_M = 2.5;

/** How long to wait for a first tile before deciding there is no imagery. */
const TILE_TIMEOUT_MS = 7000;

const TONE_STROKE: Record<Tone, string> = {
  bad: '#FF5A4E',
  warn: '#FFB020',
  good: '#4ADE80',
  unknown: '#CBD5E1',
  neutral: '#FFFFFF',
};

type Phase = 'loading' | 'ok' | 'offline';

export function SatelliteMap({
  points,
  height = 280,
  radiusM = FIX_RADIUS_M,
  fallback,
  onOpen,
}: {
  points: GeoPoint[];
  height?: number;
  radiusM?: number;
  /** What to show when no imagery loads. Usually the offline `FieldMap`. */
  fallback: ReactNode;
  onOpen?: (id: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const openLabel = tr('Open scan');
  const html = useMemo(
    () => buildHtml(points, radiusM, !!onOpen, openLabel, false),
    [points, radiusM, onOpen, openLabel],
  );
  const fullHtml = useMemo(
    () => buildHtml(points, radiusM, !!onOpen, openLabel, true),
    [points, radiusM, onOpen, openLabel],
  );

  const parse = (e: WebViewMessageEvent): { type?: string; id?: string } => {
    try {
      return JSON.parse(e.nativeEvent.data);
    } catch {
      return {};
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = parse(e);
    if (msg.type === 'tiles-ok') setPhase('ok');
    if (msg.type === 'offline') setPhase((p) => (p === 'ok' ? p : 'offline'));
    if (msg.type === 'open' && msg.id && onOpen) onOpen(msg.id);
  };

  const onFullMessage = (e: WebViewMessageEvent) => {
    const msg = parse(e);
    if (msg.type === 'open' && msg.id && onOpen) {
      setExpanded(false);
      onOpen(msg.id);
    }
  };

  if (phase === 'offline') {
    return (
      <View>
        {fallback}
        <Text style={[type.small, { color: color.unknown, marginTop: space.sm }]}>
          {tr('No internet, so no satellite image. The positions are the same; only the picture underneath is missing.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.frame, { height }]}>
      <WebView
        source={{ html, baseUrl: 'https://aegis.local/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onError={() => setPhase('offline')}
        onHttpError={() => setPhase('offline')}
        // The page scrolls; the map must not steal that. No nestedScrollEnabled:
        // on Android it stops the page taking any gesture that starts on the map,
        // which trapped the thumb there. Pinch and the +/- buttons still zoom;
        // panning is in the full screen view.
        scrollEnabled={false}
        style={{ backgroundColor: chart.grid }}
        javaScriptEnabled
        domStorageEnabled
        // Tiles and the Leaflet script are cached like any web page, so a
        // field viewed once with signal can show again with a weak one.
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
      />
      {phase === 'loading' ? (
        <View style={s.loading} pointerEvents="none">
          <ActivityIndicator color={color.primary} />
          <Text style={[type.small, { color: color.mutedForeground, marginTop: space.xs }]}>
            {tr('Loading satellite image')}
          </Text>
        </View>
      ) : null}
      {phase === 'ok' ? (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={tr('Full screen map')}
          hitSlop={8}
          style={s.expand}
        >
          <Text style={[type.label, { color: '#FFFFFF' }]}>{tr('Full screen')}</Text>
        </Pressable>
      ) : null}
      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={s.full}>
          {expanded ? (
            <WebView
              source={{ html: fullHtml, baseUrl: 'https://aegis.local/' }}
              originWhitelist={['*']}
              onMessage={onFullMessage}
              scrollEnabled={false}
              style={{ backgroundColor: chart.grid }}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled
              cacheMode="LOAD_CACHE_ELSE_NETWORK"
            />
          ) : null}
          <Pressable
            onPress={() => setExpanded(false)}
            accessibilityRole="button"
            accessibilityLabel={tr('Close map')}
            hitSlop={8}
            style={[s.close, { top: insets.top + space.sm }]}
          >
            <Text style={[type.label, { color: '#FFFFFF' }]}>{tr('Close')}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function buildHtml(
  points: GeoPoint[],
  radiusM: number,
  linkable: boolean,
  openLabel: string,
  interactive: boolean,
): string {
  const data = points.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    stroke: TONE_STROKE[p.tone],
    label: p.label,
    sub: p.sub ?? '',
    id: p.id ?? '',
    radius: typeof p.radiusM === 'number' ? p.radiusM : radiusM,
  }));

  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #map { margin: 0; height: 100%; background: #2b2f2b; }
  .leaflet-popup-content { font: 13px/1.35 sans-serif; margin: 10px 12px; }
  .leaflet-popup-content b { font-size: 14px; }
  .leaflet-popup-content a { color: #2E7D32; font-weight: 600; text-decoration: none; }
  .leaflet-control-attribution { font-size: 9px; }
  /* Inline: a vertical swipe on the map scrolls the page. Full screen: the map takes every gesture. */
  .leaflet-container { touch-action: ${interactive ? 'none' : 'pan-y pinch-zoom'} !important; }
</style>
</head><body>
<div id="map"></div>
<script>
  function post(m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent !== window) window.parent.postMessage(s, '*');
  }
  var gotTile = false;
  setTimeout(function () { if (!gotTile) post({ type: 'offline' }); }, ${TILE_TIMEOUT_MS});
</script>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
  onerror="post({ type: 'offline' })"></script>
<script>
  // Labels are pod data: escaped for the script tag here, for HTML below.
  var points = ${JSON.stringify(data).replace(/</g, '\\u003c')};
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    // Inline, dragging would fight the page scroll; pinch and the +/- buttons
    // zoom. The full screen view has no page to scroll, so it pans.
    dragging: ${interactive},
    scrollWheelZoom: false,
    doubleClickZoom: true,
    touchZoom: true,
    maxZoom: 20,
  });
  var tiles = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxNativeZoom: 19, maxZoom: 20, attribution: 'Imagery: Esri, Maxar, Earthstar Geographics' }
  ).addTo(map);
  tiles.on('tileload', function () { if (!gotTile) { gotTile = true; post({ type: 'tiles-ok' }); } });
  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
  // The full screen view is laid out after the page loads, so Leaflet can
  // measure a smaller box than it ends up in and leave the rest untiled.
  if (window.ResizeObserver) new ResizeObserver(function () { map.invalidateSize(); }).observe(document.getElementById('map'));
  setTimeout(function () { map.invalidateSize(); }, 400);

  var group = [];
  points.forEach(function (p) {
    // The true error circle, in metres: grows as you zoom, never a pin.
    var c = p.radius > 0 ? L.circle([p.lat, p.lon], {
      radius: p.radius, color: p.stroke, weight: 2, fillColor: p.stroke, fillOpacity: 0.28,
    }).addTo(map) : null;
    // A fixed-size dot so the finding is visible when zoomed out.
    var d = L.circleMarker([p.lat, p.lon], {
      radius: 4, color: '#000', weight: 1, fillColor: p.stroke, fillOpacity: 1,
    }).addTo(map);
    var html = '<b>' + esc(p.label) + '</b>' + (p.sub ? '<br>' + esc(p.sub) : '') +
      (${linkable} && p.id ? '<br><a href="#" data-id="' + esc(p.id) + '">' + esc(${JSON.stringify(openLabel)}) + '</a>' : '');
    if (c) c.bindPopup(html);
    d.bindPopup(html);
    group.push([p.lat, p.lon]);
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-id]');
    if (a) { e.preventDefault(); post({ type: 'open', id: a.getAttribute('data-id') }); }
  });
  if (group.length === 1) map.setView(group[0], 19);
  else map.fitBounds(group, { padding: [36, 36], maxZoom: 19 });
</script>
</body></html>`;
}

const s = themed(() => StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: chart.grid,
  },
  expand: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  full: { flex: 1, backgroundColor: chart.grid },
  close: {
    position: 'absolute',
    right: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.background + 'D9',
  },
}));
