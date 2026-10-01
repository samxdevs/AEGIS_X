/**
 * The history screen's inverted band paints behind the status bar; every other
 * screen is on the light ground. A single <StatusBar> at the root cannot serve
 * both, and the component form does not re-apply on navigation because screens
 * stay mounted in the stack. So each screen declares what it needs on focus.
 */

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import type { StatusBarStyle } from 'expo-status-bar';

export function useStatusBarStyle(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
    }, [style]),
  );
}
