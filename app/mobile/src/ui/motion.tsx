/**
 * The motion the app uses, kept to three things so it stays calm:
 *
 *   Reveal         a short fade and rise as a screen's sections arrive, each a
 *                  beat after the last.
 *   PressScale     a spring that sinks a card a little under the thumb.
 *   animateLayout  eases the next layout change, so a fold opening slides
 *                  rather than jumps.
 *
 * Built on RN's own Animated with the native driver, so it costs nothing on the
 * JS thread and needs no extra native module. Kept deliberately small (12 px,
 * a third of a second): it should read as the page settling, not as an effect.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, LayoutAnimation, Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

export function Reveal({ index = 0, children }: { index?: number; children: ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 340,
      delay: Math.min(index, 6) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [t, index]);

  return (
    <Animated.View
      style={{
        opacity: t,
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A card that sinks under the thumb and springs back. Takes any Pressable prop.
 * `style` is for the card; `outerStyle` is for its slot, e.g. flex in a row.
 */
export function PressScale({
  children,
  scaleTo = 0.975,
  style,
  outerStyle,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style'> & { children: ReactNode; scaleTo?: number; style?: StyleProp<ViewStyle>; outerStyle?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(v, { toValue: to, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(e) => {
        spring(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        spring(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Call just before a state change that resizes something. */
export function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}
