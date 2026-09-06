import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Share,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../src/components/GlassCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { QuestionAttemptResult, OperationType } from '../../src/lib/math/types';
import { saveWorkoutSession, setPendingDemoSession } from '../../src/services/workoutService';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();

  const isNarrow = width < 360;
  const isCompactHeight = height < 700;

  const { mode, difficulty, results, isDemo } = useLocalSearchParams<{
    mode?: string;
    difficulty?: string;
    results?: string;
    isDemo?: string;
  }>();

  const { session } = useAuth();
  const isDemoWorkout = isDemo === 'true' || (!session && isDemo !== 'false');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chartContainerWidth, setChartContainerWidth] = useState(width - 80);
  const hasSavedRef = useRef(false);

  // Entrance animation
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.quad),
    });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Parse results
  const attempts: QuestionAttemptResult[] = useMemo(() => {
    if (!results) return [];
    try {
      return JSON.parse(results);
    } catch (err) {
      console.error('Failed to parse workout results payload', err);
      return [];
    }
  }, [results]);

  // Session persistence
  useEffect(() => {
    if (attempts.length === 0 || hasSavedRef.current) return;
    hasSavedRef.current = true;

    const activeMode = (mode as OperationType) || 'mixed';
    const activeDiff = difficulty || 'easy';

    async function handlePersistence() {
      if (isDemoWorkout) {
        await setPendingDemoSession(attempts, activeMode, activeDiff);
      } else {
        setSaving(true);
        const { error } = await saveWorkoutSession(attempts, activeMode, activeDiff);
        setSaving(false);
        if (error) {
          setSaveError('Failed to save session online. Results stored locally.');
        }
      }
    }

    handlePersistence();
  }, [attempts, mode, difficulty, isDemoWorkout]);

  // Stats calculation
  const totalQuestions = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const incorrectCount = totalQuestions - correctCount;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const totalXpEarned = correctCount * 10 + (accuracy >= 80 ? 25 : 0);

  const totalTimeSpentMs = attempts.reduce((acc, item) => acc + item.timeTakenMs, 0);
  const averageTimePerQuestionMs = totalQuestions > 0 ? totalTimeSpentMs / totalQuestions : 0;

  const formatTimer = (ms: number): string => {
    const totalSecs = Math.max(0, Math.round(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAvgTime = (ms: number): string => {
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getAccuracyFeedback = (pct: number) => {
    if (pct >= 85) {
      return {
        badgeText: '★ Outstanding!',
        subtitle: 'Great job! Keep training your mind 💪',
        color: '#EC673C',
        badgeBg: 'rgba(236, 103, 60, 0.16)',
      };
    }
    if (pct >= 70) {
      return {
        badgeText: '★ Great Work!',
        subtitle: 'Consistent work pays off, keep pushing! 🔥',
        color: '#AFA2FE',
        badgeBg: 'rgba(175, 162, 254, 0.2)',
      };
    }
    if (pct >= 50) {
      return {
        badgeText: '★ Good Start!',
        subtitle: 'You are making steady progress every run 🚀',
        color: '#EC673C',
        badgeBg: 'rgba(236, 103, 60, 0.14)',
      };
    }
    return {
      badgeText: '★ Keep Going!',
      subtitle: 'Practice builds speed and precision! 🧠',
      color: '#EC673C',
      badgeBg: 'rgba(236, 103, 60, 0.12)',
    };
  };

  const feedback = getAccuracyFeedback(accuracy);

  const getModeLabel = (): string => {
    if (!mode) return 'Mixed ( + − × ÷ )';
    switch (mode.toLowerCase()) {
      case 'addition':
        return 'Addition ( + )';
      case 'subtraction':
        return 'Subtraction ( − )';
      case 'multiplication':
        return 'Multiplication ( × )';
      case 'division':
        return 'Division ( ÷ )';
      case 'adaptive_mix':
      case 'mixed':
      default:
        return 'Mixed ( + − × ÷ )';
    }
  };

  const formattedDate = useMemo(() => {
    const now = new Date();
    const datePart = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} • ${timePart}`;
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `NUMO Workout Finished! 🎯 ${accuracy}% Accuracy, ${correctCount}/${totalQuestions} correct in ${formatTimer(
          totalTimeSpentMs
        )}!`,
      });
    } catch {
      // Ignored
    }
  };

  /**
   * RESET & START NEW WORKOUT FIX:
   * Strips out previous results and sends explicit restart parameters
   * with a fresh timestamp so the workout screen starts from question #1.
   */
  const handleStartNewWorkout = () => {
    router.replace({
      pathname: '/(app)/workout' as any,
      params: {
        mode: mode || 'mixed',
        difficulty: difficulty || 'easy',
        reset: 'true',
        sessionKey: Date.now().toString(),
        isDemo: isDemoWorkout ? 'true' : 'false',
        results: undefined, // Clear any previous attempt cache
      },
    });
  };

  // Trend buckets calculation
  const trendBuckets = useMemo(() => {
    if (totalQuestions === 0) {
      return [
        { label: '1-5', pct: 0 },
        { label: '6-10', pct: 0 },
        { label: '11-15', pct: 0 },
        { label: '16-20', pct: 0 },
      ];
    }
    const bucketSize = Math.max(1, Math.ceil(totalQuestions / 4));
    const resultBuckets = [];
    for (let i = 0; i < 4; i++) {
      const start = i * bucketSize;
      const end = Math.min(start + bucketSize, totalQuestions);
      const slice = attempts.slice(start, end);
      const correctInSlice = slice.filter((item) => item.isCorrect).length;
      const pct = slice.length > 0 ? (correctInSlice / slice.length) * 100 : accuracy;
      const label = `${start + 1}-${end > start ? end : start + 1}`;
      resultBuckets.push({ label, pct });
    }
    return resultBuckets;
  }, [attempts, totalQuestions, accuracy]);

  // Responsive ring
  const circleSize = isNarrow ? 96 : 108;
  const strokeWidth = isNarrow ? 8 : 9;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (accuracy / 100) * circumference;

  // Chart responsiveness & bounds
  const onChartLayout = (e: LayoutChangeEvent) => {
    const layoutWidth = e.nativeEvent.layout.width;
    if (layoutWidth > 0 && Math.abs(layoutWidth - chartContainerWidth) > 2) {
      setChartContainerWidth(layoutWidth);
    }
  };

  const chartHeight = isCompactHeight ? 75 : 85;
  const safeTopPadding = 10;
  const safeBottomPadding = 10;
  const usableChartHeight = chartHeight - safeTopPadding - safeBottomPadding;

  const chartPoints = trendBuckets.map((bucket, index) => {
    const step = chartContainerWidth / 4;
    const x = Math.max(10, Math.min(chartContainerWidth - 10, step * index + step / 2));
    const normalizedPct = Math.max(0, Math.min(100, bucket.pct));
    const y = chartHeight - safeBottomPadding - (normalizedPct / 100) * usableChartHeight;
    return { x, y };
  });

  const linePath =
    chartPoints.length > 0 ? `M ${chartPoints.map((p) => `${p.x},${p.y}`).join(' L ')}` : '';
  const areaPath =
    chartPoints.length > 0
      ? `${linePath} L ${chartPoints[chartPoints.length - 1].x},${chartHeight - 2} L ${chartPoints[0].x},${chartHeight - 2} Z`
      : '';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Header Top Bar */}
      <View style={[styles.topBar, { paddingHorizontal: isNarrow ? 14 : 20 }]}>
        <TouchableOpacity
          style={[
            styles.navIconButton,
            {
              backgroundColor: theme.card,
              borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
          onPress={() => router.replace('/(app)')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isNarrow ? 18 : 20} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.titleCenter}>
          <Text style={[styles.mainScreenTitle, { color: theme.text, fontSize: isNarrow ? 15 : 17 }]}>
            Workout Results
          </Text>
          <Text style={[styles.mainScreenSubtitle, { color: theme.subtext }]} numberOfLines={1}>
            {feedback.subtitle}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.navIconButton,
            {
              backgroundColor: theme.card,
              borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={isNarrow ? 18 : 19} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isNarrow ? 14 : 20,
            paddingBottom: Math.max(insets.bottom + 16, 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.container, animatedStyle]}>
          {/* Sync Status Toast */}
          {!isDemoWorkout && saving && (
            <View style={styles.statusToast}>
              <ActivityIndicator size="small" color="#EC673C" />
              <Text style={[styles.statusToastText, { color: theme.muted }]}>Saving workout results...</Text>
            </View>
          )}
          {saveError && <Text style={styles.errorText}>{saveError}</Text>}

          {/* Hero Accuracy Card */}
          <GlassCard style={[styles.heroCard, isNarrow && styles.heroCardNarrow]} intensity={50}>
            <View style={[styles.heroInnerRow, isNarrow && styles.heroInnerRowNarrow]}>
              {/* Left Circular Ring */}
              <View style={[styles.circleWrapper, { width: circleSize, height: circleSize }]}>
                <Svg width={circleSize} height={circleSize}>
                  <Circle
                    cx={circleSize / 2}
                    cy={circleSize / 2}
                    r={radius}
                    stroke={theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}
                    strokeWidth={strokeWidth}
                    fill="none"
                  />
                  <Circle
                    cx={circleSize / 2}
                    cy={circleSize / 2}
                    r={radius}
                    stroke="#EC673C"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={progressOffset}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
                  />
                </Svg>
                <View style={styles.circleCenterText}>
                  <Text style={[styles.circlePercentage, { color: theme.text, fontSize: isNarrow ? 20 : 24 }]}>
                    {accuracy}%
                  </Text>
                  <Text style={[styles.circleLabel, { color: theme.muted }]}>Accuracy</Text>
                </View>
              </View>

              {/* Right Hero Info */}
              <View style={styles.heroInfoColumn}>
                <View style={[styles.heroBadge, { backgroundColor: feedback.badgeBg }]}>
                  <Text style={[styles.heroBadgeText, { color: feedback.color }]}>{feedback.badgeText}</Text>
                </View>

                <Text style={[styles.heroDescriptionText, { color: theme.text }]} numberOfLines={2}>
                  You completed the workout{'\n'}
                  <Text style={{ color: theme.subtext }}>Keep it up!</Text>
                </Text>

                <View style={[styles.heroStatsSubRow, { borderTopColor: theme.divider }]}>
                  <View style={styles.statMiniGroup}>
                    <View style={styles.statMiniHeader}>
                      <Ionicons name="time-outline" size={13} color="#EC673C" />
                      <Text style={[styles.statMiniLabel, { color: theme.muted }]}>Total Time</Text>
                    </View>
                    <Text style={[styles.statMiniValue, { color: theme.text }]}>
                      {formatTimer(totalTimeSpentMs)}
                    </Text>
                  </View>

                  <View style={[styles.miniDivider, { backgroundColor: theme.divider }]} />

                  <View style={styles.statMiniGroup}>
                    <View style={styles.statMiniHeader}>
                      <Ionicons name="flash" size={13} color="#F6FE91" />
                      <Text style={[styles.statMiniLabel, { color: theme.muted }]}>Total XP</Text>
                    </View>
                    <Text style={[styles.statMiniValue, { color: theme.text }]}>+{totalXpEarned}</Text>
                  </View>
                </View>
              </View>
            </View>
          </GlassCard>

          {/* Section: Overview */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Overview</Text>
          <View style={[styles.overviewGrid, isNarrow && { gap: 6 }]}>
            <View style={[styles.overviewItemCard, { backgroundColor: theme.card }]}>
              <View style={[styles.overviewIconCircle, { backgroundColor: 'rgba(175, 162, 254, 0.18)' }]}>
                <Ionicons name="grid-outline" size={15} color="#AFA2FE" />
              </View>
              <Text style={[styles.overviewBigValue, { color: '#AFA2FE', fontSize: isNarrow ? 16 : 18 }]}>
                {totalQuestions}
              </Text>
              <Text style={[styles.overviewSmallLabel, { color: theme.muted }]} numberOfLines={1}>
                {isNarrow ? 'Total' : 'Total Questions'}
              </Text>
            </View>

            <View style={[styles.overviewItemCard, { backgroundColor: theme.card }]}>
              <View style={[styles.overviewIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.16)' }]}>
                <Ionicons name="locate-outline" size={15} color="#EC673C" />
              </View>
              <Text style={[styles.overviewBigValue, { color: '#EC673C', fontSize: isNarrow ? 16 : 18 }]}>
                {correctCount}
              </Text>
              <Text style={[styles.overviewSmallLabel, { color: theme.muted }]} numberOfLines={1}>
                Correct
              </Text>
            </View>

            <View style={[styles.overviewItemCard, { backgroundColor: theme.card }]}>
              <View style={[styles.overviewIconCircle, { backgroundColor: 'rgba(175, 162, 254, 0.18)' }]}>
                <Ionicons name="close" size={15} color="#AFA2FE" />
              </View>
              <Text style={[styles.overviewBigValue, { color: '#AFA2FE', fontSize: isNarrow ? 16 : 18 }]}>
                {incorrectCount}
              </Text>
              <Text style={[styles.overviewSmallLabel, { color: theme.muted }]} numberOfLines={1}>
                Incorrect
              </Text>
            </View>

            <View style={[styles.overviewItemCard, { backgroundColor: theme.card }]}>
              <View style={[styles.overviewIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.16)' }]}>
                <Ionicons name="timer-outline" size={15} color="#EC673C" />
              </View>
              <Text
                style={[
                  styles.overviewBigValue,
                  { color: '#EC673C', fontSize: isNarrow ? 15 : 18 },
                ]}
                numberOfLines={1}
              >
                {formatAvgTime(averageTimePerQuestionMs)}
              </Text>
              <Text style={[styles.overviewSmallLabel, { color: theme.muted }]} numberOfLines={1}>
                {isNarrow ? 'Avg/Q' : 'Avg. Time / Q'}
              </Text>
            </View>
          </View>

          {/* Section: Workout Details */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Workout Details</Text>
          <View style={[styles.listCard, { backgroundColor: theme.card }]}>
            <View style={styles.listRow}>
              <View style={styles.listRowLeft}>
                <View style={[styles.listIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.16)' }]}>
                  <Ionicons name="calculator-outline" size={15} color="#EC673C" />
                </View>
                <Text style={[styles.listRowTitle, { color: theme.text }]}>Mode</Text>
              </View>
              <Text style={[styles.listRowValue, { color: theme.subtext }]}>{getModeLabel()}</Text>
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.listRow}>
              <View style={styles.listRowLeft}>
                <View style={[styles.listIconCircle, { backgroundColor: 'rgba(175, 162, 254, 0.18)' }]}>
                  <Ionicons name="bar-chart-outline" size={15} color="#AFA2FE" />
                </View>
                <Text style={[styles.listRowTitle, { color: theme.text }]}>Level</Text>
              </View>
              <Text style={[styles.listRowValue, { color: theme.subtext }]}>
                {(difficulty || 'Easy').charAt(0).toUpperCase() + (difficulty || 'Easy').slice(1)}
              </Text>
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.listRow}>
              <View style={styles.listRowLeft}>
                <View style={[styles.listIconCircle, { backgroundColor: 'rgba(175, 162, 254, 0.18)' }]}>
                  <Ionicons name="help-circle-outline" size={15} color="#AFA2FE" />
                </View>
                <Text style={[styles.listRowTitle, { color: theme.text }]}>Questions</Text>
              </View>
              <Text style={[styles.listRowValue, { color: theme.subtext }]}>{totalQuestions}</Text>
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.listRow}>
              <View style={styles.listRowLeft}>
                <View style={[styles.listIconCircle, { backgroundColor: 'rgba(236, 103, 60, 0.16)' }]}>
                  <Ionicons name="calendar-outline" size={15} color="#EC673C" />
                </View>
                <Text style={[styles.listRowTitle, { color: theme.text }]}>Date</Text>
              </View>
              <Text style={[styles.listRowValue, { color: theme.subtext }]}>{formattedDate}</Text>
            </View>
          </View>

          {/* Section: Accuracy Trend */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Accuracy Trend</Text>
          <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
            <View style={styles.chartContainer}>
              {/* Y Axis Labels */}
              <View style={styles.yAxisLabels}>
                <Text style={[styles.axisLabelText, { color: theme.muted }]}>100%</Text>
                <Text style={[styles.axisLabelText, { color: theme.muted }]}>75%</Text>
                <Text style={[styles.axisLabelText, { color: theme.muted }]}>50%</Text>
                <Text style={[styles.axisLabelText, { color: theme.muted }]}>25%</Text>
                <Text style={[styles.axisLabelText, { color: theme.muted }]}>0%</Text>
              </View>

              {/* Chart Plot Area */}
              <View style={styles.chartPlotArea} onLayout={onChartLayout}>
                <View style={[styles.svgWrapper, { height: chartHeight }]}>
                  <Svg width={chartContainerWidth} height={chartHeight} style={{ overflow: 'hidden' }}>
                    <Defs>
                      <SvgLinearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#EC673C" stopOpacity="0.3" />
                        <Stop offset="100%" stopColor="#EC673C" stopOpacity="0.0" />
                      </SvgLinearGradient>
                    </Defs>
                    {areaPath ? <Path d={areaPath} fill="url(#trendGradient)" /> : null}
                    {linePath ? (
                      <Path d={linePath} stroke="#EC673C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    ) : null}
                    {chartPoints.map((pt, i) => (
                      <Circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="#EC673C" stroke="#FFFFFF" strokeWidth="1.5" />
                    ))}
                  </Svg>
                </View>

                {/* X Axis Labels */}
                <View style={styles.xAxisLabels}>
                  {trendBuckets.map((bucket, index) => (
                    <Text key={index} style={[styles.axisLabelText, { color: theme.muted }]}>
                      {bucket.label}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.bottomButtonsSection}>
            {isDemoWorkout ? (
              <View style={styles.demoActionBox}>
                <View style={[styles.demoBannerCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.sparkleIconBox, { backgroundColor: 'rgba(236, 103, 60, 0.14)' }]}>
                    <Ionicons name="sparkles" size={18} color="#EC673C" />
                  </View>
                  <View style={styles.demoBannerTextGroup}>
                    <Text style={[styles.demoBannerTitle, { color: theme.text }]}>Save Your Progress</Text>
                    <Text style={[styles.demoBannerSubtitle, { color: theme.subtext }]}>
                      Save this workout and start tracking your progress.
                    </Text>
                  </View>
                </View>

                <PrimaryButton
                  title="Create Free Account"
                  onPress={() => router.push('/(auth)/signup')}
                  icon={<Ionicons name="person-add" size={18} color="#1C1C1E" />}
                  style={[styles.fullWidthButton, { backgroundColor: '#F6FE91' }]}
                  textStyle={styles.actionButtonText}
                />

                <TouchableOpacity
                  style={styles.loginLinkButton}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(auth)/login')}
                >
                  <Text style={[styles.loginLinkText, { color: theme.subtext }]}>
                    Already have an account? <Text style={[styles.loginBoldText, { color: '#EC673C' }]}>Log In</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.authenticatedButtonRow, isNarrow && styles.authenticatedButtonRowNarrow]}>
                <TouchableOpacity
                  style={[
                    styles.backToDashboardButton,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    },
                    isNarrow && styles.buttonNarrow,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => router.replace('/(app)')}
                >
                  <Ionicons name="grid-outline" size={16} color={theme.text} style={{ marginRight: 6 }} />
                  <Text style={[styles.backToDashboardText, { color: theme.text }]} numberOfLines={1}>
                    Dashboard
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.startWorkoutButton,
                    { backgroundColor: '#F6FE91' },
                    isNarrow && styles.buttonNarrow,
                  ]}
                  activeOpacity={0.85}
                  onPress={handleStartNewWorkout}
                >
                  <Text style={styles.startWorkoutText} numberOfLines={1}>
                    New Workout
                  </Text>
                  <Ionicons name="flash" size={15} color="#1C1C1E" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  navIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  titleCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  mainScreenTitle: {
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  mainScreenSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 6,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  statusToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusToastText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11,
    color: '#EC673C',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroCard: {
    width: '100%',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  heroCardNarrow: {
    padding: 12,
  },
  heroInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroInnerRowNarrow: {
    gap: 10,
  },
  circleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePercentage: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  circleLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  heroInfoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 5,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroDescriptionText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 8,
  },
  heroStatsSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  statMiniGroup: {
    flex: 1,
  },
  statMiniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statMiniLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  statMiniValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  miniDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 6,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  overviewItemCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  overviewIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  overviewBigValue: {
    fontWeight: '800',
    marginBottom: 1,
  },
  overviewSmallLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  listCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  listRowValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  chartCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxisLabels: {
    height: 85,
    justifyContent: 'space-between',
    paddingRight: 8,
    alignItems: 'flex-end',
  },
  axisLabelText: {
    fontSize: 9,
    fontWeight: '600',
  },
  chartPlotArea: {
    flex: 1,
    overflow: 'hidden',
  },
  svgWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 6,
  },
  bottomButtonsSection: {
    marginTop: 2,
  },
  authenticatedButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  authenticatedButtonRowNarrow: {
    gap: 6,
  },
  backToDashboardButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  backToDashboardText: {
    fontSize: 13,
    fontWeight: '700',
  },
  startWorkoutButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    shadowColor: '#F6FE91',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  startWorkoutText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  buttonNarrow: {
    minHeight: 44,
  },
  fullWidthButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
  },
  actionButtonText: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '800',
  },
  demoActionBox: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  demoBannerCard: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sparkleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBannerTextGroup: {
    flex: 1,
  },
  demoBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  demoBannerSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  loginLinkButton: {
    paddingVertical: 4,
  },
  loginLinkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loginBoldText: {
    fontWeight: '800',
  },
});