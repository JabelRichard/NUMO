import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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

export default function ResultsScreen() {
  const router = useRouter();
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
        badgeBg: 'rgba(76, 175, 80, 0.12)',
      };
    }
    if (accuracyPct >= 75) {
      return {
        message: 'Great job! 💪',
        color: '#EC673C',
        badgeBg: 'rgba(236, 103, 60, 0.12)',
      };
    }
    if (accuracyPct >= 50) {
      return {
        message: 'Good start! 🚀',
        color: '#7C3AED',
        badgeBg: 'rgba(175, 162, 254, 0.18)',
      };
    }
    return {
      message: 'Keep going! 🧠',
      color: '#EE5839',
      badgeBg: 'rgba(238, 88, 57, 0.12)',
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[styles.container, animatedStyle]}>
        
        {/* Main Content Cluster */}
        <View style={styles.contentCluster}>
          {/* Header Block */}
          <View style={styles.headerBlock}>
            <Text style={styles.operationTag}>{getOperationDisplayTitle()}</Text>
            
            <View style={[styles.feedbackPill, { backgroundColor: feedback.badgeBg }]}>
              <Text style={[styles.feedbackText, { color: feedback.color }]}>
                {feedback.message}
              </Text>
            </View>

            {!isDemoWorkout && saving ? (
              <View style={styles.syncContainer}>
                <ActivityIndicator size="small" color="#EE5839" />
                <Text style={styles.syncText}>Saving workout...</Text>
              </View>
            ) : saveError ? (
              <Text style={styles.errorText}>{saveError}</Text>
            ) : null}
          </View>

          {/* Hero Accuracy Card */}
          <GlassCard style={styles.heroScoreCard} intensity={60}>
            <Text style={styles.scorePercentage}>{accuracy}%</Text>
            <Text style={styles.scoreLabel}>ACCURACY</Text>
            <Text style={styles.scoreSubtext}>
              {correctCount} of {totalQuestions} correct
            </Text>
          </GlassCard>

          {/* Two-Column Correct/Incorrect Row */}
          <View style={styles.metricsRow}>
            <View style={[styles.coloredMetricCard, { backgroundColor: '#AFA2FE' }]}>
              <Text style={styles.coloredMetricValue}>{correctCount}</Text>
              <Text style={styles.coloredMetricLabel}>CORRECT</Text>
            </View>

            <View style={[styles.coloredMetricCard, { backgroundColor: '#F6FE91' }]}>
              <Text style={styles.coloredMetricValue}>{incorrectCount}</Text>
              <Text style={styles.coloredMetricLabel}>INCORRECT</Text>
            </View>
          </View>

          {/* Performance Section */}
          <GlassCard style={styles.performanceCard} intensity={40}>
            <View style={styles.performanceItem}>
              <View style={styles.performanceIconCircle}>
                <Ionicons name="flash-outline" size={17} color="#EC673C" />
              </View>
              <View style={styles.performanceTextGroup}>
                <Text style={styles.performanceItemLabel}>Average Pace</Text>
                <Text style={styles.performanceItemValue}>
                  {formatAvgTime(averageTimePerQuestionMs)} / question
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.performanceItem}>
              <View style={styles.performanceIconCircle}>
                <Ionicons name="time-outline" size={17} color="#1C1C1E" />
              </View>
              <View style={styles.performanceTextGroup}>
                <Text style={styles.performanceItemLabel}>Total Duration</Text>
                <Text style={styles.performanceItemValue}>
                  {formatTotalTime(totalTimeSpentMs)}
                </Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Action Controls Section */}
        {isDemoWorkout ? (
          <View style={styles.demoActionBox}>
            <View style={styles.demoBannerCard}>
              <View style={styles.sparkleIconBox}>
                <Ionicons name="sparkles" size={18} color="#EC673C" />
              </View>
              <View style={styles.demoBannerTextGroup}>
                <Text style={styles.demoBannerTitle}>Save Your Progress</Text>
                <Text style={styles.demoBannerSubtitle}>
                  Save this workout and start tracking your progress.
                </Text>
              </View>
            </View>

            <PrimaryButton
              title="Create Free Account"
              onPress={() => router.push('/(auth)/signup')}
              icon={<Ionicons name="person-add" size={18} color="#1C1C1E" />}
              style={styles.signupButton}
              textStyle={styles.signupButtonText}
            />

            <TouchableOpacity
              style={styles.loginLinkButton}
              activeOpacity={0.7}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={styles.loginBoldText}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <PrimaryButton
              title="Try Again"
              onPress={() =>
                router.replace({
                  pathname: '/workout' as any,
                  params: { mode, difficulty },
                })
              }
              icon={<Ionicons name="refresh" size={18} color="#1C1C1E" />}
              style={styles.retryButton}
              textStyle={styles.retryButtonText}
            />

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.7}
              onPress={() => router.replace('/training' as any)}
            >
              <Text style={styles.secondaryButtonText}>Back to Training</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E6E6E6',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  contentCluster: {
    width: '100%',
    gap: 12,
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
    paddingVertical: 18,
    borderRadius: 22,
  },
  scorePercentage: {
    fontSize: 54,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: -1,
    lineHeight: 58,
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
    gap: 12,
  },
  coloredMetricCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coloredMetricValue: {
    fontSize: 24,
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
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  performanceIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  demoActionBox: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  demoBannerCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sparkleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(236, 103, 60, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBannerTextGroup: {
    flex: 1,
  },
  demoBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  demoBannerSubtitle: {
    fontSize: 11,
    color: '#636366',
    lineHeight: 15,
  },
  signupButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F6FE91',
    shadowColor: '#F6FE91',
  },
  signupButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '800',
  },
  loginLinkButton: {
    paddingVertical: 4,
  },
  loginLinkText: {
    fontSize: 13,
    color: '#4B5563',
  },
  loginBoldText: {
    color: '#EC673C',
    fontWeight: '800',
  },
  actionContainer: {
    width: '100%',
    gap: 10,
  },
  retryButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F6FE91',
    shadowColor: '#F6FE91',
  },
  retryButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
});