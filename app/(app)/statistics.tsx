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
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { fetchAllWorkouts } from '../../src/services/statsService';
import { getUserProfile } from '../../src/services/settingsService';
import { OfflineNotice } from '../../src/components/OfflineNotice';

const PALETTE = {
  primary: '#BCE3AA',         // Soft pastel sage
  accentLilac: '#F2CAEC',     // Soft orchid
  backgroundLight: '#F1ECE9', // Warm neutral
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

function TrendSparkline({
  data,
  width,
  height = 36,
  strokeColor,
}: {
  data: number[];
  width: number;
  height?: number;
  strokeColor: string;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingX = 8;
  const paddingY = 6;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  const points = data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * usableWidth;
    const y = paddingY + ((val - min) / range) * usableHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, curr, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }, '');

  const lastPoint = points[points.length - 1];

  return (
    <Svg width={width} height={height}>
      <Path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r={3.8}
        fill={strokeColor}
      />
    </Svg>
  );
}

export default function StatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');
  const isNarrow = width < 360;

  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [weeklyTarget, setWeeklyTarget] = useState<number>(5);

  const today = useMemo(() => new Date(), []);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const calYear = currentCalendarDate.getFullYear();
  const calMonth = currentCalendarDate.getMonth();

  const isCurrentViewingMonth =
    calYear === today.getFullYear() && calMonth === today.getMonth();

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

    const net = await NetInfo.fetch();
    if (net.isConnected === false || net.isInternetReachable === false) {
      setIsOffline(true);
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);

    try {
      const [workoutsResult, profileResult]: [any, any] = await Promise.all([
        fetchAllWorkouts(user.id),
        getUserProfile(user.id).catch(() => null),
      ]);

      setIsOffline(false);

      if (Array.isArray(workoutsResult)) {
        setWorkouts(workoutsResult);
      } else if (workoutsResult && typeof workoutsResult === 'object') {
        setWorkouts(workoutsResult.data || []);
      } else {
        setWorkouts([]);
      }

      if (profileResult?.weekly_goal) {
        setWeeklyTarget(Number(profileResult.weekly_goal) || 5);
      }
    } catch (err: any) {
      const isNetworkError =
        err?.message?.includes('offline') ||
        err?.message?.includes('Network request failed') ||
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('Internet connection');

      if (isNetworkError) {
        setIsOffline(true);
      } else {
        console.warn('Stats fetch warning:', err?.message || err);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

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

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const primaryText = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const secondaryText = isDark ? PALETTE.textSubtleDark : PALETTE.textSubtleLight;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(10, 15, 11, 0.06)';
  const accentGreen = PALETTE.primary;
  const accentLilac = PALETTE.accentLilac;

  // -------------------------------------------------------------
  // Consistency: Active Days This Month, Current Streak, Weekly Goal
  // -------------------------------------------------------------
  const consistencyStats = useMemo(() => {
    if (workouts.length === 0) {
      return {
        activeDaysThisMonth: 0,
        currentStreak: 0,
        daysThisWeek: 0,
      };
    }

    const activeDatesSet = new Set<string>();
    let activeDaysThisMonth = 0;

    workouts.forEach((w) => {
      if (!w.completed_at) return;
      const d = new Date(w.completed_at);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      if (!activeDatesSet.has(str)) {
        activeDatesSet.add(str);
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
          activeDaysThisMonth += 1;
        }
      }
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Consecutive unbroken daily streak (e.g., Sun -> Mon -> Tue -> Wed = 4 days)
    let currentStreak = 0;
    let checkDay = new Date(now);
    const todayKey = `${checkDay.getFullYear()}-${String(checkDay.getMonth() + 1).padStart(2, '0')}-${String(checkDay.getDate()).padStart(2, '0')}`;
    
    if (!activeDatesSet.has(todayKey)) {
      checkDay.setDate(checkDay.getDate() - 1);
    }

    while (true) {
      const key = `${checkDay.getFullYear()}-${String(checkDay.getMonth() + 1).padStart(2, '0')}-${String(checkDay.getDate()).padStart(2, '0')}`;
      if (activeDatesSet.has(key)) {
        currentStreak += 1;
        checkDay.setDate(checkDay.getDate() - 1);
      } else {
        break;
      }
    }

    // Days completed this current calendar week (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const distToMonday = (dayOfWeek + 6) % 7;
    const mondayThisWeek = new Date(now);
    mondayThisWeek.setDate(now.getDate() - distToMonday);

    let daysThisWeek = 0;
    for (let i = 0; i <= distToMonday; i++) {
      const dayToCheck = new Date(mondayThisWeek);
      dayToCheck.setDate(mondayThisWeek.getDate() + i);
      const key = `${dayToCheck.getFullYear()}-${String(dayToCheck.getMonth() + 1).padStart(2, '0')}-${String(dayToCheck.getDate()).padStart(2, '0')}`;
      if (activeDatesSet.has(key)) {
        daysThisWeek += 1;
      }
    }

    return {
      activeDaysThisMonth,
      currentStreak,
      daysThisWeek,
    };
  }, [workouts, calYear, calMonth]);

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
        speedDeltaStr: 'Baseline active',
        accDeltaStr: 'No trend yet',
        isSpeedFaster: false,
        isAccBetter: false,
        headline: 'Complete workouts to reveal your growth curve.',
        subtext: 'NUMO benchmarks your response times, calculation fluency, and identifies weak spots automatically.',
        trendPoints: [] as number[],
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

    const windowSize = Math.min(10, Math.floor(sorted.length / 2) || 1);
    const recentSlice = sorted.slice(-windowSize);
    const baselineSlice = sorted.slice(
      Math.max(0, sorted.length - windowSize * 2),
      sorted.length - windowSize
    );

    const calcStats = (slice: any[]) => {
      let q = 0, c = 0, t = 0;
      slice.forEach((item) => {
        q += Number(item.total_questions) || 0;
        c += Number(item.correct_answers) || 0;
        t += Number(item.total_time) || 0;
      });
      return {
        pace: q > 0 ? t / q / 1000 : 0,
        acc: q > 0 ? (c / q) * 100 : 0,
      };
    };

    const recentStats = calcStats(recentSlice);
    const baselineStats = baselineSlice.length > 0 ? calcStats(baselineSlice) : recentStats;

    let speedDeltaPct = 0;
    let accDeltaPct = 0;

    if (baselineStats.pace > 0 && baselineSlice.length > 0) {
      speedDeltaPct = Math.round(((baselineStats.pace - recentStats.pace) / baselineStats.pace) * 100);
      accDeltaPct = Math.round(recentStats.acc - baselineStats.acc);
    }

    const isSpeedFaster = speedDeltaPct > 2;
    const isSpeedSlower = speedDeltaPct < -2;
    const isAccBetter = accDeltaPct > 2;
    const isAccWorse = accDeltaPct < -2;

    let headline = '';
    let subtext = '';

    if (sorted.length < 2) {
      headline = 'Baseline calibration active.';
      subtext = 'Complete additional sessions to establish rolling trends and precision insights.';
    } else if (isSpeedFaster && !isAccWorse) {
      if (isAccBetter) {
        headline = "You're getting faster and more accurate.";
        subtext = `Average pace improved ${Math.abs(speedDeltaPct)}% with a +${accDeltaPct}% accuracy boost over your last ${windowSize} sessions.`;
      } else {
        headline = "You're solving faster while maintaining accuracy.";
        subtext = `Average solving speed increased by ${Math.abs(speedDeltaPct)}% over your last ${windowSize} sessions without compromising precision.`;
      }
    } else if (isAccBetter && !isSpeedSlower) {
      headline = 'Your accuracy is improving while pace remains steady.';
      subtext = `Accuracy gained +${accDeltaPct}% across recent workouts while holding a solid ${recentStats.pace.toFixed(1)}s pace.`;
    } else if (isSpeedSlower && isAccBetter) {
      headline = 'Accuracy is improving. Keep practicing to bring pace up.';
      subtext = `Precision gained +${accDeltaPct}%. Continue consistent drills to naturally recover top speed.`;
    } else if (isSpeedSlower && isAccWorse) {
      headline = 'Focus on clean accuracy to lock in rhythm.';
      subtext = `Recent sessions show variability. Slow down slightly to stabilize your fundamentals.`;
    } else {
      headline = 'Consistent execution across sessions.';
      subtext = `Maintaining steady cadence at ${recentStats.pace.toFixed(1)}s/Q with ${Math.round(recentStats.acc)}% accuracy over your last ${windowSize} sessions.`;
    }

    const trendPoints = sorted.slice(-10).map((w) => {
      const q = Number(w.total_questions) || 0;
      const t = Number(w.total_time) || 0;
      return q > 0 ? parseFloat((t / q / 1000).toFixed(2)) : overallAvgPace;
    });

    return {
      hasData: true,
      overallAcc,
      overallAvgPace,
      speedDeltaPct: Math.abs(speedDeltaPct),
      speedDeltaStr:
        sorted.length < 2
          ? 'Baseline active'
          : speedDeltaPct >= 0
          ? `${speedDeltaPct}% faster recently`
          : `${Math.abs(speedDeltaPct)}% pace adjustment`,
      accDeltaStr:
        sorted.length < 2
          ? 'Tracking begun'
          : accDeltaPct >= 0
          ? `+${accDeltaPct}% accuracy gain`
          : `${accDeltaPct}% accuracy delta`,
      isSpeedFaster,
      isAccBetter,
      headline,
      subtext,
      trendPoints,
      fastestPace: fastestPace === Infinity ? overallAvgPace : parseFloat(fastestPace.toFixed(1)),
      bestAcc: Math.round(bestAcc),
      totalWorkouts: sorted.length,
    };
  }, [workouts]);

  // -------------------------------------------------------------
  // Calendar Grid
  // -------------------------------------------------------------
  const { gridWeeks, dotSize } = useMemo(() => {
    const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayIndex = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;

    const map: Record<number, boolean> = {};

    workouts.forEach((w) => {
      if (!w.completed_at) return;
      const d = new Date(w.completed_at);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        map[d.getDate()] = true;
      }
    });

    const flatCells: { day: number; active: boolean; isRealToday: boolean }[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      flatCells.push({ day: 0, active: false, isRealToday: false });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const hasWorkouts = Boolean(map[d]);
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
    };
  }, [calYear, calMonth, workouts, width, isCurrentViewingMonth, today, isNarrow]);

  const displayDayNumber = selectedDay || (isCurrentViewingMonth ? today.getDate() : 1);
  const selectedWeekday = WEEKDAY_ABBR[new Date(calYear, calMonth, displayDayNumber).getDay()];

  // -------------------------------------------------------------
  // Skill Matrix Breakdown (20+ floor for recommendations)
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

      const masteryScore = data.totalQ > 0 ? acc * 0.7 + Math.max(0, 10 - avgPace) * 3 : 0;
      const frictionScore = data.totalQ > 0 ? (100 - acc) * 1.4 + avgPace * 3.5 : -1;

      return {
        key,
        name: data.label,
        totalQ: data.totalQ,
        accuracy: acc,
        avgPace,
        masteryScore,
        frictionScore,
      };
    });

    const eligibleOperations = parsed.filter((p) => p.totalQ >= 20);
    const unpracticedOps = parsed.filter((p) => p.totalQ < 10 && p.key !== 'mixed');

    let strongest: any = null;
    let needsWork: any = null;
    let focusDirective = 'Keep steady pace';

    if (eligibleOperations.length >= 2) {
      const sortedByMastery = [...eligibleOperations].sort((a, b) => b.masteryScore - a.masteryScore);
      strongest = sortedByMastery[0];

      const sortedByFriction = [...eligibleOperations].sort((a, b) => b.frictionScore - a.frictionScore);
      const worstCandidate = sortedByFriction[0];
      
      if (worstCandidate.key !== strongest.key) {
        needsWork = worstCandidate;
        focusDirective = 'Recommended challenge';
      } else {
        needsWork = null;
        focusDirective = 'All Balanced';
      }
    } else if (eligibleOperations.length === 1) {
      strongest = eligibleOperations[0];
      needsWork = null;
      if (unpracticedOps.length > 0) {
        focusDirective = `Try ${unpracticedOps[0].name}`;
      } else {
        focusDirective = 'Expand variety';
      }
    }

    return {
      skills: parsed,
      strongest,
      needsWork,
      matureCount: eligibleOperations.length,
      focusDirective,
    };
  }, [workouts]);

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
            
            {/* 1. CALENDAR HERO */}
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

            {/* Calendar Heatmap */}
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

              {/* REFINED CONSISTENCY STATS */}
              <View style={[styles.dayRecapRow, { borderTopColor: dividerColor }]}>
                <View style={styles.recapItem}>
                  <Text style={[styles.recapLabel, { color: secondaryText }]}>Active Days</Text>
                  <Text style={[styles.recapValue, { color: accentGreen }]}>
                    {consistencyStats.activeDaysThisMonth} {consistencyStats.activeDaysThisMonth === 1 ? 'day' : 'days'}
                  </Text>
                </View>

                <View style={[styles.recapDivider, { backgroundColor: dividerColor }]} />

                <View style={styles.recapItem}>
                  <Text style={[styles.recapLabel, { color: secondaryText }]}>Current Streak</Text>
                  <Text style={[styles.recapValue, { color: primaryText }]}>
                    {consistencyStats.currentStreak} {consistencyStats.currentStreak === 1 ? 'day' : 'days'}
                  </Text>
                </View>

                <View style={[styles.recapDivider, { backgroundColor: dividerColor }]} />

                <View style={styles.recapItem}>
                  <Text style={[styles.recapLabel, { color: secondaryText }]}>Weekly Goal</Text>
                  <Text style={[styles.recapValue, { color: primaryText }]}>
                    {consistencyStats.daysThisWeek} / {weeklyTarget} days
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. ROLLING GROWTH & IMPROVEMENT VERDICT WITH SPARKLINE */}
            <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={styles.heroBadgeRow}>
                <View style={[styles.statusBadge, { backgroundColor: accentGreen }]}>
                  <Text style={styles.statusBadgeText}>PROGRESS UPDATE</Text>
                </View>
              </View>

              <Text style={[styles.heroHeadline, { color: primaryText }]}>
                {growthMetrics.headline}
              </Text>

              <Text style={[styles.heroSubtext, { color: secondaryText }]}>
                {growthMetrics.subtext}
              </Text>

              {/* Pace Trajectory Sparkline */}
              {growthMetrics.trendPoints.length >= 2 && (
                <View style={[styles.sparklineContainer, { borderTopColor: dividerColor }]}>
                  <View style={styles.sparklineHeader}>
                    <Text style={[styles.sparklineTitle, { color: secondaryText }]}>
                      Pace Trend (Last {growthMetrics.trendPoints.length} sessions)
                    </Text>
                    <Text style={[styles.sparklineCurrent, { color: primaryText }]}>
                      {growthMetrics.trendPoints[growthMetrics.trendPoints.length - 1]}s/Q
                    </Text>
                  </View>
                  <View style={styles.sparklineChartWrapper}>
                    <TrendSparkline
                      data={growthMetrics.trendPoints}
                      width={width - (isNarrow ? 72 : 80)}
                      height={40}
                      strokeColor={accentGreen}
                    />
                  </View>
                </View>
              )}

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
              
              {/* Strongest Area */}
              <View style={[styles.directiveCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                <View style={[styles.directiveIconCircle, { backgroundColor: accentGreen }]}>
                  <Ionicons name="trophy" size={17} color="#0A0F0B" />
                </View>
                <Text style={[styles.directiveLabel, { color: secondaryText }]}>Strongest Area</Text>
                <Text style={[styles.directiveValue, { color: primaryText }]} numberOfLines={1}>
                  {skillBreakdown.strongest
                    ? skillBreakdown.strongest.name
                    : 'Not enough data'}
                </Text>
                <Text style={[styles.directiveDetail, { color: secondaryText }]}>
                  {skillBreakdown.strongest
                    ? `${skillBreakdown.strongest.accuracy}% · ${skillBreakdown.strongest.avgPace}s/Q`
                    : 'Needs 20 questions'}
                </Text>
              </View>

              {/* Next Focus */}
              <View style={[styles.directiveCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                <View style={[styles.directiveIconCircle, { backgroundColor: accentLilac }]}>
                  <Ionicons name="sparkles" size={17} color="#0A0F0B" />
                </View>
                <Text style={[styles.directiveLabel, { color: secondaryText }]}>Next Focus</Text>
                <Text style={[styles.directiveValue, { color: primaryText }]} numberOfLines={1}>
                  {skillBreakdown.needsWork
                    ? skillBreakdown.needsWork.name
                    : skillBreakdown.matureCount === 1
                    ? 'Explore Other Ops'
                    : skillBreakdown.matureCount === 0
                    ? 'Practice More'
                    : 'All Balanced'}
                </Text>
                <Text style={[styles.directiveDetail, { color: secondaryText }]}>
                  {skillBreakdown.needsWork
                    ? 'Recommended challenge'
                    : skillBreakdown.focusDirective}
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
                  const hasLittleData = skill.totalQ < 10;

                  return (
                    <View key={skill.key} style={styles.skillRow}>
                      <View style={styles.skillHeader}>
                        <Text style={[styles.skillName, { color: primaryText }]}>{skill.name}</Text>
                        <Text style={[styles.skillStat, { color: hasLittleData ? secondaryText : primaryText }]}>
                          {hasLittleData
                            ? 'Not enough data yet'
                            : `${skill.accuracy}% · ${skill.avgPace}s (${skill.totalQ}Q)`}
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
                              width: hasLittleData ? '0%' : `${Math.max(skill.accuracy, 6)}%`,
                              backgroundColor: accentGreen,
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
    fontSize: 16,
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
    marginBottom: 14,
  },

  /* Sparkline */
  sparklineContainer: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 14,
  },
  sparklineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sparklineTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sparklineCurrent: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  sparklineChartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    fontSize: 12.5,
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