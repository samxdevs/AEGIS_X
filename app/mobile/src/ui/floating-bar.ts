/**
 * The floating tab bar's footprint, shared by the layout that draws it and by
 * every screen that has to leave room for it.
 *
 * The bar floats over the page rather than carving a strip out of it, so
 * content scrolls underneath. A screen therefore pads the end of its scroll
 * area by `useBarClearance()`, which is enough for the last card to rest
 * clear of the bar.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BAR_HEIGHT = 68;
/** How far the bar sits in from the left and right edges. */
export const FLOAT_SIDE = 18;
/** The gap between the bar and the gesture area. */
export const FLOAT_GAP = 10;

export function useBarClearance(): number {
  const { bottom } = useSafeAreaInsets();
  return BAR_HEIGHT + bottom + FLOAT_GAP + 20;
}
