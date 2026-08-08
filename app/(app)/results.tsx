import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity, 
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
import { QuestionAttemptResult } from '../../src/lib/math/types';

export default function ResultsScreen() {
  const router = useRouter();
  const { mode, difficulty, results } = useLocalSearchParams<{
    mode?: string;
    difficulty?: string;
    results?: string;
  }>();

  // Reanimated entrance animation values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(0, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Parse actual attempt logs from params
  const attempts: QuestionAttemptResult[] = React.useMemo(() => {
    if (!results) return [];
    try {
      return JSON.parse(results);
    } catch (err) {
      console.error('Failed to parse workout results payload', err);
      return [];
    }
  }, [results]);

  // Derived Performance Metrics
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

  // Format Milliseconds to Readable Time String
  const formatTotalTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatAvgTime = (ms: number): string => {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  // Dynamic Feedback Message & Icon
  const getFeedbackDetails = (accuracyPct: number) => {
    if (accuracyPct >= 90) {
      return {
        message: 'Excellent work!',
        color: '#4CAF50',
        badgeBg: 'rgba(76, 175, 80, 0.12)',
        icon: 'ribbon-outline' as const,
      };
    }
    if (accuracyPct >= 75) {
      return {
        message: 'Great job! Keep going!',
        color: '#EC673C',
        badgeBg: 'rgba(236, 103, 60, 0.12)',
        icon: 'trophy-outline' as const,
      };
    }
    if (accuracyPct >= 50) {
      return {
        message: 'Good start! You can improve this.',
        color: '#AFA2FE',
        badgeBg: 'rgba(175, 162, 254, 0.15)',
        icon: 'sparkles-outline' as const,
      };
    }
    return {
      message: "Keep practicing. You'll get better.",
      color: '#EE5839',
      badgeBg: 'rgba(238, 88, 57, 0.12)',
      icon: 'fitness-outline' as const,
    };
  };

  const feedback = getFeedbackDetails(accuracy);

  const getOperationDisplayTitle = (): string => {
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
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Title */}
          <Text style={styles.operationTag}>{getOperationDisplayTitle()}</Text>

          {/* Feedback Pill */}
          <View style={[styles.feedbackPill, { backgroundColor: feedback.badgeBg }]}>
            <Ionicons name={feedback.icon} size={18} color={feedback.color} />
            <Text style={[styles.feedbackText, { color: feedback.color }]}>
              {feedback.message}
            </Text>
          </View>

          {/* Main Focus: Hero Glass Score Card */}
          <GlassCard style={styles.heroScoreCard} intensity={60}>
            <Text style={styles.scoreLabel}>ACCURACY</Text>
            <Text style={styles.scorePercentage}>{accuracy}%</Text>
            <Text style={styles.scoreSubtext}>
              {correctCount} of {totalQuestions} answered correctly
            </Text>
          </GlassCard>

          {/* Answer Breakdown Row */}
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

          {/* Timing Performance Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance</Text>
          </View>

          <GlassCard style={styles.performanceCard} intensity={40}>
            <View style={styles.performanceItem}>
              <View style={styles.performanceIconCircle}>
                <Ionicons name="speedometer-outline" size={20} color="#1C1C1E" />
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
                <Ionicons name="time-outline" size={20} color="#1C1C1E" />
              </View>
              <View style={styles.performanceTextGroup}>
                <Text style={styles.performanceItemLabel}>Total Duration</Text>
                <Text style={styles.performanceItemValue}>
                  {formatTotalTime(totalTimeSpentMs)}
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <PrimaryButton
              title="Try Again"
              onPress={() =>
                router.replace({
                  pathname: '/workout' as any,
                  params: { mode, difficulty },
                })
              }
              icon={<Ionicons name="refresh" size={20} color="#FFF" />}
              style={styles.retryButton}
            />

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.7}
              onPress={() => router.replace('/training' as any)} // <--- Added type assertion 'as any'
            >
              <Text style={styles.secondaryButtonText}>Back to Training</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E6E6E6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  operationTag: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroScoreCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 28,
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 4,
  },
  scorePercentage: {
    fontSize: 64,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: -1,
  },
  scoreSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636366',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  coloredMetricCard: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coloredMetricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  coloredMetricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.55)',
    letterSpacing: 0.8,
  },
  sectionHeader: {
    width: '100%',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginLeft: 4,
  },
  performanceCard: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  performanceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  actionContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
});