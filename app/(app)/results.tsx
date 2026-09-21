import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuestionAttemptResult, OperationType } from '../../src/lib/math/types';
import {
  saveWorkoutSession,
  setPendingDemoSession,
  getRecentWorkouts,
} from '../../src/services/workoutService';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

const PALETTE = {
  primary: '#BCE3AA',
  accentLilac: '#F2CAEC',
  backgroundLight: '#F1ECE9',
  dark: '#0A0F0B',
  white: '#FFFFFF',
  dangerText: '#EB5757',
};

const STORAGE_LAST_SUMMARY_KEY = 'numo_last_workout_summary_v1';

interface PriorWorkoutSummary {
  accuracy: number;
  avgTimeSecs: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string;
}

function AnimatedRollingNumber({
  target,
  duration = 750,
  style,
  suffix = '',
  prefix = '',
}: {
  target: number;
  duration?: number;
  style?: any;
  suffix?: string;
  prefix?: string;
}) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    if (isNaN(target) || target <= 0) {
      setDisplayVal(0);
      return;
    }
    let start = 0;
    const steps = 20;
    const intervalTime = Math.max(16, Math.floor(duration / steps));
    const increment = target / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setDisplayVal(target);
        clearInterval(timer);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else {
        setDisplayVal(Math.floor(start));
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [target, duration]);

  return (
    <Text style={style}>
      {prefix}
      {displayVal}
      {suffix}
    </Text>
  );
}

