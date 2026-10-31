import React, { ComponentProps, useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { PALETTE } from '../constants/palette';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface PopIconProps {
  name: IconName;
  /** Width and height of the disc; the icon is a bit over half of it. */
  size?: number;
  backgroundColor?: string;
  color?: string;
  /** Wait before popping, to line up with other entrances. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * An icon in a sage disc that pops in once and gives a small wiggle. Used for good
 * news (goal done, level up, mastered) in place of emoji. Still with Reduce Motion on.
 */
export function PopIcon({
  name,
  size = 56,
  backgroundColor = PALETTE.primary,
  color = PALETTE.onPrimary,
  delay = 0,
  style,
}: PopIconProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.4);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 180 }));
    rotate.value = withDelay(
      delay + 150,
      withSequence(
        withTiming(-12, { duration: 90 }),
        withTiming(10, { duration: 110 }),
        withTiming(-6, { duration: 90 }),
        withTiming(0, { duration: 90 })
      )
    );
  }, [delay, reduceMotion, rotate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        animatedStyle,
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={name} size={Math.round(size * 0.54)} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
