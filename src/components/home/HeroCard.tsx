import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CoachOperation } from '../../lib/coach';
import { FONT_FAMILY, typography } from '../../constants/typography';
import { PopIcon } from '../PopIcon';
import { HOME_COLORS } from './homeColors';
import { OperationGlyph } from './OperationGlyph';
import { ProgressRing } from './ProgressRing';

// Faint sums in the background; decoration only.
const SNIPPETS: { text: string; style: object }[] = [
  { text: '7×8', style: { top: '14%', left: '7%', transform: [{ rotate: '-8deg' }] } },
  { text: '12×4', style: { top: '28%', right: '6%', transform: [{ rotate: '10deg' }] } },
  { text: '9×6', style: { bottom: '30%', left: '9%', transform: [{ rotate: '6deg' }] } },
  { text: '56', style: { bottom: '33%', right: '12%', transform: [{ rotate: '-6deg' }] } },
];

interface HeroCardProps {
  operation: CoachOperation;
  /** Level, question count, minutes. */
  chips: string[];
  /** Today's questions against the goal, 0 to 1. */
  progress: number;
  /** Green normally, lilac once the goal is done. */
  accent: string;
  buttonText: string;
  accessibilityLabel: string;
  goalDone: boolean;
  onPress: () => void;
}

/** The whole card is the start button. */
export function HeroCard({
  operation,
  chips,
  progress,
  accent,
  buttonText,
  accessibilityLabel,
  goalDone,
  onPress,
}: HeroCardProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.shadow, pressStyle]}>
      <Pressable
        style={styles.card}
        onPress={onPress}
        onPressIn={() => {
          scale.set(withTiming(0.98, { duration: 110 }));
        }}
        onPressOut={() => {
          scale.set(withTiming(1, { duration: 160 }));
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <View
          style={styles.decor}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {SNIPPETS.map((s) => (
            <Text key={s.text} style={[styles.snippet, s.style]}>
              {s.text}
            </Text>
          ))}
        </View>

        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ringWrap}>
          <ProgressRing progress={progress} color={accent}>
            <View style={[styles.glyphCircle, { backgroundColor: accent }]}>
              <OperationGlyph type={operation} size={44} color={HOME_COLORS.ink} />
            </View>
          </ProgressRing>
          {goalDone && (
            <PopIcon
              name="checkmark-done"
              size={36}
              delay={300}
              backgroundColor={HOME_COLORS.lilac}
              color={HOME_COLORS.ink}
              style={styles.doneBadge}
            />
          )}
        </View>

        <View style={[styles.button, { backgroundColor: accent }]}>
          <Text style={styles.buttonText}>{buttonText}</Text>
          <Ionicons name="arrow-forward" size={20} color={HOME_COLORS.ink} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    flex: 1,
    minHeight: 210,
    borderRadius: 32,
    backgroundColor: HOME_COLORS.ink,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  card: {
    flex: 1,
    borderRadius: 32,
    padding: 18,
    justifyContent: 'space-between',
  },
  decor: {
    ...StyleSheet.absoluteFill,
    borderRadius: 32,
    overflow: 'hidden',
  },
  snippet: {
    position: 'absolute',
    fontFamily: FONT_FAMILY.heading,
    fontWeight: '800',
    fontSize: 24,
    color: '#FFFFFF',
    opacity: 0.1,
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
    color: '#F1ECE9',
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  glyphCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadge: {
    position: 'absolute',
    top: -4,
    left: '50%',
    marginLeft: 34,
  },
  button: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    ...typography.button,
    fontSize: 16,
    color: HOME_COLORS.ink,
  },
});
