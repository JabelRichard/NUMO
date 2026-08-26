import React, { useState, useEffect, useRef } from 'react';
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
import { CustomNumericKeypad } from '../../src/components/CustomNumericKeypad';
import { QuestionGenerator } from '../../src/lib/math/questionGenerator';
import { recordAttempt } from '../../src/lib/math/questionValidator';
import {
  MathQuestion,
  QuestionAttemptResult,
  FeedbackState,
  OperationType,
} from '../../src/lib/math/types';
import { useTheme } from '@/src/context/ThemeContext';

export default function MathWorkoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { theme } = useTheme();
  const { session } = useAuth();
  const { mode, difficulty, isDemo } = useLocalSearchParams<{
    mode?: string;
    difficulty?: string;
    isDemo?: string;
  }>();

  const isCompact = height < 720;
  const isNarrow = width < 360;

  const isDemoMode = isDemo === 'true' || mode === 'demo';
  const generatorRef = useRef(new QuestionGenerator());

  const [questions, setQuestions] = useState<MathQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [attempts, setAttempts] = useState<QuestionAttemptResult[]>([]);

  const startTimeRef = useRef<number>(Date.now());

  // Reanimated shared values
  const shakeX = useSharedValue(0);
  const scale = useSharedValue(1);
  const cursorOpacity = useSharedValue(1);

  // Blinking cursor animation
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withTiming(0, { duration: 500 }),
      -1,
      true
    );
  }, []);

  // Initialize session questions
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      const activeMode: OperationType =
        mode && ['addition', 'subtraction', 'multiplication', 'division', 'mixed'].includes(mode)
          ? (mode as OperationType)
          : 'mixed';

      const activeDifficulty = difficulty === 'medium' || difficulty === 'hard' ? difficulty : 'easy';

      let sessionCount = 10;

      if (!isDemoMode) {
        if (session?.user?.id) {
          try {
            const userSettings = await getUserSettings(session.user.id);
            sessionCount = userSettings.daily_question_goal ?? 20;
          } catch {
            sessionCount = 20;
          }
        } else {
          sessionCount = 20;
        }
      }

      const generatedSession = generatorRef.current.generateSession({
        operation: activeMode,
        difficulty: activeDifficulty,
        questionCount: sessionCount,
      });

      if (isMounted) {
        setQuestions(generatedSession);
        setCurrentIndex(0);
        setAttempts([]);
        startTimeRef.current = Date.now();
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [mode, difficulty, isDemoMode, session?.user?.id]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions
    ? ((currentIndex + 1) / totalQuestions) * 100
    : 0;

  const handleQuitWorkout = () => {
    if (Platform.OS === 'web') {
      const confirmQuit = window.confirm(
        'Quit Workout?\nYour progress for this workout will not be saved.'
      );
      if (confirmQuit) {
        router.back();
      }
    } else {
      Alert.alert(
        'Quit Workout?',
        'Your progress for this workout will not be saved.',
        [
          {
            text: 'Keep Practicing',
            style: 'cancel',
          },
          {
            text: 'Quit',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const getOperationDisplayTitle = (): string => {
    if (isDemoMode) return 'DEMO WORKOUT';
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
    if (userAnswer.length >= 6 || feedback !== 'idle') return;
    setUserAnswer((prev) => prev + val);
  };

  const handleDelete = () => {
    if (feedback !== 'idle') return;
    setUserAnswer((prev) => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (!userAnswer || feedback !== 'idle' || !currentQuestion) return;

    const timeSpentMs = Date.now() - startTimeRef.current;
    const attemptResult = recordAttempt(currentQuestion, userAnswer, timeSpentMs);

    setFeedback(attemptResult.isCorrect ? 'correct' : 'incorrect');
    triggerFeedbackAnimation(attemptResult.isCorrect);

    const updatedAttempts = [...attempts, attemptResult];
    setAttempts(updatedAttempts);

    setTimeout(() => {
      setFeedback('idle');
      setUserAnswer('');

      if (currentIndex + 1 < totalQuestions) {
        setCurrentIndex((prev) => prev + 1);
        startTimeRef.current = Date.now();
      } else {
        router.replace({
          pathname: '/results' as any,
          params: {
            mode: mode || 'mixed',
            difficulty: difficulty || 'easy',
            isDemo: isDemoMode ? 'true' : 'false',
            results: JSON.stringify(updatedAttempts),
          },
        });
      }
    }, 550);
  };

  const animatedDisplayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value }],
  }));

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const getInputColor = () => {
    if (feedback === 'correct') return '#4CAF50';
    if (feedback === 'incorrect') return '#D93838';
    return theme.text;
  };

  // Dynamic Equation and Answer text sizing
  const equationFontSize = isNarrow ? 44 : isCompact ? 52 : 62;
  const answerFontSize = isNarrow ? 40 : isCompact ? 48 : 56;
  const cursorHeight = isNarrow ? 36 : isCompact ? 42 : 48;

  if (!currentQuestion) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Group */}
      <View style={styles.topSection}>
        {/* Header Bar with Close Button, NUMO Badge, Counter */}
        <View style={[styles.header, isNarrow && styles.headerNarrow]}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.card }]}
            onPress={handleQuitWorkout}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>

          {/* NUMO Branding Badge */}
          <View style={[styles.brandBadge, { backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : 'rgba(238, 88, 57, 0.12)' }]}>
            <Text style={[styles.brandBadgeText, { color: theme.primary }, isCompact && styles.brandBadgeTextCompact]}>
              NUMO
            </Text>
          </View>

          <Text style={[styles.counterText, { color: theme.muted }]}>
            {currentIndex + 1}/{totalQuestions}
          </Text>
        </View>

        {/* Progress Track */}
        <View style={styles.progressTrackContainer}>
          <View style={[styles.progressTrack, { backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: theme.primary }]} />
          </View>
        </View>

        {/* Operation Title */}
        <Text style={[styles.operationTitle, { color: theme.muted }, isCompact && styles.operationTitleCompact]}>
          {getOperationDisplayTitle()}
        </Text>
      </View>

      {/* Equation and Input Display Area */}
      <View style={styles.displayArea}>
        <Animated.View style={[animatedDisplayStyle, styles.equationContainer]}>
          <Text
            style={[
              styles.equationText,
              { fontSize: equationFontSize, color: theme.text },
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
                { height: cursorHeight, backgroundColor: theme.text },
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
          disabled={feedback !== 'idle'}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E6E6E6',
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  brandBadge: {
    backgroundColor: 'rgba(238, 88, 57, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
  },
  brandBadgeText: {
    color: '#EE5839',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandBadgeTextCompact: {
    fontSize: 14,
    letterSpacing: 1.5,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#636366',
    minWidth: 34,
    textAlign: 'right',
  },
  progressTrackContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EE5839',
    borderRadius: 3,
  },
  operationTitle: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#8E8E93',
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
    color: '#1C1C1E',
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
    backgroundColor: '#1C1C1E',
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