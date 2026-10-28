import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { PALETTE } from '@/src/constants/palette';
import { WEAK_SPOTS } from '@/src/constants/planOptions';
import { typography, MAX_FONT_SCALE } from '@/src/constants/typography';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import { useToday } from '@/src/hooks/useToday';
import { OfflineNote } from '@/src/components/OfflineNote';
import { TodaysPickCard } from '@/src/components/TodaysPickCard';
import {
  COACH_LOAD_TIMEOUT_MS,
  LoadedCoachData,
  loadCoachDataWithFallback,
} from '../../src/services/coachService';
import { getTrainingGoals } from '../../src/services/profileService';
import {
  CoachWorkout,
  COPY,
  getCoachPlan,
  getProgressSummary,
  LEVEL_NAMES,
  LevelRow,
  levelProgressText,
  lifetimeTotals,
  operationSymbol,
  progressText,
  STRONG_ACCURACY,
  workoutDayLabel,
} from '../../src/lib/coach';
import { DEFAULT_TRAINING_GOALS } from '../../src/types/profile';
import { countDayStreak, localDayKey, startOfLocalWeek } from '../../src/utils/localDates';
import { withTimeout } from '../../src/utils/withTimeout';

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Calendar card padding on each side; small so 7 day cells stay 44pt wide on a 360pt phone.
const CALENDAR_PADDING = 8;
const MAX_CONTENT_WIDTH = 480;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** "Tuesday, October 28". */
function dayTitle(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${WEEKDAY_NAMES[new Date(y, m - 1, d).getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

interface DayCell {
  day: number;
  key: string;
}

/** Weeks of the month, Monday first; null pads the first and last week. */
function monthGrid(year: number, month: number): (DayCell | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (DayCell | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, key: localDayKey(new Date(year, month, day, 12)) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function StatisticsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  // Opened from Profile's "View Full Statistics": back goes to Profile. As a tab: no back button.
  const openedFromProfile = from === 'profile';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isOffline, recheck } = useOnlineStatus(() => loadScreenData());
  const today = useToday();
  const todayKey = localDayKey(today);

  const isDark = theme.isDark;
  const isNarrow = width < 360;
  const gutter = isNarrow ? 16 : 20;

  const [loaded, setLoaded] = useState<LoadedCoachData | null>(null);
  const [weeklyTarget, setWeeklyTarget] = useState(DEFAULT_TRAINING_GOALS.weeklyFrequencyDays);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const [selectedKey, setSelectedKey] = useState<string | null>(todayKey);
  // Only the newest load may update the screen.
  const loadIdRef = useRef(0);

  // Same data as Home and Practice: live, else the cached copy, else the plan saved on this phone.
  // The weekly target comes from the plan in Supabase, like Profile (the phone's copy offline).
  const loadScreenData = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const loadId = ++loadIdRef.current;
    const online = await recheck();
    const [next, goals] = await Promise.all([
      loadCoachDataWithFallback(userId, online),
      (online ? withTimeout(getTrainingGoals(userId), COACH_LOAD_TIMEOUT_MS) : getTrainingGoals())
        .catch(() => getTrainingGoals())
        .catch(() => null),
    ]);
    if (loadId !== loadIdRef.current) return;
    setLoaded(next);
    if (goals?.weeklyFrequencyDays) setWeeklyTarget(goals.weeklyFrequencyDays);
  }, [user?.id, recheck]);

  const goBackToProfile = useCallback(() => router.navigate('/(app)/Profile'), [router]);

  useFocusEffect(
    useCallback(() => {
      loadScreenData();
      // Android back follows the same rule as the back button.
      const backHandler = openedFromProfile
        ? BackHandler.addEventListener('hardwareBackPress', () => {
            goBackToProfile();
            return true;
          })
        : null;
      return () => {
        backHandler?.remove();
        // Leaving the screen: opened again from the tab bar, it has no back button.
        if (openedFromProfile) navigation.setParams({ from: undefined } as never);
      };
    }, [loadScreenData, openedFromProfile, goBackToProfile, navigation])
  );

  // A new day (after midnight, or back in the app): jump to it.
  useEffect(() => {
    const now = new Date();
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedKey(localDayKey(now));
  }, [todayKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadScreenData();
    } finally {
      setRefreshing(false);
    }
  };

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const primaryText = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const secondaryText = theme.subtext;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const fillBg = isDark ? PALETTE.fillDark : PALETTE.fillLight;
  // One sage accent, same as Home, Practice, Profile and Results.
  const accent = theme.primary;
  const accentStrong = theme.primaryText;
  const accentSoft = theme.primarySoft;

  // Without the history (offline, nothing cached) there's nothing true to show yet.
  const historyUnknown = loaded?.from === 'phone';
  const workouts = useMemo(() => loaded?.data.workouts ?? [], [loaded]);

  // Same coach as Home, Practice and Results, so Today's pick matches.
  const coach = useMemo(
    () => (loaded ? getCoachPlan(loaded.data.plan, workouts, today, { historyUnknown }) : null),
    [loaded, workouts, today, historyUnknown]
  );
  const summary = useMemo(
    () => (loaded && !historyUnknown ? getProgressSummary(loaded.data.plan, workouts, today) : null),
    [loaded, workouts, today, historyUnknown]
  );
  const lifetime = useMemo(() => loaded?.data.lifetime ?? lifetimeTotals(workouts), [loaded, workouts]);

  /** Workouts per local day, oldest first within a day. */
  const workoutsByDay = useMemo(() => {
    const map = new Map<string, CoachWorkout[]>();
    const sorted = [...workouts]
      .filter((w) => w.completed_at)
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
    for (const w of sorted) {
      const key = localDayKey(w.completed_at);
      map.set(key, [...(map.get(key) ?? []), w]);
    }
    return map;
  }, [workouts]);

  const streak = useMemo(() => countDayStreak(workouts.map((w) => w.completed_at), today), [workouts, today]);
  const daysThisWeek = useMemo(() => {
    const weekStart = localDayKey(startOfLocalWeek(today));
    return [...workoutsByDay.keys()].filter((key) => key >= weekStart && key <= todayKey).length;
  }, [workoutsByDay, today, todayKey]);

  // ---- Calendar ----
  const { year: calYear, month: calMonth } = viewMonth;
  const isCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();
  const weeks = useMemo(() => monthGrid(calYear, calMonth), [calYear, calMonth]);
  const calendarWidth = Math.min(width - gutter * 2, MAX_CONTENT_WIDTH) - CALENDAR_PADDING * 2;
  const cellWidth = Math.floor(calendarWidth / 7);
  const dotSize = Math.min(cellWidth - 4, 40);

  const showMonth = (offset: number) => {
    const next = new Date(calYear, calMonth + offset, 1);
    setViewMonth({ year: next.getFullYear(), month: next.getMonth() });
    const showsToday = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth();
    setSelectedKey(showsToday ? todayKey : null);
  };

  const selectedWorkouts = selectedKey ? workoutsByDay.get(selectedKey) ?? [] : [];

  // ---- Pieces ----

  const renderHeader = () => (
    <View style={styles.header}>
      {openedFromProfile && (
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: cardBg, borderColor: borderSubtle }]}
          onPress={goBackToProfile}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
        >
          <Ionicons name="arrow-back" size={20} color={primaryText} />
        </TouchableOpacity>
      )}
      <Text
        style={[styles.screenTitle, { color: primaryText }]}
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE.screenTitle}
      >
        Your progress
      </Text>
    </View>
  );

  const card = [styles.card, { backgroundColor: cardBg, borderColor: borderSubtle }];

  const renderStatRow = (icon: React.ComponentProps<typeof Ionicons>['name'], value: string, label: string) => (
    <View style={styles.statRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.statIcon, { backgroundColor: accentSoft }]}>
        <Ionicons name={icon} size={20} color={accentStrong} />
      </View>
      <View style={styles.statText}>
        <Text style={[styles.statValue, { color: primaryText }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: secondaryText }]}>{label}</Text>
      </View>
    </View>
  );

  const renderSummary = () => (
    <View style={card}>
      {renderStatRow('flame-outline', streak > 0 ? `${plural(streak, 'day')} in a row` : 'Practice today to start one', 'Current streak')}
      <View style={[styles.divider, { backgroundColor: borderSubtle }]} />
      {renderStatRow('calendar-outline', `${daysThisWeek} of ${plural(weeklyTarget, 'day')}`, 'This week')}
      <View style={[styles.divider, { backgroundColor: borderSubtle }]} />
      {renderStatRow('checkmark-done-outline', lifetime.questions.toLocaleString(), 'Questions answered')}
    </View>
  );

  const renderCalendar = () => (
    <View style={[card, styles.calendarCard]}>
      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={() => showMonth(-1)}
          style={[styles.iconButton, { backgroundColor: fillBg, borderColor: 'transparent' }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={20} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: primaryText }]} accessibilityRole="header">
          {MONTH_NAMES[calMonth]} {calYear}
        </Text>
        <TouchableOpacity
          onPress={() => showMonth(1)}
          disabled={isCurrentMonth}
          style={[
            styles.iconButton,
            { backgroundColor: fillBg, borderColor: 'transparent', opacity: isCurrentMonth ? 0.35 : 1 },
          ]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: isCurrentMonth }}
        >
          <Ionicons name="chevron-forward" size={20} color={primaryText} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEK_DAYS.map((label, i) => (
          <Text key={i} style={[styles.weekDay, { width: cellWidth, color: secondaryText }]} maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} style={styles.weekRow}>
          {week.map((cell, i) => {
            if (!cell) return <View key={i} style={{ width: cellWidth, minHeight: 44 }} />;
            const practiced = workoutsByDay.has(cell.key);
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selectedKey;
            const label = `${MONTH_NAMES[calMonth]} ${cell.day}, ${practiced ? 'practiced' : 'not practiced'}${
              isToday ? ', today' : ''
            }`;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dayCell, { width: cellWidth }]}
                onPress={() => setSelectedKey(cell.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
              >
                <View
                  style={[
                    styles.dayDot,
                    {
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: isSelected ? primaryText : practiced ? accent : 'transparent',
                      borderWidth: isToday && !isSelected ? 2 : 0,
                      borderColor: accentStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: isSelected ? screenBg : practiced ? theme.onPrimary : primaryText,
                        fontWeight: isSelected || practiced || isToday ? '600' : '400',
                      },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {cell.day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <View style={[styles.dayDetails, { borderTopColor: borderSubtle }]} accessibilityLiveRegion="polite">
        {selectedKey ? (
          <>
            <Text style={[styles.dayTitle, { color: primaryText }]}>{dayTitle(selectedKey)}</Text>
            {selectedWorkouts.length === 0 ? (
              <Text style={[styles.dayLine, { color: secondaryText }]}>No practice this day.</Text>
            ) : (
              selectedWorkouts.map((w, i) => (
                <Text key={w.id ?? `${w.completed_at}-${i}`} style={[styles.dayLine, { color: secondaryText }]}>
                  {workoutDayLabel(w)}
                </Text>
              ))
            )}
          </>
        ) : (
          <Text style={[styles.dayLine, { color: secondaryText }]}>Tap a day to see its workouts.</Text>
        )}
      </View>
    </View>
  );

  const renderLevelRow = (row: LevelRow, index: number) => {
    const name = WEAK_SPOTS.find((s) => s.id === row.operation)?.title ?? row.operation;
    const level = LEVEL_NAMES[row.level];
    const accuracyLine = !row.tried
      ? null
      : row.accuracy === null
        ? COPY.newLevel
        : `${Math.round(row.accuracy)}% correct lately`;
    const nextLine = levelProgressText(row);
    const label = [name, `level ${level}`, row.mastered ? 'mastered' : null, accuracyLine, nextLine]
      .filter(Boolean)
      .join(', ');

    return (
      <React.Fragment key={row.operation}>
        {index > 0 && <View style={[styles.divider, { backgroundColor: borderSubtle }]} />}
        <View style={styles.levelRow} accessible accessibilityLabel={label}>
          <View style={[styles.badge, { backgroundColor: accentSoft }]}>
            <Text style={[styles.badgeSymbol, { color: accentStrong }]} maxFontSizeMultiplier={1.3}>
              {operationSymbol(row.operation)}
            </Text>
          </View>
          <View style={styles.levelText}>
            <View style={styles.levelTitleLine}>
              <Text style={[styles.levelName, { color: primaryText }]}>{name}</Text>
              <Text style={[styles.levelName, { color: primaryText }]}>{level}</Text>
            </View>
            {row.mastered && <Text style={[styles.levelMastered, { color: accentStrong }]}>✓ Mastered</Text>}
            {accuracyLine && <Text style={[styles.levelLine, { color: secondaryText }]}>{accuracyLine}</Text>}
            <Text style={[styles.levelLine, { color: secondaryText }]}>{nextLine}</Text>
          </View>
        </View>
      </React.Fragment>
    );
  };

  const renderLevels = () =>
    summary && (
      <>
        <Text style={[styles.sectionHeading, { color: primaryText }]} accessibilityRole="header">
          Your levels
        </Text>
        <Text style={[styles.sectionNote, { color: secondaryText }]}>
          A strong round is {STRONG_ACCURACY}% correct or more.
        </Text>
        <View style={card}>{summary.levels.map(renderLevelRow)}</View>
      </>
    );

  const renderProgress = () => {
    if (!summary) return null;
    const { headline, detail } = progressText(summary.highlight);
    return (
      <View style={card} accessible>
        <Text style={[styles.cardEyebrow, { color: accentStrong }]}>How you're doing</Text>
        <Text style={[styles.progressHeadline, { color: primaryText }]}>{headline}</Text>
        {detail && <Text style={[styles.dayLine, { color: secondaryText }]}>{detail}</Text>}
      </View>
    );
  };

  const renderRecords = () => (
    <>
      <Text style={[styles.sectionHeading, { color: primaryText }]} accessibilityRole="header">
        Records
      </Text>
      <View style={card}>
        {renderStatRow('trophy-outline', plural(lifetime.longestStreak, 'day'), 'Longest streak')}
        <View style={[styles.divider, { backgroundColor: borderSubtle }]} />
        {renderStatRow('star-outline', lifetime.perfectRounds.toLocaleString(), 'Perfect rounds (all correct)')}
        <View style={[styles.divider, { backgroundColor: borderSubtle }]} />
        {renderStatRow('barbell-outline', lifetime.workouts.toLocaleString(), 'Workouts done')}
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 20) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accentStrong}
            colors={[accentStrong]}
            progressBackgroundColor={cardBg}
          />
        }
      >
        <View style={styles.responsiveWrapper}>
          {renderHeader()}

          {!loaded || !coach ? (
            <ActivityIndicator style={styles.loading} size="large" color={accentStrong} />
          ) : (
            <View style={styles.sections}>
              <OfflineNote from={loaded.from} isOffline={isOffline} />

              {historyUnknown ? (
                <View style={card}>
                  <Text style={[styles.progressHeadline, { color: primaryText }]}>
                    Your progress will show here once you're back online.
                  </Text>
                </View>
              ) : (
                <>
                  {renderSummary()}
                  {renderCalendar()}
                  {renderLevels()}
                  {renderProgress()}
                  <TodaysPickCard coach={coach} />
                  {renderRecords()}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  screenTitle: {
    ...typography.screenTitle,
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    marginTop: 48,
  },
  sections: {
    gap: 16,
  },
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
  divider: {
    height: 1,
    marginVertical: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statText: {
    flex: 1,
  },
  statValue: {
    ...typography.button,
  },
  statLabel: {
    ...typography.secondary,
  },
  calendarCard: {
    paddingHorizontal: CALENDAR_PADDING,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  monthLabel: {
    ...typography.sectionHeading,
    flexShrink: 1,
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  weekDay: {
    ...typography.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  dayCell: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    ...typography.secondary,
    textAlign: 'center',
  },
  dayDetails: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  dayTitle: {
    ...typography.button,
  },
  dayLine: {
    ...typography.secondary,
  },
  sectionHeading: {
    ...typography.button,
    marginTop: 8,
    marginBottom: -8,
  },
  sectionNote: {
    ...typography.secondary,
    marginBottom: -4,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inter Tight, like the symbols on Practice and onboarding.
  badgeSymbol: {
    ...typography.sectionHeading,
    fontWeight: '700',
    textAlign: 'center',
  },
  levelText: {
    flex: 1,
    gap: 2,
  },
  levelTitleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  levelName: {
    ...typography.button,
  },
  levelMastered: {
    ...typography.secondary,
    fontWeight: '600',
  },
  levelLine: {
    ...typography.secondary,
  },
  cardEyebrow: {
    ...typography.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressHeadline: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 4,
  },
});
