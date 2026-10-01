/**
 * The app-wide language setting, chosen on the Profile screen.
 *
 * Saved in the phone's own database so it survives a restart, and applied
 * before the first screen draws so the app never flashes English at a farmer
 * who picked Hindi. Screens call `useLanguage()`; that subscription is what
 * re-renders them, and everything they render picks up the new language
 * through `tr()`.
 */

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { getState, setState } from '../db/client.ts';
import { setCurrentLanguage } from './tr.ts';
import type { AppLanguage } from './tr.ts';

type LanguageContext = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const Ctx = createContext<LanguageContext>({ language: 'en', setLanguage: () => {} });

/** Reads the saved choice. Call once at start-up, before rendering. */
export async function loadSavedLanguage(): Promise<AppLanguage> {
  const saved = await getState('app_language');
  const language: AppLanguage = saved === 'hi' ? 'hi' : 'en';
  setCurrentLanguage(language);
  return language;
}

export function LanguageProvider({
  initial,
  children,
}: {
  initial: AppLanguage;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(initial);

  const setLanguage = useCallback((next: AppLanguage) => {
    // Module state first, so the re-render this triggers already reads it.
    setCurrentLanguage(next);
    setLanguageState(next);
    void setState('app_language', next);
  }, []);

  return <Ctx.Provider value={{ language, setLanguage }}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageContext {
  return useContext(Ctx);
}
