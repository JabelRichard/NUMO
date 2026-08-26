import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
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
  const { height, width } = useWindowDimensions();
  const { theme } = useTheme();
  const { mode, difficulty, results, isDemo } = useLocalSearchParams<{
    mode?: string;
    difficulty?: string;
    results?: string;
    isDemo?: string;
  }>();

  const isCompact = height < 720;
  const isNarrow = width < 360;

  const { session } = useAuth();
  const isDemoWorkout = isDemo === 'true' || (!session && isDemo !== 'false');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasSavedRef = useRef(false);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

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

  const attempts: QuestionAttemptResult[] = React.useMemo(() => {
    if (!results) return [];
    try {
      return JSON.parse(results);
    } catch (err) {
      console.error('Failed to parse workout results payload', err);
      return [];
    }
  }, [results]);

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

  const totalQuestions = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const incorrectCount = totalQuestions - correctCount;
  const accuracy =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const totalTimeSpentMs = attempts.reduce(
    (acc, item) => acc + item.timeTakenMs,
    0
  );
  const averageTimePerQuestionMs =
    totalQuestions > 0 ? totalTimeSpentMs / totalQuestions : 0;

  const formatTotalTime = (ms: number): string => {
    const totalSeconds = Math.round(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatAvgTime = (ms: number): string => {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  const getAccuracyFeedback = (accuracyPct: number) => {
    if (accuracyPct >= 90) {
      return {
        message: 'Excellent work! 🔥',
        color: '#4CAF50',
        badgeBg: theme.isDark ? 'rgba(76, 175, 80, 0.22)' : 'rgba(76, 175, 80, 0.12)',
      };
    }
    if (accuracyPct >= 75) {
      return {
        message: 'Great job! 💪',
        color: '#EC673C',
        badgeBg: theme.isDark ? 'rgba(236, 103, 60, 0.22)' : 'rgba(236, 103, 60, 0.12)',
      };
    }
    if (accuracyPct >= 50) {
      return {
        message: 'Good start! 🚀',
        color: '#7C3AED',
        badgeBg: theme.isDark ? 'rgba(175, 162, 254, 0.25)' : 'rgba(175, 162, 254, 0.18)',
      };
    }
    return {
      message: 'Keep going! 🧠',
      color: '#EE5839',
      badgeBg: theme.isDark ? 'rgba(238, 88, 57, 0.22)' : 'rgba(238, 88, 57, 0.12)',
    };
  };

  const feedback = getAccuracyFeedback(accuracy);

  const getOperationDisplayTitle = (): string => {
    if (isDemoWorkout) return 'DEMO WORKOUT';
    if (!mode) return 'PRACTICE';
    switch (mode.toLowerCase()) {
      case 'addition':
        return 'ADDITION';
      case 'subtraction':
        return 'SUBTRACTION';
      case 'multiplication':
        return 'MULTIPLICATION';
      case 'division':
        return 'DIVISION';
      case 'adaptive_mix':
      case 'mixed':
        return 'MIXED CHALLENGE';
      default:
        return mode.toUpperCase();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top > 0 ? 8 : 16, 12),
            paddingBottom: Math.max(insets.bottom + 12, 20),
            paddingHorizontal: isNarrow ? 16 : 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.container, animatedStyle]}>
          {/* Main Content Cluster */}
          <View style={[styles.contentCluster, isCompact && styles.contentClusterCompact]}>
            {/* Header Block */}
            <View style={styles.headerBlock}>
              <Text style={[styles.operationTag, { color: theme.muted }]}>{getOperationDisplayTitle()}</Text>

              <View style={[styles.feedbackPill, { backgroundColor: feedback.badgeBg }]}>
                <Text style={[styles.feedbackText, { color: feedback.color }]}>
                  {feedback.message}
                </Text>
              </View>

              {!isDemoWorkout && saving ? (
                <View style={styles.syncContainer}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.syncText, { color: theme.muted }]}>Saving workout...</Text>
                </View>
              ) : saveError ? (
                <Text style={styles.errorText}>{saveError}</Text>
              ) : null}
            </View>

            {/* Hero Accuracy Card */}
           {/* Hero Accuracy Card */}
            <GlassCard
              style={[
                styles.heroScoreCard,
                isCompact ? styles.heroScoreCardCompact : undefined,
              ]}
              intensity={60}
            >
              <Text
                style={[
                  styles.scorePercentage,
                  { color: theme.text },
                  isCompact ? styles.scorePercentageCompact : undefined,
                ]}
              >
                {accuracy}%
              </Text>
              <Text style={[styles.scoreLabel, { color: theme.muted }]}>ACCURACY</Text>
              <Text style={[styles.scoreSubtext, { color: theme.subtext }]}>
                {correctCount} of {totalQuestions} correct
              </Text>
            </GlassCard>

            {/* Two-Column Correct/Incorrect Row */}
            <View style={styles.metricsRow}>
              <View style={[styles.coloredMetricCard, { backgroundColor: theme.accentPurple }]}>
                <Text style={styles.coloredMetricValue}>{correctCount}</Text>
                <Text style={styles.coloredMetricLabel}>CORRECT</Text>
              </View>

              <View style={[styles.coloredMetricCard, { backgroundColor: theme.accentYellow }]}>
                <Text style={styles.coloredMetricValue}>{incorrectCount}</Text>
                <Text style={styles.coloredMetricLabel}>INCORRECT</Text>
              </View>
            </View>

            {/* Performance Section */}
            <GlassCard
              style={[
                styles.performanceCard,
                isCompact ? styles.performanceCardCompact : undefined,
              ]}
              intensity={40}
            >
              <View style={styles.performanceItem}>
                <View style={[styles.performanceIconCircle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0, 0, 0, 0.04)' }]}>
                  <Ionicons name="flash-outline" size={16} color={theme.primary} />
                </View>
                <View style={styles.performanceTextGroup}>
                  <Text style={[styles.performanceItemLabel, { color: theme.muted }]}>Average Pace</Text>
                  <Text style={[styles.performanceItemValue, { color: theme.text }]}>
                    {formatAvgTime(averageTimePerQuestionMs)} / question
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.divider }]} />

              <View style={styles.performanceItem}>
                <View style={[styles.performanceIconCircle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0, 0, 0, 0.04)' }]}>
                  <Ionicons name="time-outline" size={16} color={theme.text} />
                </View>
                <View style={styles.performanceTextGroup}>
                  <Text style={[styles.performanceItemLabel, { color: theme.muted }]}>Total Duration</Text>
                  <Text style={[styles.performanceItemValue, { color: theme.text }]}>
                    {formatTotalTime(totalTimeSpentMs)}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Action Controls Section */}
          <View style={[styles.actionWrapper, isCompact && styles.actionWrapperCompact]}>
            {isDemoWorkout ? (
              <View style={styles.demoActionBox}>
                <View style={[styles.demoBannerCard, { backgroundColor: theme.card }, isCompact && styles.demoBannerCardCompact]}>
                  <View style={[styles.sparkleIconBox, { backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : 'rgba(236, 103, 60, 0.12)' }]}>
                    <Ionicons name="sparkles" size={18} color={theme.primary} />
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
                  style={[styles.actionButton, isCompact && styles.actionButtonCompact]}
                  textStyle={styles.actionButtonText}
                />

                <TouchableOpacity
                  style={styles.loginLinkButton}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(auth)/login')}
                >
                  <Text style={[styles.loginLinkText, { color: theme.subtext }]}>
                    Already have an account? <Text style={[styles.loginBoldText, { color: theme.primary }]}>Log In</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.actionContainer}>
                <PrimaryButton
                  title="Try Again"
                  onPress={() =>
                    router.replace({
                      pathname: '/(app)/training' as any,
                      params: { mode, difficulty },
                    })
                  }
                  icon={<Ionicons name="refresh" size={18} color="#1C1C1E" />}
                  style={[styles.actionButton, isCompact && styles.actionButtonCompact]}
                  textStyle={styles.actionButtonText}
                />

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: theme.card },
                    isCompact && styles.secondaryButtonCompact,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => router.replace('/(app)')}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Back to Training</Text>
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
    backgroundColor: '#E6E6E6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'space-between',
  },
  contentCluster: {
    width: '100%',
    gap: 12,
  },
  contentClusterCompact: {
    gap: 8,
  },
  headerBlock: {
    alignItems: 'center',
    width: '100%',
  },
  operationTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  feedbackPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  syncText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11,
    color: '#D93838',
    marginTop: 4,
  },
  heroScoreCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 22,
  },
  heroScoreCardCompact: {
    paddingVertical: 12,
    borderRadius: 18,
  },
  scorePercentage: {
    fontSize: 50,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: -1,
    lineHeight: 54,
  },
  scorePercentageCompact: {
    fontSize: 40,
    lineHeight: 44,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  scoreSubtext: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  coloredMetricCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coloredMetricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  coloredMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.55)',
    letterSpacing: 0.8,
  },
  performanceCard: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  performanceCardCompact: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  performanceIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceTextGroup: {
    flex: 1,
  },
  performanceItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  performanceItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  actionWrapper: {
    marginTop: 16,
  },
  actionWrapperCompact: {
    marginTop: 10,
  },
  demoActionBox: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  demoBannerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 4,
  },
  demoBannerCardCompact: {
    paddingVertical: 8,
  },
  sparkleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(236, 103, 60, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBannerTextGroup: {
    flex: 1,
  },
  demoBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 1,
  },
  demoBannerSubtitle: {
    fontSize: 11,
    color: '#636366',
    lineHeight: 15,
  },
  actionButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#F6FE91',
    shadowColor: '#F6FE91',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  actionButtonCompact: {
    minHeight: 46,
  },
  actionButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '800',
  },
  loginLinkButton: {
    paddingVertical: 6,
  },
  loginLinkText: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '500',
  },
  loginBoldText: {
    color: '#EC673C',
    fontWeight: '800',
  },
  actionContainer: {
    width: '100%',
    gap: 8,
  },
  secondaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryButtonCompact: {
    minHeight: 44,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
});