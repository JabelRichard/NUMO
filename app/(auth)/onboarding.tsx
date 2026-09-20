import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';

import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/src/config/supabase';
import { saveUserSettings } from '@/src/services/settingsService';
import { CustomNumericKeypad } from '@/src/components/CustomNumericKeypad';
import { QuestionGenerator } from '@/src/lib/math/questionGenerator';
import { recordAttempt } from '@/src/lib/math/questionValidator';
import { MathQuestion, QuestionAttemptResult, FeedbackState } from '@/src/lib/math/types';

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = Boolean(theme.isDark ?? true);

  const isNarrow = width < 360;
  const isTall = height > 780;

  const [currentStep, setCurrentStep] = useState(1);

  // User State
  const [confidenceLevel, setConfidenceLevel] = useState('sometimes');
  const [trainingDays, setTrainingDays] = useState('5 days per week');
  const [sessionMinutes, setSessionMinutes] = useState('5 minutes');
  const [questionGoal, setQuestionGoal] = useState(10); // 5, 10, 30, 50

  const [baselineResults, setBaselineResults] = useState<{
    totalQuestions: number;
    correctAnswers: number;
    totalTimeMs: number;
  }>({
    totalQuestions: 3,
    correctAnswers: 3,
    totalTimeMs: 4200,
  });

  // Diagnostic Quiz State (Step 4)
  const generatorRef = useRef(new QuestionGenerator());
  const [quizQuestions, setQuizQuestions] = useState<MathQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [attempts, setAttempts] = useState<QuestionAttemptResult[]>([]);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const questionStartTimeRef = useRef<number>(Date.now());

  // Step Progress Bar Animation
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  const updateProgress = (stepNumber: number) => {
    Animated.timing(progressAnim, {
      toValue: stepNumber / TOTAL_STEPS,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  // Diagnostic Keypad Animations
  const shakeX = useSharedValue(0);
  const scale = useSharedValue(1);
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
  }, [cursorOpacity]);

  // Generate questions for step 4
  useEffect(() => {
    if (currentStep === 4) {
      const generated = generatorRef.current.generateSession({
        operation: 'mixed',
        difficulty: 'easy',
        questionCount: 3,
      });
      setQuizQuestions(generated);
      setQuizIndex(0);
      setUserAnswer('');
      setFeedback('idle');
      setAttempts([]);
      sessionStartTimeRef.current = Date.now();
      questionStartTimeRef.current = Date.now();
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      const next = currentStep + 1;
      setCurrentStep(next);
      updateProgress(next);
    } else {
      handleCompleteAndGoSignup();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      updateProgress(prev);
    } else {
      router.replace('/(auth)/welcome');
    }
  };

  const handleSkip = () => {
    if (currentStep < TOTAL_STEPS) {
      const next = currentStep + 1;
      setCurrentStep(next);
      updateProgress(next);
    } else {
      handleCompleteAndGoSignup();
    }
  };

  // Saves onboarding completion locally and to database
  const handleCompleteAndGoSignup = async () => {
    try {
      const accuracy = Math.round(
        (baselineResults.correctAnswers / baselineResults.totalQuestions) * 100
      );
      const avgTimePerQ = parseFloat(
        (baselineResults.totalTimeMs / baselineResults.totalQuestions / 1000).toFixed(1)
      );

      // 1. Settings payload matching your UserSettings & profiles schema
      const settingsPayload = {
        daily_question_goal: questionGoal,
        goals: ['speed' as const],
        has_completed_onboarding: true,
      };

      // 2. Baseline workout session matching workout_sessions table
      const baselineSession = {
        operations: 'mixed',
        difficuty: 'easy',
        total_questions: baselineResults.totalQuestions,
        correct_answers: baselineResults.correctAnswers,
        incorrect_answers: baselineResults.totalQuestions - baselineResults.correctAnswers,
        accuracy: accuracy,
        avarage_time_per_question: avgTimePerQ,
      };

      // 3. Mark completed in AsyncStorage immediately to prevent offline bounce-backs
      await AsyncStorage.setItem('@numo_onboarding_completed', 'true');
      await AsyncStorage.setItem(
        '@numo_onboarding_draft',
        JSON.stringify({ settings: settingsPayload, session: baselineSession })
      );

      // 4. If user is already authenticated, save right now using existing service
      if (user?.id) {
        await saveUserSettings(user.id, settingsPayload);

        await supabase.from('workout_sessions').insert({
          user_id: user.id,
          ...baselineSession,
        });

        router.replace('/(app)');
      } else {
        router.replace('/(auth)/signup');
      }
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      router.replace('/(auth)/signup');
    }
  };

  const handleQuizKeyPress = (val: string) => {
    if (userAnswer.length >= 6 || feedback !== 'idle') return;
    setUserAnswer((prev) => prev + val);
  };

  const handleQuizDelete = () => {
    if (feedback !== 'idle') return;
    setUserAnswer((prev) => prev.slice(0, -1));
  };

  const handleQuizSubmit = () => {
    if (!userAnswer || feedback !== 'idle' || !quizQuestions[quizIndex]) return;

    const currentQ = quizQuestions[quizIndex];
    const timeSpentMs = Date.now() - questionStartTimeRef.current;
    const attempt = recordAttempt(currentQ, userAnswer, timeSpentMs);

    setFeedback(attempt.isCorrect ? 'correct' : 'incorrect');

    if (attempt.isCorrect) {
      scale.value = withSequence(withTiming(1.05, { duration: 100 }), withTiming(1, { duration: 100 }));
    } else {
      shakeX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }

    const nextAttempts = [...attempts, attempt];
    setAttempts(nextAttempts);

    setTimeout(() => {
      setFeedback('idle');
      setUserAnswer('');

      if (quizIndex + 1 < quizQuestions.length) {
        setQuizIndex((prev) => prev + 1);
        questionStartTimeRef.current = Date.now();
      } else {
        const totalDuration = Date.now() - sessionStartTimeRef.current;
        const totalCorrect = nextAttempts.filter((a) => a.isCorrect).length;

        setBaselineResults({
          totalQuestions: quizQuestions.length,
          correctAnswers: totalCorrect,
          totalTimeMs: totalDuration,
        });

        handleNext();
      }
    }, 550);
  };

  const animatedDisplayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value }],
  }));

  const animatedCursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // ================= STEP SCREENS =================

  // STEP 1: Why Mental Math Matters
  const renderStep1 = () => (
    <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
      <View style={styles.headerBlock}>
        <View style={[styles.badgePill, { backgroundColor: 'rgba(236, 103, 60, 0.12)', borderColor: 'rgba(236, 103, 60, 0.28)' }]}>
          <Ionicons name="sparkles" size={14} color="#EC673C" style={{ marginRight: 6 }} />
          <Text style={styles.badgeText}>CORE PURPOSE</Text>
        </View>
        <Text style={[styles.headline, { color: theme.text }, isNarrow && { fontSize: 26, lineHeight: 32 }]}>
          Why Mental Math{'\n'}<Text style={styles.orangeText}>Actually Matters</Text>
        </Text>
        <Text style={[styles.subheadline, { color: theme.muted }]}>
          Numbers run every part of our lives. Strengthening calculation speed gives you an unfair advantage daily.
        </Text>
      </View>

      <View style={[styles.cardsList, isTall && { gap: 18 }]}>
        {[
          {
            icon: 'cart-outline' as const,
            color: '#EC673C',
            bg: 'rgba(236, 103, 60, 0.14)',
            title: 'Think faster in real life',
            desc: 'Shopping, bills, budgeting, discounts, and split payments on the fly.',
          },
          {
            icon: 'bulb-outline' as const,
            color: '#AFA2FE',
            bg: 'rgba(175, 162, 254, 0.16)',
            title: 'Keep your mind active',
            desc: 'Exercise working memory, focus, and overall cognitive agility.',
          },
          {
            icon: 'shield-checkmark-outline' as const,
            color: '#F6FE91',
            bg: 'rgba(246, 254, 145, 0.18)',
            title: 'Catch mistakes faster',
            desc: "Instantly spot errors that don't add up on receipts, bills, or spreadsheets.",
          },
        ].map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.infoCard,
              { backgroundColor: theme.card, borderColor: theme.border },
              isTall && { paddingVertical: 22, paddingHorizontal: 18 },
            ]}
          >
            <View style={[styles.iconCircle, isTall && { width: 52, height: 52, borderRadius: 16 }, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={isTall ? 26 : 22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, isTall && { fontSize: 17, marginBottom: 6 }, { color: theme.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.cardDesc, isTall && { fontSize: 13, lineHeight: 19 }, { color: theme.muted }]}>
                {item.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // STEP 2: Confidence Level
  const renderStep2 = () => {
    const options = [
      { id: 'very', label: 'Very confident', iconColor: '#4CAF50', iconBg: 'rgba(76, 175, 80, 0.18)', icon: 'happy' as const },
      { id: 'pretty', label: 'Pretty good', iconColor: '#FFC107', iconBg: 'rgba(255, 193, 7, 0.18)', icon: 'happy-outline' as const },
      { id: 'sometimes', label: 'Sometimes I struggle', iconColor: '#EC673C', iconBg: 'rgba(236, 103, 60, 0.18)', icon: 'sad-outline' as const },
      { id: 'avoid', label: 'I avoid doing math in my head', iconColor: '#E53935', iconBg: 'rgba(229, 57, 53, 0.18)', icon: 'sad' as const },
    ];

    return (
      <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerBlock}>
          <Text style={[styles.headline, { color: theme.text }, isNarrow && { fontSize: 26, lineHeight: 32 }]}>
            How confident are you{'\n'}with mental math?
          </Text>
          <Text style={[styles.subheadline, { color: theme.muted }]}>
            Be honest — there are no wrong answers.
          </Text>
        </View>

        <View style={[styles.cardsList, isTall && { gap: 16 }]}>
          {options.map((item) => {
            const isSelected = confidenceLevel === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => setConfidenceLevel(item.id)}
                style={[
                  styles.confidenceCard,
                  isTall && { minHeight: 74, paddingHorizontal: 18 },
                  {
                    backgroundColor: theme.card,
                    borderColor: isSelected ? '#EC673C' : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.moodCircle, isTall && { width: 48, height: 48, borderRadius: 24 }, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon} size={isTall ? 28 : 24} color={item.iconColor} />
                </View>

                <Text
                  style={[
                    styles.confidenceLabel,
                    isTall && { fontSize: 16 },
                    { color: theme.text },
                    isSelected && { color: '#EC673C' },
                  ]}
                >
                  {item.label}
                </Text>

                <View style={[styles.radioOuter, isSelected && { borderColor: '#EC673C' }]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // STEP 3: Training Goal (Frequency + Duration + Questions per workout)
  const renderStep3 = () => {
    const dayOptions = ['3 days per week', '5 days per week', 'Every day'];
    const minuteOptions = ['2 minutes', '5 minutes', '10 minutes'];
    const questionOptions = [5, 10, 30, 50];

    return (
      <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerBlock}>
          <Text style={[styles.headline, { color: theme.text }]}>Set your training goal</Text>
        </View>

        {/* 1. Frequency */}
        <View style={styles.goalSection}>
          <Text style={[styles.goalSectionTitle, { color: theme.text }]}>
            How often do you want to train?
          </Text>
          <View style={styles.pillsRow}>
            {dayOptions.map((opt) => {
              const active = trainingDays === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.85}
                  onPress={() => setTrainingDays(opt)}
                  style={[
                    styles.goalPill,
                    {
                      backgroundColor: active ? '#EC673C' : theme.card,
                      borderColor: active ? '#EC673C' : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.goalPillText,
                      { color: active ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {opt.replace(' per week', '\nper week')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Questions per Workout (5, 10, 30, 50) */}
        <View style={styles.goalSection}>
          <Text style={[styles.goalSectionTitle, { color: theme.text }]}>
            How many questions per workout?
          </Text>
          <View style={styles.pillsRow}>
            {questionOptions.map((count) => {
              const active = questionGoal === count;
              return (
                <TouchableOpacity
                  key={count}
                  activeOpacity={0.85}
                  onPress={() => setQuestionGoal(count)}
                  style={[
                    styles.goalPillCompact,
                    {
                      backgroundColor: active ? '#EC673C' : theme.card,
                      borderColor: active ? '#EC673C' : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.questionCountText,
                      { color: active ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {count}
                  </Text>
                  <Text
                    style={[
                      styles.questionSubText,
                      { color: active ? '#FFFFFF' : theme.muted },
                    ]}
                  >
                    qs
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Duration */}
        <View style={styles.goalSection}>
          <Text style={[styles.goalSectionTitle, { color: theme.text }]}>
            How long can you train per session?
          </Text>
          <View style={styles.pillsRow}>
            {minuteOptions.map((opt) => {
              const active = sessionMinutes === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  activeOpacity={0.85}
                  onPress={() => setSessionMinutes(opt)}
                  style={[
                    styles.goalPill,
                    {
                      backgroundColor: active ? '#EC673C' : theme.card,
                      borderColor: active ? '#EC673C' : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.goalPillText,
                      { color: active ? '#FFFFFF' : theme.text },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Plan Summary Card */}
        <View
          style={[
            styles.planSummaryCard,
            {
              backgroundColor: isDark ? 'rgba(236, 103, 60, 0.08)' : '#FFF6F2',
              borderColor: isDark ? 'rgba(236, 103, 60, 0.2)' : '#FFE3D6',
            },
          ]}
        >
          <Text style={styles.planSummaryHeader}>Your plan</Text>

          <View style={styles.planSummaryItem}>
            <Ionicons name="calendar-outline" size={18} color="#EC673C" style={{ marginRight: 10 }} />
            <Text style={[styles.planSummaryText, { color: theme.text }]}>
              {trainingDays}
            </Text>
          </View>

          <View style={styles.planSummaryItem}>
            <Ionicons name="flash-outline" size={18} color="#EC673C" style={{ marginRight: 10 }} />
            <Text style={[styles.planSummaryText, { color: theme.text }]}>
              {questionGoal} questions per workout
            </Text>
          </View>

          <View style={styles.planSummaryItem}>
            <Ionicons name="time-outline" size={18} color="#EC673C" style={{ marginRight: 10 }} />
            <Text style={[styles.planSummaryText, { color: theme.text }]}>
              {sessionMinutes} per session
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // STEP 4: Diagnostic Baseline Quiz
  const renderStep4 = () => {
    const currentQ = quizQuestions[quizIndex];
    if (!currentQ) return null;

    const progressPct = ((quizIndex + 1) / quizQuestions.length) * 100;
    const inputColor = feedback === 'correct' ? '#4CAF50' : feedback === 'incorrect' ? '#D93838' : theme.text;

    return (
      <View style={styles.quizWrapper}>
        <View style={styles.headerBlock}>
          <View style={[styles.badgePill, { backgroundColor: 'rgba(236, 103, 60, 0.12)', borderColor: 'rgba(236, 103, 60, 0.28)' }]}>
            <Ionicons name="speedometer-outline" size={13} color="#EC673C" style={{ marginRight: 5 }} />
            <Text style={styles.badgeText}>QUICK DIAGNOSTIC</Text>
          </View>
          <Text style={[styles.headline, { color: theme.text }, isNarrow && { fontSize: 22, lineHeight: 28 }]}>
            Let's see where you're starting.
          </Text>
          <Text style={[styles.subheadline, { color: theme.muted }]}>No calculator. Just use your head.</Text>
        </View>

        <View style={styles.quizProgressBar}>
          <View style={styles.quizProgressHeader}>
            <Text style={[styles.quizProgressText, { color: theme.muted }]}>
              Question {quizIndex + 1} of {quizQuestions.length}
            </Text>
            <Text style={[styles.quizProgressText, { color: theme.text, fontWeight: '800' }]}>
              {Math.round(progressPct)}%
            </Text>
          </View>
          <View style={[styles.quizProgressTrack, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <View style={[styles.quizProgressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        <View style={styles.equationCenterBox}>
          <Reanimated.View style={[animatedDisplayStyle, { alignItems: 'center' }]}>
            <Text style={[styles.equationText, { color: theme.text }]}>{currentQ.equation}</Text>
            <View style={styles.answerInputRow}>
              <Text style={[styles.answerText, { color: inputColor }]}>{userAnswer}</Text>
              <Reanimated.View style={[styles.blinkingCursor, { backgroundColor: theme.text }, animatedCursorStyle]} />
            </View>
          </Reanimated.View>
        </View>

        <View style={styles.keypadWrapper}>
          <CustomNumericKeypad
            onKeyPress={handleQuizKeyPress}
            onDelete={handleQuizDelete}
            onSubmit={handleQuizSubmit}
            disabled={feedback !== 'idle'}
          />
        </View>
      </View>
    );
  };

  // STEP 5: Results & CTA
  const renderStep5 = () => {
    const totalQ = baselineResults.totalQuestions || 3;
    const correctQ = baselineResults.correctAnswers || 0;
    const accuracy = Math.round((correctQ / totalQ) * 100);
    const avgSpeed = (baselineResults.totalTimeMs / totalQ / 1000).toFixed(1);

    const size = isTall ? 204 : 176;
    const strokeWidth = 15;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * accuracy) / 100;

    return (
      <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerBlock}>
          <Text style={[styles.headline, isTall && { fontSize: 32, lineHeight: 38 }, { color: theme.text }]}>
            That's your{'\n'}starting point.
          </Text>
        </View>

        {/* Circular Ring Gauge */}
        <View style={[styles.gaugeContainer, isTall && { marginVertical: 18 }]}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : '#F0F0F2'}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#EC673C"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>

          <View style={styles.gaugeCenterText}>
            <Text style={[styles.gaugePercent, isTall && { fontSize: 40 }, { color: theme.text }]}>{accuracy}%</Text>
            <Text style={[styles.gaugeLabel, isTall && { fontSize: 14 }, { color: theme.muted }]}>Accuracy</Text>
          </View>
        </View>

        {/* Stat Cards */}
        <View style={[styles.resultsCardsRow, isTall && { gap: 16, marginVertical: 16 }]}>
          <View
            style={[
              styles.resultMiniCard,
              isTall && { paddingVertical: 18 },
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F5F7FA' },
            ]}
          >
            <Text style={[styles.resultMiniVal, isTall && { fontSize: 26 }, { color: theme.text }]}>{avgSpeed}s</Text>
            <Text style={[styles.resultMiniLbl, isTall && { fontSize: 13 }, { color: theme.muted }]}>Avg. time</Text>
          </View>

          <View
            style={[
              styles.resultMiniCard,
              isTall && { paddingVertical: 18 },
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F5F7FA' },
            ]}
          >
            <Text style={[styles.resultMiniVal, isTall && { fontSize: 26 }, { color: theme.text }]}>{correctQ}/{totalQ}</Text>
            <Text style={[styles.resultMiniLbl, isTall && { fontSize: 13 }, { color: theme.muted }]}>Correct</Text>
          </View>
        </View>

        {/* Save Result Callout Card */}
        <View
          style={[
            styles.saveResultCard,
            isTall && { padding: 20, marginVertical: 14 },
            {
              backgroundColor: isDark ? 'rgba(236, 103, 60, 0.08)' : '#FFF7F4',
              borderColor: isDark ? 'rgba(236, 103, 60, 0.24)' : '#FFE6DC',
            },
          ]}
        >
          <View style={styles.saveResultHeader}>
            <Ionicons name="sparkles" size={18} color="#EC673C" style={{ marginRight: 8 }} />
            <Text style={[styles.saveResultTitle, isTall && { fontSize: 16 }]}>Save your first result</Text>
          </View>
          <Text style={[styles.saveResultSubtitle, isTall && { fontSize: 13, lineHeight: 19 }, { color: theme.muted }]}>
            Create an account to save your baseline stats, lock in your starting tier, and track your progress.
          </Text>
        </View>

        <Text style={[styles.resultEncourageText, isTall && { fontSize: 14, lineHeight: 20 }, { color: theme.muted }]}>
          Now imagine what your numbers could look like after a few weeks of consistent training.
        </Text>
      </ScrollView>
    );
  };

  const renderActiveStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <SafeAreaView style={styles.safeArea}>
        {/* HEADER: Back Button, Progress Bar, Step Indicator, and Skip */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top > 0 ? 0 : 8, 4) }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.card }]} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.progressTrackWrapper}>
            <View style={[styles.progressTrackBackground, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          </View>

          <View style={styles.stepIndicatorPill}>
            <Text style={[styles.stepCountText, { color: theme.muted }]}>
              {currentStep}/{TOTAL_STEPS}
            </Text>
          </View>

          {currentStep !== 4 ? (
            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipButton}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        {/* STEP CONTENT BODY */}
        <View style={[styles.contentBody, currentStep === 4 && styles.contentBodyQuiz]}>
          {renderActiveStep()}
        </View>

        {/* BOTTOM ACTION */}
        {currentStep !== 4 && (
          <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}>
            <TouchableOpacity style={styles.nextButton} activeOpacity={0.88} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {currentStep === TOTAL_STEPS ? 'Create Account' : 'Next >'}
              </Text>
              {currentStep === TOTAL_STEPS && (
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },

  /* HEADER */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  progressTrackWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  progressTrackBackground: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EC673C',
    borderRadius: 3,
  },
  stepIndicatorPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  stepCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  skipButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  skipButtonText: {
    color: '#8E9993',
    fontSize: 15,
    fontWeight: '600',
  },

  /* BODY */
  contentBody: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  contentBodyQuiz: {
    paddingHorizontal: 12,
  },
  scrollBlock: {
    flexGrow: 1,
    paddingVertical: 8,
    justifyContent: 'space-around',
  },

  /* TYPOGRAPHY */
  headerBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeText: {
    color: '#EC673C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  orangeText: {
    color: '#EC673C',
  },
  subheadline: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    paddingHorizontal: 12,
  },

  /* STEP 1 BENEFIT CARDS */
  cardsList: {
    gap: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },

  /* STEP 2 CONFIDENCE CARDS */
  confidenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  moodCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  confidenceLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EC673C',
  },

  /* STEP 3 GOAL PILLS */
  goalSection: {
    marginBottom: 14,
  },
  goalSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goalPill: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPillCompact: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionCountText: {
    fontSize: 18,
    fontWeight: '900',
  },
  questionSubText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  goalPillText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  planSummaryCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 6,
  },
  planSummaryHeader: {
    color: '#EC673C',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  planSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  planSummaryText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* STEP 4 QUIZ */
  quizWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  quizProgressBar: {
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  quizProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  quizProgressText: {
    fontSize: 11,
  },
  quizProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  quizProgressFill: {
    height: '100%',
    backgroundColor: '#EC673C',
  },
  equationCenterBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 110,
  },
  equationText: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
  },
  answerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  answerText: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 2,
  },
  blinkingCursor: {
    width: 3.5,
    height: 38,
    marginLeft: 4,
    borderRadius: 2,
  },
  keypadWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingTop: 4,
  },

  /* STEP 5 RESULTS */
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  gaugeCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercent: {
    fontSize: 38,
    fontWeight: '900',
  },
  gaugeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  resultsCardsRow: {
    flexDirection: 'row',
    gap: 14,
    marginVertical: 12,
  },
  resultMiniCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 18,
  },
  resultMiniVal: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  resultMiniLbl: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveResultCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 10,
  },
  saveResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  saveResultTitle: {
    color: '#EC673C',
    fontSize: 15,
    fontWeight: '800',
  },
  saveResultSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  resultEncourageText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
    marginVertical: 4,
  },

  /* FOOTER */
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  nextButton: {
    backgroundColor: '#EC673C',
    minHeight: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC673C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});