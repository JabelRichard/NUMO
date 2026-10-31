import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export const RISE_STEP_MS = 60;

interface RiseProps {
  /** Position in the stagger: waits index × 60ms. */
  index: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Fades in and rises 12px once, when it mounts. Still with Reduce Motion on. */
export function Rise({ index, style, children }: RiseProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      index * RISE_STEP_MS,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) })
    );
  }, [index, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
