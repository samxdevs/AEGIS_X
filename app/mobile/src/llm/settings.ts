/**
 * The LLM provider and key, as chosen on the Profile screen.
 *
 * Saved in the phone's own database, loaded once at start-up, and held in module
 * state so `isConfigured()` can stay synchronous, the explanation card asks it
 * on every render. `useLlmSettings()` is what makes screens re-render when it
 * changes, so saving a key on Profile is enough for the advisory screen to start
 * offering the explanation, without a restart.
 *
 * The key never leaves this phone except in the request to the provider the
 * person chose. It sits in the app's private storage, not in the source, not in
 * the build, and not in the pod sync.
 */

import { useSyncExternalStore } from 'react';

import { getState, setState } from '../db/client.ts';
import { NO_SETTINGS, getProvider, parseSettings } from './providers.ts';
import type { LlmSettings, ProviderId, ProviderSettings } from './providers.ts';

let current: LlmSettings = NO_SETTINGS;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/** Reads the saved choice. Call once at start-up, before rendering. */
export async function loadLlmSettings(): Promise<void> {
  current = parseSettings(await getState('llm_settings'));
  emit();
}

export function getLlmSettings(): LlmSettings {
  return current;
}

/** Saves one provider's details and makes it the one explanations use. */
export async function saveProvider(id: ProviderId, settings: ProviderSettings): Promise<void> {
  const clean: ProviderSettings = {
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    baseUrl: settings.baseUrl.trim(),
  };
  current = { active: id, providers: { ...current.providers, [id]: clean } };
  emit();
  await setState('llm_settings', JSON.stringify(current));
}

/** Forgets one provider's key. If it was the active one, explanations switch off. */
export async function removeProvider(id: ProviderId): Promise<void> {
  const providers = { ...current.providers };
  delete providers[id];
  current = { active: current.active === id ? null : current.active, providers };
  emit();
  await setState('llm_settings', JSON.stringify(current));
}

export function useLlmSettings(): LlmSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getLlmSettings,
  );
}

/** The active provider's definition and details, if one is chosen. */
export function activeProvider(): { provider: ReturnType<typeof getProvider>; settings: ProviderSettings } | null {
  if (!current.active) return null;
  const settings = current.providers[current.active];
  return settings ? { provider: getProvider(current.active), settings } : null;
}