function IconStage({
  icon,
  iconColor,
  haloColor,
  discColor,
  size = 54,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  haloColor: string;
  discColor: string;
  size?: number;
}) {
  const floatAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.7);

  useEffect(() => {
    scaleAnim.value = withSpring(1, { damping: 11, stiffness: 120 });
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [floatAnim, scaleAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }, { scale: scaleAnim.value }],
  }));

  return (
    <View style={styles.stageOuterWrap}>
      <View style={[styles.haloGlow, { backgroundColor: haloColor }]} />
      <Animated.View style={[styles.floatingBadge, { backgroundColor: discColor }, animatedStyle]}>
        <Ionicons name={icon} size={size} color={iconColor} />
      </Animated.View>
      <View style={styles.pedestalShadow} />
    </View>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { session } = useAuth();

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');

  const { mode, difficulty, results, isDemo, sessionKey } = useLocalSearchParams<{
    mode?: string;
    difficulty?: string;
    results?: string;
    isDemo?: string;
    sessionKey?: string;
  }>();

  const isDemoWorkout = isDemo === 'true' || (!session && isDemo !== 'false');

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [priorSummary, setPriorSummary] = useState<PriorWorkoutSummary | null>(null);
  const [showMistakesModal, setShowMistakesModal] = useState(false);

  const stepOpacity = useSharedValue(1);
  const stepTranslateX = useSharedValue(0);
  const hasSavedRef = useRef(false);

  // RESET ROUTINE: Ensures every session starts fresh at Step 1
  useEffect(() => {
    setCurrentStep(1);
    hasSavedRef.current = false;
    stepOpacity.value = 1;
    stepTranslateX.value = 0;
  }, [sessionKey, results, stepOpacity, stepTranslateX]);

  // Parse Attempts with normalized timeTakenMs
  const attempts: QuestionAttemptResult[] = useMemo(() => {
    if (!results) return [];
    try {
      const decoded = results.startsWith('%') ? decodeURIComponent(results) : results;
      const parsed = JSON.parse(decoded);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: any) => ({
        ...item,
        timeTakenMs: item.timeTakenMs ?? item.timeSpentMs ?? 1800,
      }));
    } catch {
      return [];
    }
  }, [results]);

  // Current Metrics
  const totalQuestions = attempts.length;
  const correctAttempts = attempts.filter((a) => a.isCorrect);
  const missedAttempts = attempts.filter((a) => !a.isCorrect);
  const correctCount = correctAttempts.length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const totalTimeSpentMs = attempts.reduce((acc, item) => acc + (item.timeTakenMs || 0), 0);
  const avgPaceNum = totalQuestions > 0 && totalTimeSpentMs > 0
    ? parseFloat((totalTimeSpentMs / totalQuestions / 1000).toFixed(1))
    : 1.8;

  // Coaching Feedback
  const performanceVerdict = useMemo(() => {
    if (accuracy >= 90 && avgPaceNum <= 2.2) {
      return {
        title: 'Fast & accurate',
        desc: 'Sharp instinct and quick retrieval under pressure.',
      };
    }
    if (accuracy >= 80 && avgPaceNum > 2.2) {
      return {
        title: 'Accurate, steady pace',
        desc: 'High precision round. Speed will build naturally with reps.',
      };
    }
    if (accuracy < 75 && avgPaceNum <= 1.9) {
      return {
        title: 'Fast, but watch accuracy',
        desc: 'Quick answers, but take half a second to verify mental carries.',
      };
    }
    return {
      title: 'Keep building consistency',
      desc: 'Solid session completed. Daily consistency builds mental fluency.',
    };
  }, [accuracy, avgPaceNum]);

  // Recommendation logic
  const recommendation = useMemo(() => {
    const opStats: Record<string, { total: number; incorrect: number; totalTime: number }> = {};

    attempts.forEach((a) => {
      const op = a.question?.operation || mode || 'mixed';
      if (!opStats[op]) opStats[op] = { total: 0, incorrect: 0, totalTime: 0 };
      opStats[op].total += 1;
      opStats[op].totalTime += (a.timeTakenMs || 1800);
      if (!a.isCorrect) opStats[op].incorrect += 1;
    });

    let worstOp = (mode as OperationType) || 'mixed';
    let highestFriction = -1;

    Object.entries(opStats).forEach(([op, stats]) => {
      const errorWeight = (stats.incorrect / stats.total) * 12;
      const timeWeight = stats.totalTime / stats.total / 1000;
      const frictionScore = errorWeight + timeWeight;

      if (frictionScore > highestFriction) {
        highestFriction = frictionScore;
        worstOp = op as OperationType;
      }
    });

    const displayOp = worstOp.charAt(0).toUpperCase() + worstOp.slice(1);

    if (missedAttempts.length > 0) {
      return {
        targetMode: worstOp,
        badge: `FOCUS: ${displayOp.toUpperCase()}`,
        title: `Practice ${displayOp} next`,
        desc: `Solid workout, but had slight hesitation on ${displayOp}. 10 targeted questions will smooth it out.`,
      };
    }

    return {
      targetMode: worstOp,
      badge: 'CHALLENGE LEVEL UP',
      title: `Keep pace on ${displayOp}`,
      desc: 'Flawless execution. Maintain this speed on your next round.',
    };
  }, [attempts, mode, missedAttempts.length]);

  // Single Save Routine + Baseline Loading
  useEffect(() => {
    if (attempts.length === 0 || hasSavedRef.current) return;
    hasSavedRef.current = true;

    async function persistAndLoadComparison() {
      // 1. Fetch prior summary for Beat 2 comparison
      try {
        const cachedPrior = await AsyncStorage.getItem(STORAGE_LAST_SUMMARY_KEY);
        if (cachedPrior) {
          setPriorSummary(JSON.parse(cachedPrior));
        } else if (!isDemoWorkout) {
          const dbRecents = await getRecentWorkouts();
          if (dbRecents && dbRecents.length > 0) {
            const last = dbRecents[0];
            setPriorSummary({
              accuracy: Math.round(last.accuracy),
              avgTimeSecs: parseFloat(((last.average_time_per_question || 2000) / 1000).toFixed(1)),
              correctCount: last.correct_answers,
              totalQuestions: last.total_questions,
              completedAt: last.completed_at,
            });
          }
        }
      } catch (e) {
        console.warn('Could not load prior summary:', e);
      }

      // 2. Persist this workout summary locally for next time
      const currentSummary: PriorWorkoutSummary = {
        accuracy,
        avgTimeSecs: avgPaceNum,
        correctCount,
        totalQuestions,
        completedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_LAST_SUMMARY_KEY, JSON.stringify(currentSummary));

      // 3. Save to Supabase exactly once
      const activeMode = (mode as OperationType) || 'mixed';
      const activeDiff = difficulty || 'easy';

      if (isDemoWorkout) {
        await setPendingDemoSession(attempts, activeMode, activeDiff);
      } else {
        await saveWorkoutSession(attempts, activeMode, activeDiff, session?.user?.id);
      }
    }

    persistAndLoadComparison();
  }, [attempts, mode, difficulty, isDemoWorkout, accuracy, avgPaceNum, correctCount, totalQuestions, session?.user?.id]);

  // Comparison Deltas
  const comparisonData = useMemo(() => {
    if (!priorSummary) return null;

    const accDiff = accuracy - priorSummary.accuracy;
    const timeDiff = parseFloat((avgPaceNum - priorSummary.avgTimeSecs).toFixed(1));
    const scoreDiff = correctCount - priorSummary.correctCount;

    return {
      accuracyDelta: `${accDiff >= 0 ? '+' : ''}${accDiff}%`,
      isAccPositive: accDiff >= 0,
      timeDelta:
        timeDiff === 0
          ? 'Same pace'
          : timeDiff < 0
          ? `${Math.abs(timeDiff)}s faster`
          : `${timeDiff}s slower`,
      isTimePositive: timeDiff <= 0,
      scoreDelta: `${scoreDiff >= 0 ? '+' : ''}${scoreDiff}`,
      isScorePositive: scoreDiff >= 0,
    };
  }, [priorSummary, accuracy, avgPaceNum, correctCount]);

  const advanceStep = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    stepOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(handleNextStep)();
    });
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as 2 | 3);
      stepTranslateX.value = 24;
      stepOpacity.value = withTiming(1, { duration: 220 });
      stepTranslateX.value = withSpring(0, { damping: 14 });
    }
  };

  const handleStartNextWorkout = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const targetPayload = {
      mode: recommendation.targetMode || 'mixed',
      difficulty: difficulty || 'easy',
      reset: 'true',
      sessionKey: Date.now().toString(),
    };

    try {
      router.replace({
        pathname: '/(app)/workout' as any,
        params: targetPayload,
      });
    } catch {
      router.replace({
        pathname: '/workout' as any,
        params: targetPayload,
      });
    }
  };

  const handleGoHome = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace('/(app)');
  };

  const stepAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
    transform: [{ translateX: stepTranslateX.value }],
  }));

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const textColor = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const subtextColor = isDark ? 'rgba(241, 236, 233, 0.65)' : 'rgba(10, 15, 11, 0.55)';
  const cardBg = isDark ? '#141C15' : PALETTE.white;
  const borderSubtle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 15, 11, 0.08)';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={screenBg} />

      {/* TOP TIMELINE NAVIGATION */}
      <View style={styles.topTimelineWrapper}>
        <View style={styles.topTimelineRow}>
          <View style={styles.timelineSegmentsRow}>
            {[1, 2, 3].map((step) => {
              const isFilled = step <= currentStep;
              return (
                <View
                  key={step}
                  style={[
                    styles.timelineSegment,
                    {
                      backgroundColor: isFilled
                        ? PALETTE.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(10, 15, 11, 0.1)',
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.timelineActionWrap}>
            {currentStep === 1 ? (
              <TouchableOpacity
                style={[styles.closeIconBtn, { backgroundColor: cardBg }]}
                onPress={handleGoHome}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={18} color={textColor} />
              </TouchableOpacity>
            ) : (
              <View style={styles.closeIconPlaceholder} />
            )}
          </View>
        </View>
      </View>

      {/* BODY CONTENT CONTAINER */}
      <Animated.View style={[styles.contentWrapper, stepAnimatedStyle]}>
        {/* BEAT 1: YOUR RESULT */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            <IconStage
              icon="sparkles"
              iconColor={PALETTE.dark}
              discColor={PALETTE.accentLilac}
              haloColor={isDark ? 'rgba(242, 202, 236, 0.12)' : 'rgba(242, 202, 236, 0.35)'}
              size={52}
            />

            <Text style={[styles.stepHeadline, { color: textColor }]}>Workout complete</Text>

            <View style={styles.scoreRow}>
              <AnimatedRollingNumber target={correctCount} style={[styles.massiveScoreText, { color: textColor }]} />
              <Text style={[styles.massiveScoreDivider, { color: subtextColor }]}>/{totalQuestions}</Text>
            </View>

            <Text style={[styles.metricSubtitle, { color: textColor }]}>
              {accuracy}% accuracy · {avgPaceNum}s average
            </Text>

            <View style={[styles.interpretationCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <Text style={[styles.interpretationTitle, { color: textColor }]}>
                {performanceVerdict.title}
              </Text>
              <Text style={[styles.interpretationDesc, { color: subtextColor }]}>
                {performanceVerdict.desc}
              </Text>
            </View>

            {missedAttempts.length > 0 ? (
              <TouchableOpacity
                style={[styles.mistakeReviewPill, { backgroundColor: isDark ? 'rgba(235, 87, 87, 0.16)' : 'rgba(235, 87, 87, 0.08)' }]}
                activeOpacity={0.8}
                onPress={() => setShowMistakesModal(true)}
              >
                <Ionicons name="eye-outline" size={15} color={PALETTE.dangerText} />
                <Text style={styles.mistakeReviewPillText}>
                  Review {missedAttempts.length} missed {missedAttempts.length === 1 ? 'question' : 'questions'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={PALETTE.dangerText} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.flawlessPill, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.18)' : 'rgba(188, 227, 170, 0.35)' }]}>
                <Ionicons name="shield-checkmark" size={15} color={PALETTE.dark} />
                <Text style={styles.flawlessPillText}>Flawless Round · 100% Accuracy</Text>
              </View>
            )}
          </View>
        )}

        {/* BEAT 2: YOUR PROGRESS */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            <IconStage
              icon="trending-up"
              iconColor={PALETTE.dark}
              discColor={PALETTE.primary}
              haloColor={isDark ? 'rgba(188, 227, 170, 0.14)' : 'rgba(188, 227, 170, 0.4)'}
              size={54}
            />

            <Text style={[styles.stepHeadline, { color: textColor }]}>Your progress</Text>
            <Text style={[styles.stepSubtitle, { color: subtextColor }]}>
              {comparisonData ? 'Compared to your last workout' : 'Establishing your personal standard'}
            </Text>

            {comparisonData ? (
              <View style={[styles.comparisonCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableColHeader, { color: subtextColor }]}>Metric</Text>
                  <Text style={[styles.tableColHeader, { color: subtextColor, textAlign: 'center' }]}>Today</Text>
                  <Text style={[styles.tableColHeader, { color: subtextColor, textAlign: 'right' }]}>Change</Text>
                </View>

                <View style={[styles.tableDivider, { backgroundColor: borderSubtle }]} />

                <View style={styles.tableRow}>
                  <Text style={[styles.tableLabel, { color: textColor }]}>Accuracy</Text>
                  <Text style={[styles.tableValue, { color: textColor, textAlign: 'center' }]}>{accuracy}%</Text>
                  <View style={[styles.deltaBadge, { backgroundColor: comparisonData.isAccPositive ? 'rgba(188, 227, 170, 0.25)' : 'rgba(235, 87, 87, 0.12)' }]}>
                    <Text style={[styles.deltaText, { color: comparisonData.isAccPositive ? (isDark ? PALETTE.primary : '#2E7D32') : PALETTE.dangerText }]}>
                      {comparisonData.accuracyDelta}
                    </Text>
                  </View>
                </View>

                <View style={styles.tableRow}>
                  <Text style={[styles.tableLabel, { color: textColor }]}>Avg. pace</Text>
                  <Text style={[styles.tableValue, { color: textColor, textAlign: 'center' }]}>{avgPaceNum}s</Text>
                  <View style={[styles.deltaBadge, { backgroundColor: comparisonData.isTimePositive ? 'rgba(188, 227, 170, 0.25)' : 'rgba(235, 87, 87, 0.12)' }]}>
                    <Text style={[styles.deltaText, { color: comparisonData.isTimePositive ? (isDark ? PALETTE.primary : '#2E7D32') : PALETTE.dangerText }]}>
                      {comparisonData.timeDelta}
                    </Text>
                  </View>
                </View>

                <View style={styles.tableRow}>
                  <Text style={[styles.tableLabel, { color: textColor }]}>Correct</Text>
                  <Text style={[styles.tableValue, { color: textColor, textAlign: 'center' }]}>{correctCount}/{totalQuestions}</Text>
                  <View style={[styles.deltaBadge, { backgroundColor: comparisonData.isScorePositive ? 'rgba(188, 227, 170, 0.25)' : 'rgba(235, 87, 87, 0.12)' }]}>
                    <Text style={[styles.deltaText, { color: comparisonData.isScorePositive ? (isDark ? PALETTE.primary : '#2E7D32') : PALETTE.dangerText }]}>
                      {comparisonData.scoreDelta}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.baselineCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                <View style={[styles.baselineIconWrap, { backgroundColor: isDark ? 'rgba(188,227,170,0.15)' : PALETTE.primary }]}>
                  <Ionicons name="flag-outline" size={24} color="#0A0F0B" />
                </View>
                <Text style={[styles.baselineTitle, { color: textColor }]}>Your baseline is set</Text>
                <Text style={[styles.baselineDesc, { color: subtextColor }]}>
                  This workout is recorded as your benchmark. Progress deltas will calculate on your next session.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* BEAT 3: YOUR NEXT STEP */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            <IconStage
              icon="compass-outline"
              iconColor={PALETTE.dark}
              discColor={PALETTE.primary}
              haloColor={isDark ? 'rgba(188, 227, 170, 0.14)' : 'rgba(188, 227, 170, 0.4)'}
              size={56}
            />

            <Text style={[styles.stepHeadline, { color: textColor }]}>Next recommendation</Text>
            <Text style={[styles.stepSubtitle, { color: subtextColor }]}>
              Targeted focus based on today's performance
            </Text>

            <View style={[styles.recommendationCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={[styles.recBadge, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.16)' : PALETTE.primary }]}>
                <Text style={[styles.recBadgeText, { color: isDark ? PALETTE.primary : PALETTE.dark }]}>
                  {recommendation.badge}
                </Text>
              </View>

              <Text style={[styles.recTitle, { color: textColor }]}>{recommendation.title}</Text>
              <Text style={[styles.recDesc, { color: subtextColor }]}>{recommendation.desc}</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* BOTTOM ACTION DOCK */}
      <View style={[styles.dockContainer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        {currentStep === 3 ? (
          <View style={styles.doubleActionWrap}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: PALETTE.primary }]}
              activeOpacity={0.85}
              onPress={handleStartNextWorkout}
            >
              <Text style={styles.primaryActionBtnText}>Start Next Workout</Text>
              <Ionicons name="arrow-forward" size={18} color={PALETTE.dark} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostActionBtn}
              activeOpacity={0.7}
              onPress={handleGoHome}
            >
              <Text style={[styles.ghostActionBtnText, { color: subtextColor }]}>Done for today</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: PALETTE.primary }]}
            activeOpacity={0.85}
            onPress={advanceStep}
          >
            <Text style={styles.primaryActionBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={PALETTE.dark} />
          </TouchableOpacity>
        )}
      </View>

      {/* MISTAKE REVIEW MODAL SHEET */}
      <Modal
        visible={showMistakesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMistakesModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setShowMistakesModal(false)}
          />

          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#141C15' : PALETTE.white }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Review Missed Questions</Text>
              <TouchableOpacity onPress={() => setShowMistakesModal(false)} hitSlop={12}>
                <Ionicons name="close-circle" size={24} color={subtextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {missedAttempts.map((item, index) => (
                <View
                  key={item.question?.id || `missed-${index}`}
                  style={[styles.missedItemCard, { backgroundColor: isDark ? '#1B241C' : '#F8F6F4' }]}
                >
                  <Text style={[styles.missedEquationText, { color: textColor }]}>
                    {item.question?.equation || 'Problem'}
                  </Text>
                  <View style={styles.missedAnswerSplit}>
                    <Text style={styles.yourAnswerText}>
                      Your Answer: <Text style={{ textDecorationLine: 'line-through' }}>{item.userAnswer}</Text>
                    </Text>
                    <Text style={styles.correctAnswerText}>
                      Correct: <Text style={{ fontWeight: '800' }}>{item.question?.answer}</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topTimelineWrapper: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  timelineSegmentsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 4,
  },
  timelineSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  timelineActionWrap: {
    width: 32,
    alignItems: 'flex-end',
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  closeIconPlaceholder: {
    width: 32,
    height: 32,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageOuterWrap: {
    width: 180,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  haloGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  floatingBadge: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 2,
  },
  pedestalShadow: {
    position: 'absolute',
    bottom: 18,
    width: 80,
    height: 20,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    transform: [{ scaleY: 0.4 }],
  },
  stepHeadline: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 18,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  massiveScoreText: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1,
  },
  massiveScoreDivider: {
    fontSize: 32,
    fontWeight: '700',
    marginLeft: 2,
  },
  metricSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 16,
  },
  interpretationCard: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  interpretationTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  interpretationDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  mistakeReviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 14,
  },
  mistakeReviewPillText: {
    color: PALETTE.dangerText,
    fontSize: 13,
    fontWeight: '700',
  },
  flawlessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 14,
  },
  flawlessPillText: {
    color: PALETTE.dark,
    fontSize: 13,
    fontWeight: '700',
  },
  comparisonCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  tableRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  tableColHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableDivider: {
    height: 1,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  tableLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  tableValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  deltaBadge: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'flex-end',
    alignSelf: 'center',
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  baselineCard: {
    width: '100%',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  baselineIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  baselineTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  baselineDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  recommendationCard: {
    width: '100%',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  recBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 12,
  },
  recBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  recTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  recDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  dockContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  primaryActionBtn: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: PALETTE.dark,
    letterSpacing: 0.6,
  },
  doubleActionWrap: {
    width: '100%',
    gap: 8,
  },
  ghostActionBtn: {
    width: '100%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '65%',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalScrollContent: {
    gap: 10,
    paddingBottom: 20,
  },
  missedItemCard: {
    padding: 14,
    borderRadius: 16,
  },
  missedEquationText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  missedAnswerSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yourAnswerText: {
    fontSize: 13,
    color: PALETTE.dangerText,
    fontWeight: '600',
  },
  correctAnswerText: {
    fontSize: 13,
    color: '#27AE60',
    fontWeight: '600',
  },
});