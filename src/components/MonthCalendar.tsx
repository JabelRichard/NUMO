import React, { useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../constants/typography';
import { MONTH_NAMES, WEEKDAY_NAMES } from '../lib/coach';
import { localDayKey, monthGrid } from '../utils/localDates';

const DAY_SIZE = 34;
const ARROW_SIZE = 44;

export interface MonthCalendarColors {
  text: string;
  subtle: string;
  /** Practised days. */
  accent: string;
  /** Today's ring. */
  accentStrong: string;
  onAccent: string;
}

interface MonthCalendarProps {
  year: number;
  /** 0–11. */
  month: number;
  today: Date;
  /** "YYYY-MM-DD" of every day with a workout. */
  practicedDays: Set<string>;
  canGoBack: boolean;
  /** False on the current month: there's nothing after it to show. */
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  colors: MonthCalendarColors;
  style?: StyleProp<ViewStyle>;
}

/**
 * The days practised in one month, Monday first. Only counts what was done; it never
 * compares months. Changing month slides the days in, still with Reduce Motion on.
 */
export function MonthCalendar({
  year,
  month,
  today,
  practicedDays,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  colors,
  style,
}: MonthCalendarProps) {
  const weeks = monthGrid(year, month);
  const todayKey = localDayKey(today);
  const monthName = `${MONTH_NAMES[month]}${year === today.getFullYear() ? '' : ` ${year}`}`;
  const practicedCount = weeks.flat().filter((d) => d && practicedDays.has(d.key)).length;
  const title =
    practicedCount === 0
      ? `No days practised in ${monthName}`
      : `${practicedCount} ${practicedCount === 1 ? 'day' : 'days'} practised in ${monthName}`;

  // Older months come in from the left, newer from the right.
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const direction = useSharedValue(0);
  const shown = useRef(year * 12 + month);
  useEffect(() => {
    const index = year * 12 + month;
    if (index === shown.current) return;
    direction.value = index < shown.current ? -1 : 1;
    shown.current = index;
    if (reduceMotion) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [year, month, reduceMotion, progress, direction]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 16 * direction.value }],
  }));

  const previous = MONTH_NAMES[(month + 11) % 12];
  const next = MONTH_NAMES[(month + 1) % 12];

  return (
    <View style={style}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.arrows}>
          {canGoBack ? (
            <TouchableOpacity
              style={styles.arrow}
              onPress={onBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Previous month, ${previous}`}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.arrow} />
          )}
          {canGoForward ? (
            <TouchableOpacity
              style={styles.arrow}
              onPress={onForward}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Next month, ${next}`}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.arrow} />
          )}
        </View>
      </View>

      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAY_NAMES.map((name, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.subtle }]} maxFontSizeMultiplier={1.2}>
            {name[0]}
          </Text>
        ))}
      </View>

      <Animated.View style={[styles.weeks, animatedStyle]}>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const practiced = practicedDays.has(day.key);
              const isToday = day.key === todayKey;
              const isFuture = day.key > todayKey;
              const label = [
                `${MONTH_NAMES[month]} ${day.date}`,
                isToday && 'today',
                !isFuture && (practiced ? 'practised' : 'not practised'),
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <View key={day.key} style={styles.cell} accessible accessibilityLabel={label}>
                  <View
                    style={[
                      styles.day,
                      practiced && { backgroundColor: colors.accent },
                      isToday && { borderWidth: 2, borderColor: colors.accentStrong },
                    ]}
                  >
                    <Text
                      style={[
                        styles.date,
                        {
                          color: practiced ? colors.onAccent : isFuture ? colors.subtle : colors.text,
                          opacity: isFuture ? 0.5 : 1,
                          fontWeight: practiced || isToday ? '700' : '500',
                        },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {day.date}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    ...typography.button,
    flex: 1,
  },
  arrows: {
    flexDirection: 'row',
    // The arrows' touch area reaches past the card's padding, not the title.
    marginRight: -10,
  },
  arrow: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeks: {
    gap: 4,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    ...typography.caption,
    flex: 1,
    textAlign: 'center',
    marginBottom: 6,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    ...typography.caption,
  },
});
