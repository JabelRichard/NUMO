import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { fetchAllWorkouts, calculateStats } from '../../src/services/statsService';

type TimeRange = 'week' | 'month' | 'year';

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const RANGE_LABELS: Record<TimeRange, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
};

export default function StatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isNarrow = width < 360;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedRange, setSelectedRange] = useState<TimeRange>('week');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [chartWidth, setChartWidth] = useState(Math.max(width - 72, 260));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Load workouts: isInitial controls whether the full screen spinner is shown
  const loadStats = useCallback(async (isInitial = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (isInitial) setLoading(true);
    try {
      const data = await fetchAllWorkouts(user.id);
      setWorkouts(data || []);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // AUTO-REFRESH: Runs every time the user navigates back to or focuses this screen
  useFocusEffect(
    useCallback(() => {
      loadStats(false);
    }, [loadStats])
  );

  const statsData = useMemo(() => calculateStats(workouts, year, month), [workouts, year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  // Calendar Grid Calculation
  const { gridCells, dotSize } = useMemo(() => {
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const cells: { day: number; active: boolean }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: 0, active: false });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      cells.push({ day: d, active: Boolean(statsData.dailyMap[d]) });
    }

    const calculatedSize = Math.floor((width - 40 - 6 * 10) / 7);
    return { gridCells: cells, dotSize: Math.max(calculatedSize, 32) };
  }, [year, month, statsData.dailyMap, width]);

  const activeDaySummary = statsData.dailyMap[selectedDay] || {
    workoutsCount: 0,
    problemsSolved: 0,
    avgSpeed: 0,
    accuracy: 0,
  };

  const selectedWeekday = WEEKDAY_ABBR[new Date(year, month, selectedDay).getDay()];

  // 1. Filter real data according to Supabase schema
  const rangeStats = useMemo(() => {
    const now = new Date();
    const currentList: any[] = [];
    const prevList: any[] = [];

    let currentStart = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();

    if (selectedRange === 'week') {
      const dayOfWeek = (now.getDay() + 6) % 7;
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
      prevEnd = new Date(currentStart.getTime() - 1);
      prevStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (selectedRange === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    } else {
      currentStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
    }

    workouts.forEach((w) => {
      if (!w.completed_at) return;
      const wDate = new Date(w.completed_at);
      if (wDate >= currentStart && wDate <= now) {
        currentList.push(w);
      } else if (wDate >= prevStart && wDate <= prevEnd) {
        prevList.push(w);
      }
    });

    const compileMetrics = (items: any[]) => {
      let qCount = 0;
      let cCount = 0;
      let timeMs = 0;

      items.forEach((item) => {
        const solved = Number(item.total_questions) || 0;
        const correct = Number(item.correct_answers) || 0;
        const duration = Number(item.total_time) || 0;

        qCount += solved;
        cCount += correct;
        timeMs += duration;
      });

      const acc = qCount > 0 ? Math.round((cCount / qCount) * 100) : 0;
      const totalSecs = Math.round(timeMs / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      const xp = cCount * 10 + items.length * 15;

      return {
        workoutsCount: items.length,
        accuracy: acc,
        timeMs,
        timeFormatted: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
        xp,
      };
    };

    const current = compileMetrics(currentList);
    const prev = compileMetrics(prevList);

    const accDiff = current.accuracy - prev.accuracy;
    const workoutsDiff = current.workoutsCount - prev.workoutsCount;
    const xpDiff = current.xp - prev.xp;
    const timeDiffMs = current.timeMs - prev.timeMs;
    const timeDiffPct = prev.timeMs > 0 ? Math.round((timeDiffMs / prev.timeMs) * 100) : 0;

    const periodLabel = selectedRange === 'week' ? 'last week' : selectedRange === 'month' ? 'last month' : 'last year';

    return {
      current,
      diffs: {
        accStr: `${accDiff >= 0 ? '↑' : '↓'} ${Math.abs(accDiff)}% from ${periodLabel}`,
        workoutStr: `${workoutsDiff >= 0 ? '↑' : '↓'} ${Math.abs(workoutsDiff)} from ${periodLabel}`,
        xpStr: `${xpDiff >= 0 ? '↑' : '↓'} ${Math.abs(xpDiff)} from ${periodLabel}`,
        timeStr: `${timeDiffPct >= 0 ? '↑' : '↓'} ${Math.abs(timeDiffPct)}% from ${periodLabel}`,
      },
    };
  }, [workouts, selectedRange]);

  // 2. Real Accuracy Over Last 7 Days
  const last7DaysData = useMemo(() => {
    const days: { label: string; accuracy: number; hasWorkouts: boolean }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0).getTime();
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).getTime();

      const dayWorkouts = workouts.filter((w) => {
        if (!w.completed_at) return false;
        const time = new Date(w.completed_at).getTime();
        return time >= startOfDay && time <= endOfDay;
      });

      let dayTotalQ = 0;
      let dayTotalC = 0;

      dayWorkouts.forEach((w) => {
        dayTotalQ += Number(w.total_questions) || 0;
        dayTotalC += Number(w.correct_answers) || 0;
      });

      const dayAcc = dayTotalQ > 0 ? Math.round((dayTotalC / dayTotalQ) * 100) : 0;
      const monthShort = targetDate.toLocaleDateString('en-US', { month: 'short' });

      days.push({
        label: `${monthShort} ${targetDate.getDate()}`,
        accuracy: dayAcc,
        hasWorkouts: dayTotalQ > 0,
      });
    }

    return days;
  }, [workouts]);

  // 3. Real Overall Summary Across All Workouts
  const overallSummary = useMemo(() => {
    let totalQ = 0;
    let totalCorrect = 0;
    let totalTimeMs = 0;

    workouts.forEach((w) => {
      totalQ += Number(w.total_questions) || 0;
      totalCorrect += Number(w.correct_answers) || 0;
      totalTimeMs += Number(w.total_time) || 0;
    });

    const totalIncorrect = Math.max(0, totalQ - totalCorrect);
    const avgSecsPerQ = totalQ > 0 ? (totalTimeMs / totalQ / 1000).toFixed(1) : '0.0';

    return {
      totalQ,
      totalCorrect,
      totalIncorrect,
      avgSecsPerQ,
    };
  }, [workouts]);

  // SVG Chart Layout
  const chartHeight = 96;
  const onChartLayout = (e: LayoutChangeEvent) => {
    const layoutWidth = e.nativeEvent.layout.width;
    if (layoutWidth > 0 && Math.abs(layoutWidth - chartWidth) > 2) {
      setChartWidth(layoutWidth);
    }
  };

  const chartPoints = useMemo(() => {
    const count = last7DaysData.length;
    const step = chartWidth / (count - 1 || 1);
    return last7DaysData.map((d, idx) => {
      const x = Math.max(8, Math.min(chartWidth - 8, idx * step));
      const clampedAcc = Math.max(0, Math.min(100, d.accuracy));
      const y = chartHeight - 14 - (clampedAcc / 100) * (chartHeight - 28);
      return { x, y, hasWorkouts: d.hasWorkouts };
    });
  }, [last7DaysData, chartWidth]);

  const linePath = chartPoints.length > 0 ? `M ${chartPoints.map((p) => `${p.x},${p.y}`).join(' L ')}` : '';
  const areaPath = chartPoints.length > 0
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x},${chartHeight} L ${chartPoints[0].x},${chartHeight} Z`
    : '';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 6, 16) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Statistics</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EC673C" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Day Hero Banner */}
          <View style={styles.heroSection}>
            <View style={styles.heroTopRow}>
              <Text style={[styles.heroDayNumber, { color: '#F6FE91' }]}>{selectedDay}</Text>
              <Text style={[styles.heroDayWeekday, { color: theme.muted }]}>{selectedWeekday}</Text>
            </View>

            {/* Month Switcher */}
            <View style={styles.monthSwitcherRow}>
              <Text style={[styles.monthLabel, { color: theme.text }]}>
                {MONTH_NAMES[month]} <Text style={{ fontWeight: '400', color: theme.muted }}>{year}</Text>
              </Text>
              <View style={styles.arrowsGroup}>
                <TouchableOpacity
                  onPress={handlePrevMonth}
                  style={[styles.arrowButton, { borderColor: theme.border, backgroundColor: theme.card }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={[styles.arrowButton, { borderColor: theme.border, backgroundColor: theme.card }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-forward" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Calendar Card */}
          <View style={[styles.calendarCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.weekHeaderRow}>
              {WEEK_DAYS.map((wd, i) => (
                <Text key={i} style={[styles.weekDayText, { color: theme.muted, width: dotSize }]}>
                  {wd}
                </Text>
              ))}
            </View>
            <View style={styles.dotsGrid}>
              {gridCells.map((item, index) => {
                if (item.day === 0) return <View key={index} style={{ width: dotSize, height: dotSize }} />;
                const isSelected = item.day === selectedDay;
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedDay(item.day)}
                    style={[
                      styles.dotCell,
                      {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: isSelected
                          ? '#F6FE91'
                          : item.active
                          ? '#EC673C'
                          : theme.isDark
                          ? 'rgba(255,255,255,0.08)'
                          : '#E5E5EA',
                      },
                    ]}
                    activeOpacity={0.7}
                  />
                );
              })}
            </View>

            {/* Selected Day Stats Ribbon */}
            <View style={[styles.dayRecapRow, { borderTopColor: theme.divider || theme.border }]}>
              <View style={styles.recapItem}>
                <Text style={[styles.recapLabel, { color: theme.muted }]}>Workouts</Text>
                <Text style={[styles.recapValue, { color: theme.text }]}>{activeDaySummary.workoutsCount}</Text>
              </View>
              <View style={styles.recapDivider} />
              <View style={styles.recapItem}>
                <Text style={[styles.recapLabel, { color: theme.muted }]}>Solved</Text>
                <Text style={[styles.recapValue, { color: theme.text }]}>{activeDaySummary.problemsSolved}</Text>
              </View>
              <View style={styles.recapDivider} />
              <View style={styles.recapItem}>
                <Text style={[styles.recapLabel, { color: theme.muted }]}>Pace</Text>
                <Text style={[styles.recapValue, { color: theme.text }]}>
                  {activeDaySummary.avgSpeed ? `${activeDaySummary.avgSpeed}s` : '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Range Selector */}
          <View style={styles.filterSectionRow}>
            <View style={styles.dropdownAnchorContainer}>
              <TouchableOpacity
                style={[
                  styles.rangeDropdownPill,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
                onPress={() => setIsDropdownOpen((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={15} color={theme.text} style={{ marginRight: 6 }} />
                <Text style={[styles.rangeDropdownText, { color: theme.text }]}>
                  {RANGE_LABELS[selectedRange]}
                </Text>
                <Ionicons
                  name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={theme.muted}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              {isDropdownOpen && (
                <View
                  style={[
                    styles.dropdownMenu,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  {(['week', 'month', 'year'] as TimeRange[]).map((rangeKey) => {
                    const isSelected = selectedRange === rangeKey;
                    return (
                      <TouchableOpacity
                        key={rangeKey}
                        style={[
                          styles.dropdownMenuItem,
                          isSelected && { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                        ]}
                        onPress={() => {
                          setSelectedRange(rangeKey);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownMenuItemText,
                            { color: isSelected ? '#EC673C' : theme.text },
                            isSelected && { fontWeight: '800' },
                          ]}
                        >
                          {RANGE_LABELS[rangeKey]}
                        </Text>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#EC673C" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* 4 Performance Metric Cards */}
          <View style={[styles.statsCardGrid, isNarrow && { gap: 8 }]}>
            {/* 1. Avg. Accuracy */}
            <View style={[styles.statBoxCard, { backgroundColor: theme.card }]}>
              <View style={[styles.statBoxIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.14)' }]}>
                <Ionicons name="locate-outline" size={17} color="#EC673C" />
              </View>
              <Text style={[styles.statBoxBigValue, { color: '#EC673C' }]}>
                {rangeStats.current.accuracy}%
              </Text>
              <Text style={[styles.statBoxLabel, { color: theme.muted }]}>Avg. Accuracy</Text>
              <Text style={styles.trendText} numberOfLines={1}>{rangeStats.diffs.accStr}</Text>
            </View>

            {/* 2. Total Time */}
            <View style={[styles.statBoxCard, { backgroundColor: theme.card }]}>
              <View style={[styles.statBoxIconCircle, { backgroundColor: 'rgba(175, 162, 254, 0.18)' }]}>
                <Ionicons name="timer-outline" size={17} color="#AFA2FE" />
              </View>
              <Text style={[styles.statBoxBigValue, { color: '#AFA2FE' }]} numberOfLines={1}>
                {rangeStats.current.timeFormatted}
              </Text>
              <Text style={[styles.statBoxLabel, { color: theme.muted }]}>Total Time</Text>
              <Text style={[styles.trendText, { color: '#AFA2FE' }]} numberOfLines={1}>
                {rangeStats.diffs.timeStr}
              </Text>
            </View>
          </View>

          <View style={[styles.statsCardGrid, { marginTop: 10 }, isNarrow && { gap: 8 }]}>
            {/* 3. Workouts */}
            <View style={[styles.statBoxCard, { backgroundColor: theme.card }]}>
              <View style={[styles.statBoxIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.14)' }]}>
                <Ionicons name="trending-up-outline" size={17} color="#EC673C" />
              </View>
              <Text style={[styles.statBoxBigValue, { color: '#EC673C' }]}>
                {rangeStats.current.workoutsCount}
              </Text>
              <Text style={[styles.statBoxLabel, { color: theme.muted }]}>Workouts</Text>
              <Text style={styles.trendText} numberOfLines={1}>{rangeStats.diffs.workoutStr}</Text>
            </View>

            {/* 4. Total XP */}
            <View style={[styles.statBoxCard, { backgroundColor: theme.card }]}>
              <View style={[styles.statBoxIconCircle, { backgroundColor: 'rgba(246, 254, 145, 0.25)' }]}>
                <Ionicons name="flash" size={17} color="#EC673C" />
              </View>
              <Text style={[styles.statBoxBigValue, { color: theme.text }]}>
                {rangeStats.current.xp}
              </Text>
              <Text style={[styles.statBoxLabel, { color: theme.muted }]}>Total XP</Text>
              <Text style={styles.trendText} numberOfLines={1}>{rangeStats.diffs.xpStr}</Text>
            </View>
          </View>

          {/* Accuracy Over Time (Real Last 7 Days) */}
          <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.chartCardHeader}>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Accuracy Over Time</Text>
              <View
                style={[
                  styles.chartFilterPill,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  },
                ]}
              >
                <Text style={[styles.chartFilterText, { color: theme.muted }]}>Last 7 Days</Text>
              </View>
            </View>

            <View style={styles.chartMainContent}>
              <View style={styles.yAxisLabels}>
                <Text style={[styles.axisText, { color: theme.muted }]}>100%</Text>
                <Text style={[styles.axisText, { color: theme.muted }]}>75%</Text>
                <Text style={[styles.axisText, { color: theme.muted }]}>50%</Text>
                <Text style={[styles.axisText, { color: theme.muted }]}>25%</Text>
                <Text style={[styles.axisText, { color: theme.muted }]}>0%</Text>
              </View>

              <View style={styles.chartPlot} onLayout={onChartLayout}>
                <Svg width={chartWidth} height={chartHeight} style={{ overflow: 'hidden' }}>
                  <Defs>
                    <SvgLinearGradient id="statsLineGradient" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#EC673C" stopOpacity="0.32" />
                      <Stop offset="100%" stopColor="#EC673C" stopOpacity="0.0" />
                    </SvgLinearGradient>
                  </Defs>
                  {areaPath ? <Path d={areaPath} fill="url(#statsLineGradient)" /> : null}
                  {linePath ? (
                    <Path d={linePath} stroke="#EC673C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  ) : null}
                  {chartPoints.map((pt, i) => (
                    <Circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill={pt.hasWorkouts ? '#EC673C' : theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  ))}
                </Svg>

                <View style={styles.xAxisLabels}>
                  {last7DaysData.map((d, i) => (
                    <Text key={i} style={[styles.xAxisText, { color: theme.muted }]}>
                      {d.label}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Overall Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Overall Summary</Text>

            <View style={styles.summaryStatsRow}>
              {/* Total Questions */}
              <View style={styles.summaryColumn}>
                <View style={[styles.summaryIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.12)' }]}>
                  <Ionicons name="checkmark-outline" size={17} color="#EC673C" />
                </View>
                <Text style={[styles.summaryValue, { color: '#EC673C' }]}>{overallSummary.totalQ}</Text>
                <Text style={[styles.summaryLabel, { color: theme.muted }]} numberOfLines={1}>
                  Total Questions
                </Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: theme.divider || theme.border }]} />

              {/* Correct */}
              <View style={styles.summaryColumn}>
                <View style={[styles.summaryIconCircle, { backgroundColor: 'rgba(246, 254, 145, 0.28)' }]}>
                  <Ionicons name="locate-outline" size={17} color="#EC673C" />
                </View>
                <Text style={[styles.summaryValue, { color: '#EC673C' }]}>{overallSummary.totalCorrect}</Text>
                <Text style={[styles.summaryLabel, { color: theme.muted }]} numberOfLines={1}>
                  Correct
                </Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: theme.divider || theme.border }]} />

              {/* Incorrect */}
              <View style={styles.summaryColumn}>
                <View style={[styles.summaryIconCircle, { backgroundColor: 'rgba(175, 162, 254, 0.18)' }]}>
                  <Ionicons name="close-outline" size={18} color="#AFA2FE" />
                </View>
                <Text style={[styles.summaryValue, { color: '#AFA2FE' }]}>{overallSummary.totalIncorrect}</Text>
                <Text style={[styles.summaryLabel, { color: theme.muted }]} numberOfLines={1}>
                  Incorrect
                </Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: theme.divider || theme.border }]} />

              {/* Avg. Time / Q */}
              <View style={styles.summaryColumn}>
                <View style={[styles.summaryIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.12)' }]}>
                  <Ionicons name="timer-outline" size={17} color="#EC673C" />
                </View>
                <Text style={[styles.summaryValue, { color: '#EC673C' }]}>{overallSummary.avgSecsPerQ}s</Text>
                <Text style={[styles.summaryLabel, { color: theme.muted }]} numberOfLines={1}>
                  Avg. Time / Q
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerSpacer: { width: 36 },
  scrollContent: { paddingHorizontal: 20 },

  /* Day Hero */
  heroSection: { marginTop: 4, marginBottom: 12 },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroDayNumber: { fontSize: 94, fontWeight: '900', lineHeight: 94, letterSpacing: -3 },
  heroDayWeekday: { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginTop: 8 },
  monthSwitcherRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  monthLabel: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  arrowsGroup: { flexDirection: 'row', gap: 8 },
  arrowButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  /* Calendar Card */
  calendarCard: { borderRadius: 24, borderWidth: 1, padding: 16, marginBottom: 16 },
  weekHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  weekDayText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  dotsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  dotCell: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  dayRecapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  recapItem: { alignItems: 'center' },
  recapLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  recapValue: { fontSize: 16, fontWeight: '800' },
  recapDivider: { width: 1, height: 24, backgroundColor: 'rgba(150, 150, 150, 0.2)' },

  /* Range Selector */
  filterSectionRow: {
    marginBottom: 14,
    zIndex: 20,
  },
  dropdownAnchorContainer: {
    alignSelf: 'flex-start',
    position: 'relative',
  },
  rangeDropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rangeDropdownText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 42,
    left: 0,
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 30,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownMenuItemText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Metric Cards */
  statsCardGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBoxCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statBoxIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statBoxBigValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EC673C',
  },

  /* Chart Card */
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginTop: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  chartFilterPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  chartFilterText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chartMainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxisLabels: {
    height: 96,
    justifyContent: 'space-between',
    paddingRight: 8,
    alignItems: 'flex-end',
  },
  axisText: {
    fontSize: 9,
    fontWeight: '600',
  },
  chartPlot: {
    flex: 1,
    overflow: 'hidden',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 8,
  },
  xAxisText: {
    fontSize: 9,
    fontWeight: '600',
  },

  /* Summary Card */
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  summaryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 38,
  },
});