import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { PALETTE } from '@/src/constants/palette';
import { typography } from '@/src/constants/typography';
import { CoachPlan, toWorkoutParams, WorkoutRequest } from '../lib/coach';
import { PopIcon } from './PopIcon';

/** Opens the workout screen for a coach request, fresh. Practice and Statistics both start here. */
export function useStartWorkout() {
  const router = useRouter();
  return (request: WorkoutRequest) =>
    router.push({
      pathname: '/workout' as any,
      params: {
        ...toWorkoutParams(request),
        reset: 'true',
        sessionKey: Date.now().toString(),
      },
    });
}

/** "Mix it up" and "Goal done for today!" use the heading; other picks show "× Multiplying · Medium". */
export const todaysPickTitle = (coach: CoachPlan) =>
  coach.message.kind === 'goal_done' || coach.message.kind === 'mix' ? coach.message.heading : coach.focusLabel;

interface TodaysPickCardProps {
  coach: CoachPlan;
  style?: StyleProp<ViewStyle>;
}

/**
 * Today's pick is Home's pick: the same title, line, button and workout.
 * Without any saved history (offline, nothing cached) the pick isn't known, so it's hidden.
 */
export function TodaysPickCard({ coach, style }: TodaysPickCardProps) {
  const { theme } = useTheme();
  const startWorkout = useStartWorkout();
  if (coach.historyUnknown) return null;

  const isDark = theme.isDark;
  const title = todaysPickTitle(coach);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? PALETTE.cardDark : PALETTE.cardLight,
          borderColor: isDark ? PALETTE.borderDark : PALETTE.borderLight,
        },
        style,
      ]}
    >
      <Text style={[styles.eyebrow, { color: theme.primaryText }]}>Today's pick</Text>
      <View style={styles.titleLine}>
        {coach.message.kind === 'goal_done' && <PopIcon name="checkmark-done" size={30} delay={200} />}
        <Text
          style={[styles.title, { color: isDark ? PALETTE.backgroundLight : PALETTE.dark }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>
      <Text style={[styles.line, { color: theme.subtext }]}>{coach.message.subheading}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        activeOpacity={0.85}
        onPress={() => startWorkout(coach.workout)}
        accessibilityRole="button"
        accessibilityLabel={`${coach.message.button}, ${title}`}
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{coach.message.button}</Text>
        <Ionicons name="arrow-forward" size={18} color={theme.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: PALETTE.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  eyebrow: {
    ...typography.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    ...typography.sectionHeading,
    letterSpacing: -0.4,
    flexShrink: 1,
    marginBottom: 4,
  },
  line: {
    ...typography.secondary,
    marginBottom: 16,
  },
  button: {
    minHeight: 54,
    borderRadius: 27,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    ...typography.button,
    textAlign: 'center',
    flexShrink: 1,
  },
});
