/**
 * The pod's health, polled while a screen is in front of the farmer.
 *
 * Feeds the "Pod ready" line on Home. `pod_ready` is the pod's own statement that
 * the gateway is up and the camera and engine are available, which is the only
 * thing that says a scan can be started; a pod that merely answers is not the
 * same as one that is ready.
 */

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { probeHealth } from '../sync/client.ts';
import type { Health } from '../sync/client.ts';

export type PodLink =
  | { kind: 'checking' }
  | { kind: 'unreachable'; message: string }
  | { kind: 'starting'; health: Health }
  | { kind: 'ready'; health: Health };

/** How often Home asks. Slow enough to leave the pod's one radio alone. */
const POLL_MS = 5000;

export function usePodLink(): PodLink {
  const [link, setLink] = useState<PodLink>({ kind: 'checking' });
  const inFlight = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const check = async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
          const health = await probeHealth();
          if (alive) setLink({ kind: health.pod_ready === true ? 'ready' : 'starting', health });
        } catch (err) {
          if (alive) setLink({ kind: 'unreachable', message: err instanceof Error ? err.message : String(err) });
        } finally {
          inFlight.current = false;
        }
      };
      void check();
      const timer = setInterval(() => void check(), POLL_MS);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, []),
  );

  return link;
}
