import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getUserSettings } from '../../src/services/settingsService';
import {
  saveWorkoutSession,
  queueWorkoutForSync,
  getLastWorkoutSummary,
  setLastWorkoutSummary,
  summarizeAttempts,
  WorkoutSummarySnapshot,
} from '../../src/services/workoutService';
import { CustomNumericKeypad } from '../../src/components/CustomNumericKeypad';
import { OfflineNotice } from '../../src/components/OfflineNotice';
import { QuestionGenerator } from '../../src/lib/math/questionGenerator';
import { recordAttempt } from '../../src/lib/math/questionValidator';
import {
  MathQuestion,
  QuestionAttemptResult,
  FeedbackState,
  OperationType,
} from '../../src/lib/math/types';
import { useTheme } from '@/src/context/ThemeContext';
import { useOnlineStatus } from '../../src/hooks/useOnlineStatus';
import { PALETTE } from '../../src/constants/palette';

export default function MathWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { theme } = useTheme();
  const { session } = useAuth();

  const { mode, difficulty, count, sessionKey, reset } = useLocalSearchParams<{
    mode?: string;
    difficulty?: string;
    count?: string;
    sessionKey?: string;
    reset?: string;
  }>();

  const isCompact = height < 720;
  const isNarrow = width < 360;
  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');

  const generatorRef = useRef(new QuestionGenerator());
  const isNavigatingRef = useRef(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  // Mirrors attempts.length so async callbacks can tell whether the user has started answering.
  const answeredCountRef = useRef(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearFeedbackTimeout();
    };
  }, [clearFeedbackTimeout]);

  // Offline connection handling
  const { isOffline, recheck: handleRetryConnection } = useOnlineStatus();

  const getNormalizedOperation = (rawMode?: string): OperationType => {
    if (!rawMode) return 'mixed';
    const lower = rawMode.toLowerCase().trim();
    if (lower === 'adaptive_mix' || lower === 'mixed') return 'mixed';
    if (['addition', 'subtraction', 'multiplication', 'division'].includes(lower)) {
      return lower as OperationType;
    }
    return 'mixed';
  };

  const createWorkoutSession = useCallback((
    targetMode?: string,
    targetDiff?: string,
    targetCount?: number
  ): MathQuestion[] => {
    const activeMode = getNormalizedOperation(targetMode);
    const activeDifficulty =
      targetDiff === 'medium' || targetDiff === 'hard' ? targetDiff : 'easy';
    const sessionCount = targetCount || 10;

    return generatorRef.current.generateSession({
      operation: activeMode,
      difficulty: activeDifficulty,
      questionCount: sessionCount,
    });
  }, []);

  // Workout state
  const [questions, setQuestions] = useState<MathQuestion[]>(() =>
    createWorkoutSession(mode, difficulty, count ? parseInt(count, 10) : undefined)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [attempts, setAttempts] = useState<QuestionAttemptResult[]>([]);

  const questionStartTimeRef = useRef<number>(Date.now());

  // Session Reset Routine
  const resetWorkoutSession = useCallback(() => {
    clearFeedbackTimeout();
    isNavigatingRef.current = false;
    answeredCountRef.current = 0;
    const parsedCount = count ? parseInt(count, 10) : 10;
    const freshSession = createWorkoutSession(mode, difficulty, parsedCount);

    setQuestions(freshSession);
    setCurrentIndex(0);
    setUserAnswer('');
    setFeedback('idle');
    setAttempts([]);
    setIsFinishing(false);
    questionStartTimeRef.current = Date.now();
  }, [mode, difficulty, count, createWorkoutSession, clearFeedbackTimeout]);

  useEffect(() => {
    resetWorkoutSession();
  }, [sessionKey, reset, resetWorkoutSession]);

  // Sync daily goal if authenticated. Only applied before the first answer so the
  // question array never changes underneath currentIndex/attempts.
  useEffect(() => {
    let isMounted = true;

    async function syncGoal() {
      if (count || !session?.user?.id) return;
      try {
        const userSettings = await getUserSettings(session.user.id);
        const goal = userSettings?.daily_question_goal;
        if (!goal || !isMounted || answeredCountRef.current > 0) return;

        setQuestions((prev) => {
          if (prev.length === goal) return prev;
          return createWorkoutSession(mode, difficulty, goal);
        });
        questionStartTimeRef.current = Date.now();
      } catch {}
    }

    syncGoal();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, count, mode, difficulty, createWorkoutSession]);

  // Animations
  const shakeX = useSharedValue(0);
  const scale = useSharedValue(1);
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withTiming(0, { duration: 500 }),
      -1,
      true
    );
  }, [cursorOpacity]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions
    ? ((currentIndex + 1) / totalQuestions) * 100
    : 0;

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const primaryText = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const secondaryText = isDark ? 'rgba(241, 236, 233, 0.65)' : 'rgba(10, 15, 11, 0.55)';
  const cardBg = isDark ? '#141C15' : PALETTE.white;
  const accentGreen = PALETTE.primary;
  const trackBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 15, 11, 0.08)';

  const quitWorkout = () => {
    clearFeedbackTimeout();
    isNavigatingRef.current = true;
    router.back();
  };

  const handleQuitWorkout = () => {
    if (isFinishing) return;
    if (Platform.OS === 'web') {
      const confirmQuit = window.confirm(
        'Quit Workout?\nYour progress for this workout will not be saved.'
      );
      if (confirmQuit) quitWorkout();
    } else {
      Alert.alert(
        'Quit Workout?',
        'Your progress for this workout will not be saved.',
        [
          { text: 'Keep Practicing', style: 'cancel' },
          { text: 'Quit', style: 'destructive', onPress: quitWorkout },
        ],
        { cancelable: true }
      );
    }
  };

  // Single place a workout is persisted. If the save fails it is queued in the
  // offline outbox and results.tsx tells the user it will sync later.
  const finishWorkout = async (finalAttempts: QuestionAttemptResult[]) => {
    setIsFinishing(true);

    const canonicalMode = getNormalizedOperation(mode);
    const activeDifficulty = difficulty || 'easy';
    const completedAt = new Date().toISOString();
    const userId = session?.user?.id;

    let savedSessionId = '';
    let saveStatus: 'saved' | 'queued' = 'queued';
    let priorSummary: WorkoutSummarySnapshot | null = null;

    if (userId) {
      priorSummary = await getLastWorkoutSummary(userId);

      const { data, error } = await saveWorkoutSession(
        finalAttempts,
        canonicalMode,
        activeDifficulty,
        userId,
        completedAt
      );

      if (data && !error) {
        savedSessionId = data.id;
        saveStatus = 'saved';
      } else {
        try {
          await queueWorkoutForSync(userId, finalAttempts, canonicalMode, activeDifficulty, completedAt);
        } catch (e) {
          console.warn('Failed to queue workout for later sync:', e);
        }
      }

      await setLastWorkoutSummary(userId, summarizeAttempts(finalAttempts, completedAt));
    }

    if (!isMountedRef.current) return;

    const navigationParams = {
      mode: canonicalMode,
      difficulty: activeDifficulty,
      results: JSON.stringify(finalAttempts),
      savedSessionId,
      saveStatus,
      prior: priorSummary ? JSON.stringify(priorSummary) : '',
      sessionKey: Date.now().toString(),
    };

    try {
      router.replace({
        pathname: '/(app)/results' as any,
        params: navigationParams,
      });
    } catch {
      router.replace({
        pathname: '/results' as any,
        params: navigationParams,
      });
    }
  };

  const getOperationDisplayTitle = (): string => {
    if (isFinishing) return 'SAVING WORKOUT…';
    const canonical = getNormalizedOperation(mode);
    switch (canonical) {
      case 'addition':
        return 'ADDITION';
      case 'subtraction':
        return 'SUBTRACTION';
      case 'multiplication':
        return 'MULTIPLICATION';
      case 'division':
        return 'DIVISION';
      case 'mixed':
      default:
        return 'MIXED CHALLENGE';
    }
  };

  const triggerFeedbackAnimation = (isCorrect: boolean) => {
    if (isCorrect) {
      scale.value = withSequence(
        withTiming(1.05, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    } else {
      shakeX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  };

  const handleKeyPress = (val: string) => {
    if (userAnswer.length >= 6 || feedback !== 'idle' || isNavigatingRef.current) return;
    setUserAnswer((prev) => prev + val);
  };

  const handleDelete = () => {
    if (feedback !== 'idle' || isNavigatingRef.current) return;
    setUserAnswer((prev) => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (!userAnswer || feedback !== 'idle' || !currentQuestion || isNavigatingRef.current) return;

    const elapsed = Date.now() - questionStartTimeRef.current;
    const baseAttempt = recordAttempt(currentQuestion, userAnswer, elapsed);

    // Guarantee timeTakenMs is populated so workoutService doesn't produce NaN
    const attemptResult: QuestionAttemptResult = {
      ...baseAttempt,
      timeTakenMs: baseAttempt.timeTakenMs ?? (baseAttempt as any).timeSpentMs ?? elapsed,
    };

    setFeedback(attemptResult.isCorrect ? 'correct' : 'incorrect');
    triggerFeedbackAnimation(attemptResult.isCorrect);

    const updatedAttempts = [...attempts, attemptResult];
    answeredCountRef.current = updatedAttempts.length;
    setAttempts(updatedAttempts);

    const isLastQuestion = currentIndex + 1 >= totalQuestions;

    if (isLastQuestion) {
      isNavigatingRef.current = true;
    }

    clearFeedbackTimeout();
    feedbackTimeoutRef.current = setTimeout(() => {
      feedbackTimeoutRef.current = null;
      if (!isMountedRef.current) return;

      setFeedback('idle');
      setUserAnswer('');

      if (!isLastQuestion) {
        setCurrentIndex((prev) => prev + 1);
        questionStartTimeRef.current = Date.now();
      } else {
        finishWorkout(updatedAttempts);
      }
    }, 450);
  };

  const animatedDisplayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value }],
  }));

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const getInputColor = () => {
    if (feedback === 'correct') return PALETTE.successText;
    if (feedback === 'incorrect') return PALETTE.dangerText;
    return primaryText;
  };

  const equationFontSize = isNarrow ? 44 : isCompact ? 52 : 62;
  const answerFontSize = isNarrow ? 40 : isCompact ? 48 : 56;
  const cursorHeight = isNarrow ? 36 : isCompact ? 42 : 48;

  if (isOffline) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <OfflineNotice onRetry={handleRetryConnection} />
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Group */}
      <View style={styles.topSection}>
        <View style={[styles.header, isNarrow && styles.headerNarrow]}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: cardBg }, isFinishing && { opacity: 0.4 }]}
            onPress={handleQuitWorkout}
            disabled={isFinishing}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={primaryText} />
          </TouchableOpacity>

          <View style={[styles.brandBadge, { backgroundColor: accentGreen }]}>
            <Text style={[styles.brandBadgeText, isCompact && styles.brandBadgeTextCompact]}>
              NUMO
            </Text>
          </View>

          <Text style={[styles.counterText, { color: secondaryText }]}>
            {currentIndex + 1}/{totalQuestions}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressTrackContainer}>
          <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: accentGreen }]} />
          </View>
        </View>

        {/* Operation Title */}
        <Text style={[styles.operationTitle, { color: secondaryText }, isCompact && styles.operationTitleCompact]}>
          {getOperationDisplayTitle()}
        </Text>
      </View>

      {/* Equation and Input Display Area */}
      <View style={styles.displayArea}>
        <Animated.View style={[animatedDisplayStyle, styles.equationContainer]}>
          <Text
            style={[
              styles.equationText,
              { fontSize: equationFontSize, color: primaryText },
              isCompact && styles.equationTextCompact,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {currentQuestion.equation}
          </Text>

          <View style={[styles.answerRow, isCompact && styles.answerRowCompact]}>
            <Text
              style={[
                styles.answerText,
                { fontSize: answerFontSize, color: getInputColor() },
              ]}
              numberOfLines={1}
            >
              {userAnswer}
            </Text>
            <Animated.View
              style={[
                styles.cursor,
                { height: cursorHeight, backgroundColor: primaryText },
                animatedCursorStyle,
              ]}
            />
          </View>
        </Animated.View>
      </View>

      {/* Custom Keypad */}
      <View
        style={[
          styles.keypadContainer,
          { paddingBottom: Math.max(insets.bottom, isCompact ? 10 : 20) },
        ]}
      >
        <CustomNumericKeypad
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
          disabled={feedback !== 'idle' || isFinishing}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerNarrow: {
    paddingHorizontal: 14,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  brandBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
  },
  brandBadgeText: {
    color: '#0A0F0B',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  brandBadgeTextCompact: {
    fontSize: 13,
    letterSpacing: 1.2,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  progressTrackContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  operationTitle: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 10,
  },
  operationTitleCompact: {
    marginTop: 6,
    fontSize: 11,
  },
  displayArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  equationContainer: {
    alignItems: 'center',
    width: '100%',
  },
  equationText: {
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  equationTextCompact: {
    marginBottom: 6,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  answerRowCompact: {
    minHeight: 46,
  },
  answerText: {
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  cursor: {
    width: 3.5,
    marginLeft: 4,
    borderRadius: 2,
  },
  keypadContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 12,
  },
});