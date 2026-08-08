import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CustomNumericKeypad } from '../../src/components/CustomNumericKeypad';
import { QuestionGenerator } from '../../src/lib/math/questionGenerator';
import { recordAttempt } from '../../src/lib/math/questionValidator';
import {
  MathQuestion,
  QuestionAttemptResult,
  FeedbackState,
  OperationType,
} from '../../src/lib/math/types';

export default function MathWorkoutScreen() {
  const router = useRouter();
  const { mode, difficulty } = useLocalSearchParams<{
    mode?: string;
    difficulty?: string;
  }>();

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
    const activeMode: OperationType =
      mode && ['addition', 'subtraction', 'multiplication', 'division', 'mixed'].includes(mode)
        ? (mode as OperationType)
        : 'mixed';

    const activeDifficulty = difficulty === 'medium' || difficulty === 'hard' ? difficulty : 'easy';

    const generatedSession = generatorRef.current.generateSession({
      operation: activeMode,
      difficulty: activeDifficulty,
      questionCount: 20,
    });

    setQuestions(generatedSession);
    setCurrentIndex(0);
    setAttempts([]);
    startTimeRef.current = Date.now();
  }, [mode, difficulty]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length || 20;
  const progressPercent = questions.length
    ? ((currentIndex + 1) / totalQuestions) * 100
    : 0;

  // Handles confirmation prompt before abandoning workout session
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
    return '#000000';
  };

  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleQuitWorkout}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color="#1C1C1E" />
        </TouchableOpacity>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <Text style={styles.counterText}>
          {currentIndex + 1}/{totalQuestions}
        </Text>
      </View>

      {/* Operation Title */}
      <Text style={styles.operationTitle}>{getOperationDisplayTitle()}</Text>

      {/* Equation and Input Display Area */}
      <View style={styles.displayArea}>
        <Animated.View style={[animatedDisplayStyle, styles.equationContainer]}>
          <Text style={styles.equationText}>{currentQuestion.equation}</Text>

          <View style={styles.answerRow}>
            <Text style={[styles.answerText, { color: getInputColor() }]}>
              {userAnswer}
            </Text>
            <Animated.View style={[styles.cursor, animatedCursorStyle]} />
          </View>
        </Animated.View>
      </View>

      {/* Custom Keypad */}
      <View style={styles.keypadContainer}>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  operationTitle: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1.5,
    marginTop: 12,
  },
  displayArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equationContainer: {
    alignItems: 'center',
  },
  equationText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 4,
    marginBottom: 20,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 68,
  },
  answerText: {
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: 2,
  },
  cursor: {
    width: 4,
    height: 52,
    backgroundColor: '#000000',
    marginLeft: 4,
    borderRadius: 2,
  },
  keypadContainer: {
    paddingBottom: 36,
  },
});