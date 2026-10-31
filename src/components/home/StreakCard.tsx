import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COPY } from '../../lib/coach';
import { typography } from '../../constants/typography';
import { HOME_COLORS } from './homeColors';

export interface WeekDay {
  /** "M". */
  letter: string;
  /** "Monday", for screen readers. */
  name: string;
  practiced: boolean;
  isToday: boolean;
}

interface StreakCardProps {
  streak: number;
  questionsToday: number;
  dailyGoal: number;
  week: WeekDay[];
  isDark: boolean;
  cardColor: string;
  textColor: string;
  subtleColor: string;
}

/** Streak, today's count against the goal, and this week's practised days (Mon–Sun). */
export function StreakCard({
  streak,
  questionsToday,
  dailyGoal,
  week,
  isDark,
  cardColor,
  textColor,
  subtleColor,
}: StreakCardProps) {
  const emptyDay = isDark ? 'rgba(255, 255, 255, 0.08)' : HOME_COLORS.emptyDay;
  const todayRing = isDark ? '#F1ECE9' : HOME_COLORS.ink;

  return (
    <View style={[styles.card, { backgroundColor: cardColor }]}>
      <View style={styles.topRow}>
        <View style={styles.streak} accessible accessibilityLabel={COPY.dayStreak(streak)}>
          <Ionicons name="flame" size={18} color={isDark ? '#FB923C' : HOME_COLORS.flame} />
          <Text style={[styles.streakText, { color: textColor }]}>{COPY.dayStreak(streak)}</Text>
        </View>
        <Text
          style={[styles.today, { color: subtleColor }]}
          accessibilityLabel={COPY.questionsTodayLabel(questionsToday, dailyGoal)}
        >
          <Text style={[styles.todayCount, { color: textColor }]}>{questionsToday}</Text>{' '}
          {COPY.ofGoalToday(dailyGoal)}
        </Text>
      </View>

      <View style={styles.week}>
        {week.map((day) => (
          <View
            key={day.name}
            style={styles.day}
            accessible
            accessibilityLabel={COPY.weekDayLabel(day.name, day.practiced, day.isToday)}
          >
            <Text style={[styles.dayLetter, { color: subtleColor }]}>{day.letter}</Text>
            <View
              style={[
                styles.dot,
                { backgroundColor: day.practiced ? HOME_COLORS.green : emptyDay },
                day.isToday && { borderWidth: 3, borderColor: todayRing },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  streakText: {
    ...typography.button,
  },
  today: {
    ...typography.secondary,
  },
  todayCount: {
    ...typography.button,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  day: {
    alignItems: 'center',
    gap: 6,
    minWidth: 28,
  },
  dayLetter: {
    ...typography.caption,
    fontWeight: '600',
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
});
