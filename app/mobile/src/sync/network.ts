/**
 * The platform boundary. Everything platform-specific about reaching a WiFi
 * network that has no internet lives in this one file, so that when the native
 * module lands, nothing else in the app changes.
 *
 * ── The Android problem, stated precisely ────────────────────────────────────
 * When the phone joins SIH-FIELD (or SIH-NODE-01), Android sees a network with
 * no internet and keeps the *default* route on mobile data. A plain
 * fetch('http://192.168.4.1:8080/...') therefore leaves over the cellular
 * interface and times out. The pod is up, the AP is up, the phone is
 * associated, and the request still fails.
 *
 * The symptom is indistinguishable from a dead server, which is why this costs
 * a day if it is hit cold. It is why `explainNetworkFailure` below exists: a
 * timeout against a link-local address gets named, not guessed at.
 *
 * ── The fix, and what it needs ───────────────────────────────────────────────
 * ConnectivityManager.requestNetwork() with a NetworkRequest specifying
 * TRANSPORT_WIFI and *without* NET_CAPABILITY_INTERNET, then binding the
 * process (or the individual socket) to the Network handed back in the
 * callback. That is Java/Kotlin — it cannot be done from JS, and it cannot run
 * in Expo Go. It needs a small native module plus a config plugin, and an
 * `expo run:android` dev build.
 *
 * That module is not written yet. This file does not pretend otherwise: it
 * exposes the interface the rest of the app codes against, ships a no-op
 * implementation, and reports `bound: false` so the sync screen can say plainly
 * that the binding is unavailable rather than silently failing later.
 *
 * ── iOS ──────────────────────────────────────────────────────────────────────
 * iOS routes to the local subnet correctly on its own, but requires
 * NSLocalNetworkUsageDescription in Info.plist (set in app.json) and will
 * prompt the user the first time. Denied permission also surfaces as a
 * connection failure with no clear message, so it is named below too.
 */

import { Platform } from 'react-native';

export type BindResult = {
  bound: boolean;
  /** Why binding did not happen. Shown in the sync screen, not swallowed. */
  reason?: string;
};

/**
 * Binds subsequent requests to the joined WiFi network.
 *
 * Currently a no-op on both platforms. On iOS that is correct — the OS already
 * routes local-subnet traffic properly. On Android it is a known gap, reported
 * honestly rather than hidden.
 */
export async function bindToLocalWifi(): Promise<BindResult> {
  if (Platform.OS === 'ios') {
    return { bound: true, reason: 'iOS routes local-subnet traffic without binding' };
  }
  if (Platform.OS === 'android') {
    return {
      bound: false,
      reason:
        'Android network binding is not implemented yet. Requests may route over ' +
        'mobile data and time out. Needs the ConnectivityManager native module ' +
        '(see src/sync/network.ts) and an expo run:android dev build.',
    };
  }
  return { bound: false, reason: `no binding strategy for platform ${Platform.OS}` };
}

/** Releases the binding so normal traffic resumes. No-op while unbound. */
export async function releaseLocalWifi(): Promise<void> {
  // Intentionally empty until the native module exists. Kept so call sites are
  // already correct and the eventual implementation is a one-file change.
}

const LINK_LOCAL = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|localhost|127\.)/i;

/**
 * Turns a network error into the most likely cause.
 *
 * Guessing is fine here as long as the guess is labelled as one — the point is
 * to stop a developer or a farmer concluding "the pod is broken" when the
 * actual answer is a routing default or a permissions prompt.
 */
export function explainNetworkFailure(err: unknown, url: string): string {
  const message = err instanceof Error ? err.message : String(err);
  const isLocal = LINK_LOCAL.test(url);
  const timedOut = /abort|timeout|timed out/i.test(message);

  if (isLocal && timedOut && Platform.OS === 'android') {
    return (
      'Timed out reaching the pod. On Android this usually means the ' +
      'request went out over mobile data instead of the WiFi you joined. The ' +
      'network has no internet, so Android keeps the default route on cellular. ' +
      'Turning mobile data off is a workaround; the fix is the network binding ' +
      'described in src/sync/network.ts.'
    );
  }
  if (isLocal && Platform.OS === 'ios') {
    return (
      'Could not reach the pod. If iOS has not prompted for local ' +
      'network access, or it was denied, allow it in Settings > Privacy > ' +
      'Local Network. A denied prompt looks exactly like an unreachable server. ' +
      `(${message})`
    );
  }
  if (isLocal) {
    return (
      'Could not reach the pod. Check the phone is joined to the SIH-FIELD ' +
      `network and the pod is switched on. (${message})`
    );
  }
  return message;
}
