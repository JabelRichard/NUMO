import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { typography, MAX_FONT_SCALE } from '@/src/constants/typography';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import { useToday } from '@/src/hooks/useToday';
import { useResponsiveContentWidth } from '@/src/hooks/useResponsiveContentWidth';
import { useResponsiveTopPadding } from '@/src/hooks/useResponsiveTopPadding';
import { OfflineNote } from '@/src/components/OfflineNote';
import { PopIcon } from '@/src/components/PopIcon';
import { MonthCalendar } from '@/src/components/MonthCalendar';
import { LoadedCoachData, loadCoachDataWithFallback } from '../../src/services/coachService';
import {
  ActivityFilter,
  ActivityRange,
  formatTimeSpent,
  getActivity,
  getProgressSummary,
  LEVEL_NAMES,
  LevelRow,
  levelProgressText,
  lifetimeTotals,
  mayMissWorkouts,
  MONTH_NAMES,
  operationName,
  progressText,
} from '../../src/lib/coach';
import { CORE_OPERATIONS } from '../../src/lib/math/questionGenerator';
import { countDayStreak, localDayKey } from '../../src/utils/localDates';
import { peekSpacing } from '../../src/utils/chipPeek';

const MAX_CONTENT_WIDTH = 480;
const TOP_PADDING = 16;
const TOUCH_HEIGHT = 46;
const CHART_HEIGHT = 140;

const RANGES: { id: ActivityRange; title: string; phrase: string; current: string }[] = [
  { id: 'week', title: 'Week', phrase: 'this week', current: 'Today' },
  { id: 'month', title: 'Month', phrase: 'this month', current: 'This week' },
  { id: 'year', title: 'Year', phrase: 'this year', current: 'This month' },
];

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** "980", "1.2k", "14k": fits above a narrow bar. */
const compact = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`);

/** "October 28"; another year adds it: "October 28, 2025". */
function dayName(key: string, now: Date): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}${y === now.getFullYear() ? '' : `, ${y}`}`;
}

