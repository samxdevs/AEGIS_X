/**
 * The app-wide light/dark choice, made on the Profile screen.
 *
 * Saved in the phone's own database like the language, and applied before the
 * first screen draws so a farmer who chose dark never gets a white flash.
 * `useScheme()` is what re-renders a screen when the choice changes; the tokens
 * in theme.ts then answer with the new palette. `useLanguage()` subscribes to
 * this too, so every screen that already re-renders for a language change
 * re-renders for a theme change without being touched.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

import { getState, setState } from '../db/client.ts';
import { setActiveScheme } from './theme.ts';
import type { Scheme } from './theme.ts';

type SchemeContext = {
  scheme: Scheme;
  setScheme: (scheme: Scheme) => void;
};

const Ctx = createContext<SchemeContext>({ scheme: 'light', setScheme: () => {} });

/** Reads the saved choice. Call once at start-up, before rendering. */
export async function loadSavedScheme(): Promise<Scheme> {
  const saved = await getState('app_theme');
  const scheme: Scheme = saved === 'dark' ? 'dark' : 'light';
  setActiveScheme(scheme);
  return scheme;
}

export function ThemeProvider({ initial, children }: { initial: Scheme; children: ReactNode }) {
  const [scheme, setSchemeState] = useState<Scheme>(initial);

  const setScheme = useCallback((next: Scheme) => {
    // Module state first, so the re-render this triggers already reads it.
    setActiveScheme(next);
    setSchemeState(next);
    void setState('app_theme', next);
  }, []);

  // A switch dips to 55% and settles back, so the new palette arrives as a
  // soft change rather than a flash. Skipped on first mount.
  const fade = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    fade.setValue(0.55);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [scheme, fade]);

  return (
    <Ctx.Provider value={{ scheme, setScheme }}>
      <Animated.View style={{ flex: 1, opacity: fade }}>{children}</Animated.View>
    </Ctx.Provider>
  );
}

export function useScheme(): SchemeContext {
  return useContext(Ctx);
}
