import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { fetchAllWorkouts } from '../../src/services/statsService';
import { OfflineNotice } from '../../src/components/OfflineNotice';

const PALETTE = {
  primary: '#BCE3AA',         // Soft pastel sage
  accentLilac: '#F2CAEC',     // Soft orchid
  backgroundLight: '#F1ECE9', // Warm alabaster neutral
  dark: '#0A0F0B',            // Deep obsidian
  cardLight: '#FFFFFF',
  cardDark: '#141C15',
  borderLight: 'rgba(10, 15, 11, 0.08)',
  borderDark: 'rgba(255, 255, 255, 0.08)',
  textSubtleLight: 'rgba(10, 15, 11, 0.55)',
  textSubtleDark: 'rgba(241, 236, 233, 0.65)',
};

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function StatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');
  const isNarrow = width < 360;

  // Offline connection state
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<any[]>([]);

  // Calendar dates
  const today = useMemo(() => new Date(), []);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const calYear = currentCalendarDate.getFullYear();
  const calMonth = currentCalendarDate.getMonth();

  const isCurrentViewingMonth =
    calYear === today.getFullYear() && calMonth === today.getMonth();

  // Network connectivity listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  const handleRetryConnection = async () => {
    const state = await NetInfo.fetch();
    const offline = state.isConnected === false || state.isInternetReachable === false;
    setIsOffline(offline);
    if (!offline) {
      loadData(true);
    }
  };

  const loadData = useCallback(async (showLoading = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const result: any = await fetchAllWorkouts(user.id);
      if (Array.isArray(result)) {
        setWorkouts(result);
      } else if (result && typeof result === 'object') {
        setWorkouts(result.data || []);
      } else {
        setWorkouts([]);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  // Month navigation: never auto-select Day 1
  const handlePrevMonth = () => {
    const nextDate = new Date(calYear, calMonth - 1, 1);
    setCurrentCalendarDate(nextDate);
    if (nextDate.getFullYear() === today.getFullYear() && nextDate.getMonth() === today.getMonth()) {
      setSelectedDay(today.getDate());
    } else {
      setSelectedDay(null);
    }
  };

  const handleNextMonth = () => {
    const nextDate = new Date(calYear, calMonth + 1, 1);
    setCurrentCalendarDate(nextDate);
    if (nextDate.getFullYear() === today.getFullYear() && nextDate.getMonth() === today.getMonth()) {
      setSelectedDay(today.getDate());
    } else {
      setSelectedDay(null);
    }
  };

  // High-contrast dynamic colors
  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const primaryText = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const secondaryText = isDark ? PALETTE.textSubtleDark : PALETTE.textSubtleLight;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(10, 15, 11, 0.06)';
  const accentGreen = PALETTE.primary;
  const accentLilac = PALETTE.accentLilac;

  // -------------------------------------------------------------
  // Growth Metrics Engine
  // -------------------------------------------------------------
  const growthMetrics = useMemo(() => {
    if (workouts.length === 0) {
      return {
        hasData: false,
        overallAcc: 0,
        overallAvgPace: 0,
        speedDeltaPct: 0,
        speedDeltaStr: 'Baseline set',
        accDeltaStr: 'No trend yet',
        isSpeedFaster: false,
        isAccBetter: false,
        fastestPace: 0,
        bestAcc: 0,
        totalWorkouts: 0,
      };
    }

    const sorted = [...workouts].sort(
      (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    );

    let totalQ = 0;
    let totalC = 0;
    let totalTime = 0;
    let fastestPace = Infinity;
    let bestAcc = 0;

    sorted.forEach((w) => {
      const q = Number(w.total_questions) || 0;
      const c = Number(w.correct_answers) || 0;
      const t = Number(w.total_time) || 0;
      const pace = q > 0 ? t / q / 1000 : 0;
      const acc = Number(w.accuracy) || (q > 0 ? (c / q) * 100 : 0);

      totalQ += q;
      totalC += c;
      totalTime += t;

      if (pace > 0 && pace < fastestPace) fastestPace = pace;
      if (acc > bestAcc) bestAcc = acc;
    });

    const overallAcc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
    const overallAvgPace = totalQ > 0 ? parseFloat((totalTime / totalQ / 1000).toFixed(1)) : 0;

    let speedDeltaPct = 0;
    let accDelta = 0;
    let isSpeedFaster = false;
    let isAccBetter = false;

    if (sorted.length >= 2) {
      const mid = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, mid);
      const secondHalf = sorted.slice(mid);

      const getPace = (arr: any[]) => {
        let q = 0;
        let t = 0;
        arr.forEach((item) => {
          q += Number(item.total_questions) || 0;
          t += Number(item.total_time) || 0;
        });
        return q > 0 ? t / q / 1000 : 0;
      };

      const getAcc = (arr: any[]) => {
        let q = 0;
        let c = 0;
        arr.forEach((item) => {
          q += Number(item.total_questions) || 0;
          c += Number(item.correct_answers) || 0;
        });
        return q > 0 ? (c / q) * 100 : 0;
      };

      const oldPace = getPace(firstHalf);
      const newPace = getPace(secondHalf);
      const oldAcc = getAcc(firstHalf);
      const newAcc = getAcc(secondHalf);

      if (oldPace > 0) {
        speedDeltaPct = Math.round(((oldPace - newPace) / oldPace) * 100);
        isSpeedFaster = speedDeltaPct >= 0;
      }

      accDelta = Math.round(newAcc - oldAcc);
      isAccBetter = accDelta >= 0;
    }

    return {
      hasData: true,
      overallAcc,
      overallAvgPace,
      speedDeltaPct: Math.abs(speedDeltaPct),
      speedDeltaStr:
        sorted.length < 2
          ? 'Baseline active'
          : speedDeltaPct >= 0
          ? `${speedDeltaPct}% faster overall`
          : `${Math.abs(speedDeltaPct)}% slower overall`,
      accDeltaStr:
        sorted.length < 2
          ? 'Tracking begun'
          : accDelta >= 0
          ? `+${accDelta}% accuracy gain`
          : `${accDelta}% accuracy drop`,
      isSpeedFaster,
      isAccBetter,
      fastestPace: fastestPace === Infinity ? overallAvgPace : parseFloat(fastestPace.toFixed(1)),
      bestAcc: Math.round(bestAcc),
      totalWorkouts: sorted.length,
    };
  }, [workouts]);

  // -------------------------------------------------------------
  // Calendar Grid - Exact 7-column rows
  // -------------------------------------------------------------
  const { gridWeeks, dotSize, dailyMap } = useMemo(() => {
    const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayIndex = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;

    const map: Record<number, { count: number; solved: number; correct: number; totalTimeMs: number }> = {};

    workouts.forEach((w) => {
      if (!w.completed_at) return;
      const d = new Date(w.completed_at);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const day = d.getDate();
        if (!map[day]) {
          map[day] = { count: 0, solved: 0, correct: 0, totalTimeMs: 0 };
        }
        map[day].count += 1;
        map[day].solved += Number(w.total_questions) || 0;
        map[day].correct += Number(w.correct_answers) || 0;
        map[day].totalTimeMs += Number(w.total_time) || 0;
      }
    });

    const flatCells: { day: number; active: boolean; isRealToday: boolean }[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      flatCells.push({ day: 0, active: false, isRealToday: false });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const hasWorkouts = Boolean(map[d] && map[d].count > 0);
      const isRealToday = isCurrentViewingMonth && d === today.getDate();
      flatCells.push({ day: d, active: hasWorkouts, isRealToday });
    }

    const remainder = flatCells.length % 7;
    if (remainder !== 0) {
      const trailingCount = 7 - remainder;
      for (let j = 0; j < trailingCount; j++) {
        flatCells.push({ day: 0, active: false, isRealToday: false });
      }
    }

    // Break into week rows
    const weeks: { day: number; active: boolean; isRealToday: boolean }[][] = [];
    for (let i = 0; i < flatCells.length; i += 7) {
      weeks.push(flatCells.slice(i, i + 7));
    }

    const horizontalPadding = isNarrow ? 32 : 40;
    const availableWidth = width - horizontalPadding - 32;
    const calculatedSize = Math.floor(availableWidth / 7);

    return {
      gridWeeks: weeks,
      dotSize: Math.max(calculatedSize, 36),
      dailyMap: map,
    };
  }, [calYear, calMonth, workouts, width, isCurrentViewingMonth, today, isNarrow]);

  const activeDaySummary = useMemo(() => {
    if (!selectedDay) {
      return { count: 0, solved: 0, pace: '—', acc: '—' };
    }
    const dayData = dailyMap[selectedDay];
    if (!dayData || dayData.count === 0) {
      return { count: 0, solved: 0, pace: '—', acc: '—' };
    }
    const pace = dayData.solved > 0 ? (dayData.totalTimeMs / dayData.solved / 1000).toFixed(1) : '—';
    const acc = dayData.solved > 0 ? `${Math.round((dayData.correct / dayData.solved) * 100)}%` : '—';
    return {
      count: dayData.count,
      solved: dayData.solved,
      pace: `${pace}s`,
      acc,
    };
  }, [dailyMap, selectedDay]);

  const displayDayNumber = selectedDay || (isCurrentViewingMonth ? today.getDate() : 1);
  const selectedWeekday = WEEKDAY_ABBR[new Date(calYear, calMonth, displayDayNumber).getDay()];

  // -------------------------------------------------------------
  // Skill Matrix Breakdown
  // -------------------------------------------------------------
  const skillBreakdown = useMemo(() => {
    const categories: Record<string, { label: string; totalQ: number; correct: number; totalTimeMs: number }> = {
      addition: { label: 'Addition', totalQ: 0, correct: 0, totalTimeMs: 0 },
      subtraction: { label: 'Subtraction', totalQ: 0, correct: 0, totalTimeMs: 0 },
      multiplication: { label: 'Multiplication', totalQ: 0, correct: 0, totalTimeMs: 0 },
      division: { label: 'Division', totalQ: 0, correct: 0, totalTimeMs: 0 },
      mixed: { label: 'Mixed Challenge', totalQ: 0, correct: 0, totalTimeMs: 0 },
    };

    workouts.forEach((w) => {
      let rawOp = (w.operation || 'mixed').toLowerCase();
      if (rawOp === 'adaptive_mix') rawOp = 'mixed';
      if (!categories[rawOp]) return;

      categories[rawOp].totalQ += Number(w.total_questions) || 0;
      categories[rawOp].correct += Number(w.correct_answers) || 0;
      categories[rawOp].totalTimeMs += Number(w.total_time) || 0;
    });

    const parsed = Object.entries(categories).map(([key, data]) => {
      const acc = data.totalQ > 0 ? Math.round((data.correct / data.totalQ) * 100) : 0;
      const avgPace = data.totalQ > 0 ? parseFloat((data.totalTimeMs / data.totalQ / 1000).toFixed(1)) : 0;
      return {
        key,
        name: data.label,
        totalQ: data.totalQ,
        accuracy: acc,
        avgPace,
        frictionScore: data.totalQ > 0 ? (100 - acc) * 1.5 + avgPace * 4 : -1,
      };
    });

    const practiced = parsed.filter((p) => p.totalQ > 0);
    if (practiced.length === 0) {
      return { skills: parsed, strongest: null, needsWork: null };
    }

    const sortedByMastery = [...practiced].sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.avgPace - b.avgPace;
    });

    const strongest = sortedByMastery[0];
    const sortedByFriction = [...practiced].sort((a, b) => b.frictionScore - a.frictionScore);
    const needsWork = sortedByFriction[0];

    return {
      skills: parsed,
      strongest,
      needsWork: needsWork.key !== strongest.key ? needsWork : null,
    };
  }, [workouts]);

  // If offline, block the screen completely matching Workout
  if (isOffline) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={screenBg}
        />
        <OfflineNotice onRetry={handleRetryConnection} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={screenBg}
      />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: cardBg, borderColor: borderSubtle }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: primaryText }]}>Performance & Growth</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: cardBg, borderColor: borderSubtle }]}
            onPress={() => loadData(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color={primaryText} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={accentGreen} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: isNarrow ? 16 : 20,
              paddingBottom: Math.max(insets.bottom, 20) + 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.responsiveWrapper}>
            {/* 1. RESTORED ENLARGED CALENDAR HERO */}
            <View style={styles.heroSection}>
              <View style={styles.heroTopRow}>
                <Text style={[styles.heroDayNumber, { color: accentGreen }]}>
                  {displayDayNumber}
                </Text>
                <Text style={[styles.heroDayWeekday, { color: secondaryText }]}>
                  {selectedWeekday}
                </Text>
              </View>

              <View style={styles.monthSwitcherRow}>
                <Text style={[styles.monthLabel, { color: primaryText }]}>
                  {MONTH_NAMES[calMonth]} <Text style={{ fontWeight: '400', color: secondaryText }}>{calYear}</Text>
                </Text>

                <View style={styles.arrowsGroup}>
                  <TouchableOpacity
                    onPress={handlePrevMonth}
                    style={[styles.arrowButton, { borderColor: borderSubtle, backgroundColor: cardBg }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={18} color={primaryText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={[styles.arrowButton, { borderColor: borderSubtle, backgroundColor: cardBg }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={18} color={primaryText} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Calendar Heatmap Card */}
            <View style={[styles.calendarCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={styles.weekHeaderRow}>
                {WEEK_DAYS.map((wd, i) => (
                  <View key={i} style={[styles.cellColumn, { width: dotSize }]}>
                    <Text style={[styles.weekDayText, { color: secondaryText }]}>
                      {wd}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Rows separated into weeks */}
              <View style={styles.weeksContainer}>
                {gridWeeks.map((week, weekIndex) => (
                  <View key={weekIndex} style={styles.weekRow}>
                    {week.map((item, colIndex) => {
                      if (item.day === 0) {
                        return (
                          <View
                            key={colIndex}
                            style={[styles.cellColumn, { width: dotSize, height: dotSize }]}
                          />
                        );
                      }
                      const isSelected = selectedDay === item.day;
                      return (
                        <View key={colIndex} style={[styles.cellColumn, { width: dotSize }]}>
                          <TouchableOpacity
                            onPress={() => setSelectedDay(item.day)}
                            style={[
                              styles.dotCell,
                              {
                                width: dotSize - 4,
                                height: dotSize - 4,
                                borderRadius: (dotSize - 4) / 2,
                                backgroundColor: isSelected
                                  ? primaryText
                                  : item.active
                                  ? accentGreen
                                  : isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(10,15,11,0.06)',
                                borderWidth: item.isRealToday && !isSelected ? 2 : 0,
                                borderColor: accentGreen,
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.dotCellText,
                                {
                                  color: isSelected
                                    ? isDark
                                      ? PALETTE.dark
                                      : '#FFFFFF'
                                    : item.active
                                    ? PALETTE.dark
                                    : secondaryText,
                                  fontWeight: isSelected || item.active || item.isRealToday ? '800' : '600',
                                },
                              ]}
                            >
                              {item.day}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Day Recap */}
              <View style={[styles.dayRecapRow, { borderTopColor: dividerColor }]}>
                <View style={styles.recapItem}>
                  <Text style={[styles.recapLabel, { color: secondaryText }]}>Workouts</Text>
                  <Text style={[styles.recapValue, { color: primaryText }]}>{activeDaySummary.count}</Text>
                </View>
                <View style={[styles.recapDivider, { backgroundColor: dividerColor }]} />
                <View style={styles.recapItem}>
                  <Text style={[styles.recapLabel, { color: secondaryText }]}>Solved</Text>
                  <Text style={[styles.recapValue, { color: primaryText }]}>{activeDaySummary.solved}</Text>
                </View>
                <View style={[styles.recapDivider, { backgroundColor: dividerColor }]} />
                <View style={styles.recapItem}>
                  <Text style={[styles.recapLabel, { color: secondaryText }]}>Accuracy</Text>
                  <Text style={[styles.recapValue, { color: primaryText }]}>{activeDaySummary.acc}</Text>
                </View>
                <View style={[styles.recapDivider, { backgroundColor: dividerColor }]} />
                <View style={styles.recapItem}>
                  <Text style={[styles.recapLabel, { color: secondaryText }]}>Pace</Text>
                  <Text style={[styles.recapValue, { color: primaryText }]}>{activeDaySummary.pace}</Text>
                </View>
              </View>
            </View>

            {/* 2. GROWTH & IMPROVEMENT VERDICT */}
            <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={styles.heroBadgeRow}>
                <View style={[styles.statusBadge, { backgroundColor: accentGreen }]}>
                  <Text style={styles.statusBadgeText}>GROWTH VERDICT</Text>
                </View>
                <Text style={[styles.totalRoundsText, { color: secondaryText }]}>
                  {growthMetrics.totalWorkouts} sessions logged
                </Text>
              </View>

              <Text style={[styles.heroHeadline, { color: primaryText }]}>
                {growthMetrics.hasData
                  ? growthMetrics.isSpeedFaster
                    ? `Your solving speed improved by ${growthMetrics.speedDeltaPct}%.`
                    : `Focus on clean accuracy to lock in your pace.`
                  : 'Complete workouts to reveal your growth curve.'}
              </Text>

              <Text style={[styles.heroSubtext, { color: secondaryText }]}>
                {growthMetrics.hasData
                  ? `Current average pace is ${growthMetrics.overallAvgPace}s per question across all sessions with ${growthMetrics.overallAcc}% overall accuracy.`
                  : 'NUMO benchmarks your response times, calculation fluency, and identifies weak spots automatically.'}
              </Text>

              <View style={[styles.growthPillsRow, { borderTopColor: dividerColor }]}>
                <View style={styles.growthPillItem}>
                  <Ionicons
                    name={growthMetrics.isSpeedFaster ? 'trending-up' : 'timer-outline'}
                    size={18}
                    color={primaryText}
                  />
                  <Text style={[styles.growthPillText, { color: primaryText }]}>
                    {growthMetrics.speedDeltaStr}
                  </Text>
                </View>

                <View style={[styles.pillDivider, { backgroundColor: dividerColor }]} />

                <View style={styles.growthPillItem}>
                  <Ionicons
                    name={growthMetrics.isAccBetter ? 'checkmark-circle' : 'alert-circle-outline'}
                    size={18}
                    color={primaryText}
                  />
                  <Text style={[styles.growthPillText, { color: primaryText }]}>
                    {growthMetrics.accDeltaStr}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. DIRECTIVES */}
            <View style={styles.directivesRow}>
              <View style={[styles.directiveCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                <View style={[styles.directiveIconCircle, { backgroundColor: accentGreen }]}>
                  <Ionicons name="trophy" size={17} color="#0A0F0B" />
                </View>
                <Text style={[styles.directiveLabel, { color: secondaryText }]}>Strongest Area</Text>
                <Text style={[styles.directiveValue, { color: primaryText }]} numberOfLines={1}>
                  {skillBreakdown.strongest ? skillBreakdown.strongest.name : '—'}
                </Text>
                <Text style={[styles.directiveDetail, { color: secondaryText }]}>
                  {skillBreakdown.strongest
                    ? `${skillBreakdown.strongest.accuracy}% · ${skillBreakdown.strongest.avgPace}s/Q`
                    : 'Requires 1 session'}
                </Text>
              </View>

              <View style={[styles.directiveCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                <View style={[styles.directiveIconCircle, { backgroundColor: accentLilac }]}>
                  <Ionicons name="sparkles" size={17} color="#0A0F0B" />
                </View>
                <Text style={[styles.directiveLabel, { color: secondaryText }]}>Next Focus</Text>
                <Text style={[styles.directiveValue, { color: primaryText }]} numberOfLines={1}>
                  {skillBreakdown.needsWork ? skillBreakdown.needsWork.name : 'All Balanced'}
                </Text>
                <Text style={[styles.directiveDetail, { color: secondaryText }]}>
                  {skillBreakdown.needsWork ? 'Recommended challenge' : 'Keep steady pace'}
                </Text>
              </View>
            </View>

            {/* 4. SKILL PROFICIENCY */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: primaryText }]}>Skill Proficiency</Text>
                <Text style={[styles.sectionSubtitle, { color: secondaryText }]}>Accuracy & Pace</Text>
              </View>

              <View style={styles.skillsList}>
                {skillBreakdown.skills.map((skill) => {
                  const isPracticed = skill.totalQ > 0;
                  return (
                    <View key={skill.key} style={styles.skillRow}>
                      <View style={styles.skillHeader}>
                        <Text style={[styles.skillName, { color: primaryText }]}>{skill.name}</Text>
                        <Text style={[styles.skillStat, { color: isPracticed ? primaryText : secondaryText }]}>
                          {isPracticed ? `${skill.accuracy}% · ${skill.avgPace}s` : 'Not practiced yet'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.skillTrack,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(10,15,11,0.06)',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.skillFill,
                            {
                              width: `${Math.max(skill.accuracy, 4)}%`,
                              backgroundColor: isPracticed ? accentGreen : 'transparent',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 5. PERSONAL RECORDS */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <Text style={[styles.sectionTitle, { color: primaryText, marginBottom: 16 }]}>
                Personal Records
              </Text>

              <View style={styles.recordsGrid}>
                <View style={styles.recordItem}>
                  <Ionicons name="flash" size={24} color={accentGreen} />
                  <Text style={[styles.recordValue, { color: primaryText }]}>
                    {growthMetrics.fastestPace > 0 ? `${growthMetrics.fastestPace}s` : '—'}
                  </Text>
                  <Text style={[styles.recordLabel, { color: secondaryText }]}>Fastest Pace</Text>
                </View>

                <View style={[styles.recordDivider, { backgroundColor: dividerColor }]} />

                <View style={styles.recordItem}>
                  <Ionicons name="ribbon" size={24} color={accentLilac} />
                  <Text style={[styles.recordValue, { color: primaryText }]}>
                    {growthMetrics.bestAcc > 0 ? `${growthMetrics.bestAcc}%` : '—'}
                  </Text>
                  <Text style={[styles.recordLabel, { color: secondaryText }]}>Peak Accuracy</Text>
                </View>

                <View style={[styles.recordDivider, { backgroundColor: dividerColor }]} />

                <View style={styles.recordItem}>
                  <Ionicons name="bar-chart" size={24} color={primaryText} />
                  <Text style={[styles.recordValue, { color: primaryText }]}>
                    {growthMetrics.totalWorkouts}
                  </Text>
                  <Text style={[styles.recordLabel, { color: secondaryText }]}>Completed</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerInner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 8,
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 16,
  },

  /* Calendar Hero */
  heroSection: {
    marginTop: 4,
    marginBottom: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroDayNumber: {
    fontSize: 96,
    fontWeight: '900',
    lineHeight: 96,
    letterSpacing: -3,
  },
  heroDayWeekday: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 10,
  },
  monthSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  monthLabel: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  arrowsGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Calendar Card */
  calendarCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cellColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  weeksContainer: {
    gap: 10,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCellText: {
    fontSize: 14,
  },
  dayRecapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  recapItem: {
    alignItems: 'center',
  },
  recapLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  recapValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  recapDivider: {
    width: 1,
    height: 28,
  },

  /* Growth Verdict Card */
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: '#0A0F0B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  totalRoundsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSubtext: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  growthPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 14,
  },
  growthPillItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  growthPillText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  pillDivider: {
    width: 1,
    height: 22,
  },

  /* Directives Row */
  directivesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  directiveCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  directiveIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  directiveLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  directiveValue: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  directiveDetail: {
    fontSize: 12.5,
    fontWeight: '600',
  },

  /* Section Cards */
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Skills */
  skillsList: {
    gap: 14,
  },
  skillRow: {
    gap: 7,
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skillName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  skillStat: {
    fontSize: 13,
    fontWeight: '700',
  },
  skillTrack: {
    width: '100%',
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  skillFill: {
    height: '100%',
    borderRadius: 3.5,
  },

  /* Personal Records */
  recordsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  recordValue: {
    fontSize: 19,
    fontWeight: '800',
  },
  recordLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  recordDivider: {
    width: 1,
    height: 34,
  },
});