/** "Mastered", else the real coach level: "Easy", "Medium", "Hard". */
const levelTag = (row: LevelRow) => (row.mastered ? 'Mastered' : LEVEL_NAMES[row.level]);

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

  const isDark = theme.isDark;
  const isNarrow = width < 360;
  const gutter = isNarrow ? 16 : 20;
  // 480 on a phone, wider on a tablet.
  const contentWidth = useResponsiveContentWidth(MAX_CONTENT_WIDTH);
  // Under the safe area; more on a tablet.
  const topPadding = useResponsiveTopPadding(TOP_PADDING);

  const [loaded, setLoaded] = useState<LoadedCoachData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<ActivityRange>('week');
  const [filter, setFilter] = useState<ActivityFilter>('all');
  // The calendar's month, counted back from this one, so it stays on "this month" past midnight.
  const [monthsBack, setMonthsBack] = useState(0);
  // "All" plus one chip per operation; 0 until measured.
  const [chipContents, setChipContents] = useState<number[]>(() => Array(CORE_OPERATIONS.length + 1).fill(0));
  const [chipViewport, setChipViewport] = useState(0);
  // Only the newest load may update the screen.
  const loadIdRef = useRef(0);

  // Same data as Home and Practice: live, else the cached copy, else the plan saved on this phone.
  const loadScreenData = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const loadId = ++loadIdRef.current;
    const online = await recheck();
    const next = await loadCoachDataWithFallback(userId, online);
    if (loadId !== loadIdRef.current) return;
    setLoaded(next);
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
  // The sage accent, same as Home, Practice, Profile and Results, plus one highlight
  // for the current day / week / month in the chart.
  const accent = theme.primary;
  const accentStrong = theme.primaryText;
  const accentSoft = theme.primarySoft;
  const highlight = theme.accentPurple;

  // Without the history (offline, nothing cached) there's nothing true to show yet.
  const historyUnknown = loaded?.from === 'phone';
  const workouts = useMemo(() => loaded?.data.workouts ?? [], [loaded]);

  const summary = useMemo(
    () => (loaded && !historyUnknown ? getProgressSummary(loaded.data.plan, workouts, today) : null),
    [loaded, workouts, today, historyUnknown]
  );
  const lifetime = useMemo(() => loaded?.data.lifetime ?? lifetimeTotals(workouts), [loaded, workouts]);
  const levelByOp = useMemo(
    () => new Map((summary?.levels ?? []).map((row) => [row.operation, row])),
    [summary]
  );

  const activity = useMemo(() => getActivity(workouts, range, filter, today), [workouts, range, filter, today]);
  // Offline, the phone has only the newest workouts; say so when this range may reach past them.
  const missingOlder = useMemo(
    () => loaded?.from !== 'live' && mayMissWorkouts(workouts, lifetime.workouts, activity.start),
    [loaded, workouts, lifetime.workouts, activity.start]
  );

  const practicedDays = useMemo(
    () => new Set(workouts.filter((w) => w.completed_at).map((w) => localDayKey(w.completed_at))),
    [workouts]
  );
  const streak = useMemo(() => countDayStreak(workouts.map((w) => w.completed_at), today), [workouts, today]);

  // Back as far as the first practised day on hand; never past this month.
  const oldestMonthsBack = useMemo(() => {
    const first = [...practicedDays].sort()[0];
    if (!first) return 0;
    const [y, m] = first.split('-').map(Number);
    return Math.max(0, (today.getFullYear() - y) * 12 + today.getMonth() - (m - 1));
  }, [practicedDays, today]);
  const shownMonth = new Date(today.getFullYear(), today.getMonth() - Math.min(monthsBack, oldestMonthsBack), 1);
  const shownMonthStart = shownMonth.getTime();
  // "October"; another year adds it: "October 2025".
  const shownMonthName = `${MONTH_NAMES[shownMonth.getMonth()]}${
    shownMonth.getFullYear() === today.getFullYear() ? '' : ` ${shownMonth.getFullYear()}`
  }`;
  // Offline, like the chart: say so when this month may reach past the workouts on the phone.
  const monthMayMiss = loaded?.from !== 'live' && mayMissWorkouts(workouts, lifetime.workouts, shownMonthStart);

  const rangeInfo = RANGES.find((r) => r.id === range)!;
  const chipSpacing = useMemo(
    () => peekSpacing(chipContents, chipViewport, gutter),
    [chipContents, chipViewport, gutter]
  );

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

  // The line under the title: one plain sentence, compared within one operation and level.
  const renderProgress = () => {
    if (!summary) return null;
    const { headline, detail } = progressText(summary.highlight);
    return (
      <View style={styles.progressRow} accessible>
        {summary.highlight.kind === 'level_up' && <PopIcon name="trending-up" size={44} delay={300} />}
        <View style={styles.progress}>
          <Text style={[styles.progressHeadline, { color: primaryText }]}>{headline}</Text>
          {detail && <Text style={[styles.progressDetail, { color: secondaryText }]}>{detail}</Text>}
        </View>
      </View>
    );
  };

  const renderRangeTabs = () => (
    <View style={[styles.segments, { backgroundColor: fillBg }]} accessibilityRole="tablist">
      {RANGES.map((r) => {
        const selected = r.id === range;
        return (
          <TouchableOpacity
            key={r.id}
            style={[styles.segment, selected && { backgroundColor: cardBg, borderColor: borderSubtle }]}
            onPress={() => setRange(r.id)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.segmentText, { color: selected ? primaryText : secondaryText }]}
              maxFontSizeMultiplier={1.4}
            >
              {r.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Each chip's width without its padding, so the spacing can change without measuring again.
  const measureChip = (index: number, width: number) => {
    const content = Math.round(width - chipSpacing.padding * 2);
    setChipContents((prev) => (prev[index] === content ? prev : prev.map((w, i) => (i === index ? content : w))));
  };

  const renderChip = (index: number, id: ActivityFilter, title: string, tag?: string) => {
    const selected = id === filter;
    return (
      <TouchableOpacity
        key={id}
        onLayout={(e) => measureChip(index, e.nativeEvent.layout.width)}
        style={[
          styles.chip,
          { paddingHorizontal: chipSpacing.padding },
          selected
            ? { backgroundColor: accent, borderColor: accent }
            : { backgroundColor: 'transparent', borderColor: borderSubtle },
        ]}
        onPress={() => setFilter(id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={[title, tag && `level ${tag}`].filter(Boolean).join(', ')}
        accessibilityState={{ selected }}
      >
        {selected && <Ionicons name="checkmark" size={16} color={theme.onPrimary} />}
        <Text style={[styles.chipText, { color: selected ? theme.onPrimary : primaryText }]} maxFontSizeMultiplier={1.4}>
          {title}
        </Text>
        {tag && (
          <Text style={[styles.chipTag, { color: selected ? theme.onPrimary : secondaryText }]} maxFontSizeMultiplier={1.4}>
            · {tag}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // Runs to the screen edges. When there's more to scroll to, the spacing leaves the
  // last visible chip cut off at the edge, so the row never looks like it ends there.
  const renderFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, { paddingHorizontal: gutter, gap: chipSpacing.gap }]}
      style={{ marginHorizontal: -gutter }}
      onLayout={(e) => setChipViewport(Math.round(e.nativeEvent.layout.width))}
    >
      {renderChip(0, 'all', 'All')}
      {CORE_OPERATIONS.map((op, i) => {
        const row = levelByOp.get(op);
        return renderChip(i + 1, op, operationName(op), row && levelTag(row));
      })}
    </ScrollView>
  );

  const renderStat = (value: string, label: string) => (
    <View style={styles.statItem} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color: primaryText }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: secondaryText }]}>{label}</Text>
    </View>
  );

  const renderStats = () => {
    const { questions, correct, timeMs } = activity.totals;
    return (
      <View style={[card, styles.statRow]}>
        {renderStat(questions.toLocaleString(), 'Questions')}
        {renderStat(questions > 0 ? `${Math.round((correct / questions) * 100)}%` : '–', 'Accuracy')}
        {renderStat(questions > 0 ? formatTimeSpent(timeMs) : '–', 'Time spent')}
      </View>
    );
  };

  const renderChart = () => {
    const max = Math.max(1, ...activity.buckets.map((b) => b.questions));
    const scope = filter === 'all' ? '' : `${operationName(filter)} `;
    return (
      <View style={card}>
        <Text style={[styles.cardTitle, { color: primaryText }]} accessibilityRole="header">
          {`${scope}Questions ${rangeInfo.phrase}`}
        </Text>

        <View style={[styles.chart, { borderBottomColor: borderSubtle }]}>
          {activity.buckets.map((b) => {
            const barHeight = b.questions > 0 ? Math.max(4, (b.questions / max) * CHART_HEIGHT) : 0;
            const label = `${b.name}: ${b.isFuture ? 'not yet' : plural(b.questions, 'question')}${
              b.isCurrent ? `, ${rangeInfo.current.toLowerCase()}` : ''
            }`;
            return (
              <View key={b.start} style={styles.barColumn} accessible accessibilityLabel={label}>
                {b.questions > 0 && (
                  <Text
                    style={[styles.barValue, { color: b.isCurrent ? primaryText : secondaryText }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.2}
                  >
                    {compact(b.questions)}
                  </Text>
                )}
                <View
                  style={[
                    styles.bar,
                    b.questions > 0
                      ? { height: barHeight, backgroundColor: b.isCurrent ? highlight : accent }
                      : { height: 2, backgroundColor: fillBg },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {activity.buckets.map((b) => (
            <Text
              key={b.start}
              style={[
                styles.axisLabel,
                { color: b.isCurrent ? primaryText : secondaryText, fontWeight: b.isCurrent ? '700' : '500' },
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {b.label}
            </Text>
          ))}
        </View>

        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.swatch, { backgroundColor: highlight }]} />
          <Text style={[styles.legendText, { color: secondaryText }]}>{rangeInfo.current}</Text>
        </View>

        {renderBreakdown()}
      </View>
    );
  };

  // "All": each operation's share of the range. One operation: its coach level and what's next.
  const renderBreakdown = () => {
    if (filter === 'all') {
      const parts = CORE_OPERATIONS.map((op) => `${operationName(op)} ${activity.byOperation[op].toLocaleString()}`);
      if (activity.unsplitMixed > 0) parts.push(`Older mixes ${activity.unsplitMixed.toLocaleString()}`);
      return (
        <View style={[styles.breakdown, { borderTopColor: borderSubtle }]}>
          <Text style={[styles.breakdownText, { color: secondaryText }]}>{parts.join(' · ')}</Text>
        </View>
      );
    }
    const row = levelByOp.get(filter);
    if (!row) return null;
    return (
      <View style={[styles.breakdown, { borderTopColor: borderSubtle }]} accessible>
        <Text style={[styles.breakdownTitle, { color: primaryText }]}>
          {`${operationName(filter)} · ${levelTag(row)}`}
        </Text>
        <Text style={[styles.breakdownText, { color: secondaryText }]}>{levelProgressText(row)}</Text>
      </View>
    );
  };

  // `phrase`: "this week", "October".
  const renderMissingNote = (show: boolean, phrase: string) =>
    show && (
      <View style={[styles.note, { backgroundColor: fillBg }]} accessibilityRole="text">
        <Ionicons name="cloud-offline-outline" size={18} color={secondaryText} />
        <Text style={[styles.noteText, { color: secondaryText }]}>
          {`This phone only keeps your newest workouts, so ${phrase} may be missing some until you're back online.`}
        </Text>
      </View>
    );

  // Days practised, a month at a time. Practice is practice: the filter chips don't apply.
  const renderCalendar = () => (
    <MonthCalendar
      year={shownMonth.getFullYear()}
      month={shownMonth.getMonth()}
      today={today}
      practicedDays={practicedDays}
      canGoBack={monthsBack < oldestMonthsBack}
      canGoForward={monthsBack > 0}
      onBack={() => setMonthsBack(Math.min(monthsBack, oldestMonthsBack) + 1)}
      onForward={() => setMonthsBack(Math.min(monthsBack, oldestMonthsBack) - 1)}
      colors={{
        text: primaryText,
        subtle: secondaryText,
        accent,
        accentStrong,
        onAccent: theme.onPrimary,
      }}
      style={card}
    />
  );

  // Personal bests: the longest run of days in a row, and the most questions in one day.
  const renderPersonalBest = () => {
    const best = Math.max(lifetime.longestStreak, streak);
    const bestDay =
      lifetime.bestDayKey && lifetime.bestDayQuestions > 0
        ? `Best day: ${plural(lifetime.bestDayQuestions, 'question')}, ${dayName(lifetime.bestDayKey, today)}`
        : null;
    // The only place mixes show as mixes; everywhere else their questions count under each operation.
    const mixedLine = `${plural(lifetime.mixedRounds, 'mixed round')} played`;
    // Rounds with every answer right.
    const perfectLine = plural(lifetime.perfectRounds, 'perfect round');
    return (
      <View
        style={[card, styles.bestCard]}
        accessible
        accessibilityLabel={[
          `Personal best: longest streak, ${plural(best, 'day')}`,
          bestDay,
          `${plural(lifetime.questions, 'question')} answered in all`,
          perfectLine,
          mixedLine,
        ]
          .filter(Boolean)
          .join('. ')}
      >
        <View style={[styles.badge, { backgroundColor: accentSoft }]}>
          <Ionicons name="trophy-outline" size={22} color={accentStrong} />
        </View>
        <View style={styles.bestText}>
          <Text style={[styles.statLabel, { color: secondaryText }]}>Personal best · Longest streak</Text>
          <Text style={[styles.statValue, { color: primaryText }]}>{plural(best, 'day')}</Text>
          {bestDay && <Text style={[styles.bestDayText, { color: primaryText }]}>{bestDay}</Text>}
          <Text style={[styles.statLabel, { color: secondaryText }]}>
            {`${plural(lifetime.questions, 'question')} answered in all`}
          </Text>
          <Text style={[styles.statLabel, { color: secondaryText }]}>{perfectLine}</Text>
          <Text style={[styles.statLabel, { color: secondaryText }]}>{mixedLine}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPadding, paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 20) + 90 },
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
        <View style={[styles.responsiveWrapper, { maxWidth: contentWidth }]}>
          {renderHeader()}

          {!loaded ? (
            <ActivityIndicator style={styles.loading} size="large" color={accentStrong} />
          ) : (
            <View style={styles.sections}>
              <OfflineNote from={loaded.from} isOffline={isOffline} pendingSync={loaded.data.pendingSync} />

              {historyUnknown ? (
                <Text style={[styles.progressDetail, { color: secondaryText }]}>
                  Your progress will show here once you're back online.
                </Text>
              ) : (
                <>
                  {renderProgress()}
                  {renderRangeTabs()}
                  {renderFilterChips()}
                  {renderMissingNote(missingOlder, rangeInfo.phrase)}
                  {renderStats()}
                  {renderChart()}
                  {renderMissingNote(monthMayMiss, shownMonthName)}
                  {renderCalendar()}
                  {renderPersonalBest()}
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
  },
  responsiveWrapper: {
    width: '100%',
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
  cardTitle: {
    ...typography.button,
    marginBottom: 12,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: TOUCH_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentText: {
    ...typography.button,
  },
  chipRow: {
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    minHeight: TOUCH_HEIGHT,
    borderRadius: TOUCH_HEIGHT / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    ...typography.button,
  },
  chipTag: {
    ...typography.secondary,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    columnGap: 16,
  },
  statItem: {
    flexGrow: 1,
    flexBasis: 88,
  },
  statValue: {
    ...typography.sectionHeading,
  },
  statLabel: {
    ...typography.secondary,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // Room for the value above the tallest bar.
    height: CHART_HEIGHT + 28,
    gap: 4,
    borderBottomWidth: 1,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bar: {
    width: '100%',
    maxWidth: 32,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barValue: {
    ...typography.caption,
    textAlign: 'center',
  },
  axis: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  axisLabel: {
    ...typography.caption,
    flex: 1,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    ...typography.caption,
  },
  breakdown: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
    gap: 2,
  },
  breakdownTitle: {
    ...typography.button,
  },
  breakdownText: {
    ...typography.secondary,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noteText: {
    ...typography.secondary,
    flex: 1,
  },
  bestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bestText: {
    flex: 1,
    gap: 2,
  },
  bestDayText: {
    ...typography.button,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progress: {
    flex: 1,
    gap: 4,
  },
  progressHeadline: {
    ...typography.sectionHeading,
    letterSpacing: -0.4,
  },
  progressDetail: {
    ...typography.secondary,
  },
});
