import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { saveUserSettings } from '@/src/services/settingsService';
import { saveTrainingGoals } from '@/src/services/profileService';
import { OfflineNotice } from '@/src/components/OfflineNotice';
import { FrictionArea } from '@/src/types/profile';
import {
  DURATION_MINUTE_OPTIONS,
  FREQUENCY_DAY_OPTIONS,
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_DRAFT_KEY,
  OnboardingPrimaryGoal,
  QUESTION_GOAL_OPTIONS,
  buildOnboardingDraft,
  frequencyLabel,
} from '@/src/utils/onboardingDraft';
import { formatDurationGoal, formatQuestionGoal } from '@/src/utils/goalFormatters';

const TOTAL_STEPS = 4;

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
  const [isOffline, setIsOffline] = useState(false);

  // User Selections (initialized without pre-selections)
  const [primaryGoal, setPrimaryGoal] = useState<OnboardingPrimaryGoal | null>(null);
  const [frictionArea, setFrictionArea] = useState<FrictionArea | null>(null);
  const [trainingDays, setTrainingDays] = useState<number | null>(null);
  const [questionGoal, setQuestionGoal] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number | null>(null);

  // NetInfo network connectivity listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  const checkConnectivity = async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    const offline = state.isConnected === false || state.isInternetReachable === false;
    setIsOffline(offline);
    return !offline;
  };

  // Progress bar animation
  const progressVal = useSharedValue(1 / TOTAL_STEPS);

  const updateProgress = (stepNumber: number) => {
    progressVal.value = withTiming(stepNumber / TOTAL_STEPS, {
      duration: 250,
      easing: Easing.out(Easing.quad),
    });
  };

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressVal.value * 100}%`,
  }));

  const canProceedCurrentStep = () => {
    if (currentStep === 1) return Boolean(primaryGoal);
    if (currentStep === 2) return Boolean(frictionArea);
    if (currentStep === 3) {
      return Boolean(questionGoal) && Boolean(trainingDays) && Boolean(sessionDuration);
    }
    return true;
  };

  const handleNext = () => {
    if (!canProceedCurrentStep()) return;

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

  // Only allowed on Step 3
  const handleSkipStep3 = () => {
    if (!trainingDays) setTrainingDays(5);
    if (!questionGoal) setQuestionGoal(10);
    if (!sessionDuration) setSessionDuration(2);

    const next = currentStep + 1;
    setCurrentStep(next);
    updateProgress(next);
  };

  const handleCompleteAndGoSignup = async () => {
    const isOnline = await checkConnectivity();
    if (!isOnline) return;

    try {
      const draft = buildOnboardingDraft({
        primaryGoal,
        frictionArea,
        dailyQuestions: questionGoal,
        weeklyFrequencyDays: trainingDays,
        sessionDurationMinutes: sessionDuration,
      });

      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      await AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
      await saveTrainingGoals(draft.trainingGoals);

      if (user?.id) {
        await saveUserSettings(user.id, draft.settings);
        await saveTrainingGoals(draft.trainingGoals, user.id);
        router.replace('/(app)');
      } else {
        router.replace('/(auth)/signup');
      }
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      router.replace('/(auth)/signup');
    }
  };

  // Theme Constants
  const screenBg = isDark ? '#0A0F0B' : theme.background || '#F1ECE9';
  const textColor = theme.text;
  const textSubtle = theme.muted;
  const cardBg = theme.card;
  const accentGreen = '#BCE3AA';
  const accentLilac = '#F2CAEC';
  const borderColor = theme.border;

  // Offline blocker
  if (isOffline) {
    return <OfflineNotice onRetry={checkConnectivity} />;
  }

  // ================= STEP 1: Core Motivation =================
  const renderStep1 = () => {
    const goals = [
      {
        id: 'everyday' as const,
        icon: 'cart-outline' as const,
        title: 'Everyday Quick Math',
        desc: 'Calculate shopping, tips, discounts, and split bills on the spot.',
      },
      {
        id: 'memory' as const,
        icon: 'bulb-outline' as const,
        title: 'Sharper Focus & Memory',
        desc: 'Boost mental agility, recall speed, and overall cognitive sharpness.',
      },
      {
        id: 'career' as const,
        icon: 'briefcase-outline' as const,
        title: 'Career & Exam Prep',
        desc: 'High-speed mental math for interviews, exams, and business meetings.',
      },
      {
        id: 'speed' as const,
        icon: 'flash-outline' as const,
        title: 'Pure Calculation Speed',
        desc: 'Eliminate hesitation and cut down mental math lag to under 2 seconds.',
      },
    ];

    return (
      <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerBlock}>
          <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.16)' : accentLilac }]}>
            <Ionicons name="sparkles" size={13} color={isDark ? accentGreen : '#0A0F0B'} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: isDark ? accentGreen : '#0A0F0B' }]}>YOUR GOAL</Text>
          </View>
          <Text style={[styles.headline, { color: textColor }, isNarrow && { fontSize: 26, lineHeight: 32 }]}>
            What do you want to{'\n'}get better at?
          </Text>
          <Text style={[styles.subheadline, { color: textSubtle }]}>
            Pick your goal. We'll tailor your workouts around it.
          </Text>
        </View>

        <View style={[styles.cardsList, isTall && { gap: 14 }]}>
          {goals.map((item) => {
            const isSelected = primaryGoal === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => setPrimaryGoal(item.id)}
                style={[
                  styles.interactiveCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: isSelected ? accentGreen : borderColor,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(188, 227, 170, 0.25)' : accentGreen)
                        : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={textColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>{item.title}</Text>
                  <Text style={[styles.cardDesc, { color: textSubtle }]}>{item.desc}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: isSelected ? accentGreen : 'rgba(255, 255, 255, 0.25)' }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: isDark ? accentGreen : '#0A0F0B' }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // ================= STEP 2: Mental Barrier =================
  const renderStep2 = () => {
    const barriers = [
      {
        id: 'addition' as const,
        icon: 'add' as const,
        title: 'Mental Addition & Carries',
        desc: 'Quick sums with carrying numbers takes extra mental effort.',
      },
      {
        id: 'subtraction' as const,
        icon: 'remove' as const,
        title: 'Mental Subtraction & Borrowing',
        desc: 'Borrowing numbers takes too long to do in your head.',
      },
      {
        id: 'multiplication' as const,
        icon: 'close' as const,
        title: 'Multiplication Tables',
        desc: 'Freezing on 7s, 8s, 12s, or double-digit calculations.',
      },
      {
        id: 'division' as const,
        icon: 'git-commit-outline' as const,
        title: 'Quick Division & Factors',
        desc: 'Spotting quotients and dividing numbers mentally slows you down.',
      },
      {
        id: 'mixed' as const,
        icon: 'shuffle' as const,
        title: 'Switching Operations on the Fly',
        desc: 'Losing momentum when switching between plus, minus, and times.',
      },
    ];

    return (
      <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerBlock}>
          <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(242, 202, 236, 0.2)' : accentLilac }]}>
            <Ionicons name="flash-outline" size={13} color={isDark ? accentLilac : '#0A0F0B'} style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: isDark ? accentLilac : '#0A0F0B' }]}>SMART DIAGNOSTIC</Text>
          </View>
          <Text style={[styles.headline, { color: textColor }, isNarrow && { fontSize: 26, lineHeight: 32 }]}>
            What slows you{'\n'}down most?
          </Text>
          <Text style={[styles.subheadline, { color: textSubtle }]}>
            Tell us where you struggle. We'll build around it.
          </Text>
        </View>

        <View style={[styles.cardsList, isTall && { gap: 12 }]}>
          {barriers.map((item) => {
            const isSelected = frictionArea === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => setFrictionArea(item.id)}
                style={[
                  styles.interactiveCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: isSelected ? accentLilac : borderColor,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(242, 202, 236, 0.25)' : accentLilac)
                        : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={textColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: textColor }]}>{item.title}</Text>
                  <Text style={[styles.cardDesc, { color: textSubtle }]}>{item.desc}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: isSelected ? accentLilac : 'rgba(255, 255, 255, 0.25)' }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: isDark ? accentLilac : '#0A0F0B' }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // ================= STEP 3: Habit Routine =================
  const renderStep3 = () => {
    // Matched with ProfileScreen options [5, 10, 20, 30, 50]
    const questionOptions = [5, 10, 20, 30, 50];

    const currentQuestions = questionGoal || 10;
    const currentDays = trainingDays || 5;
    const monthlyMultiplier = currentDays >= 7 ? 30 : currentDays === 5 ? 22 : 14;
    const monthlyEquations = currentQuestions * monthlyMultiplier;

    return (
      <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerBlock}>
          <Text style={[styles.headline, { color: textColor }]}>
            How much do you{'\n'}want to train?
          </Text>
          <Text style={[styles.subheadline, { color: textSubtle }]}>
            Short, focused practice works best. Build a sustainable daily rhythm.
          </Text>
        </View>

        {/* 1. Questions per workout */}
        <View style={styles.goalSection}>
          <Text style={[styles.goalSectionTitle, { color: textColor }]}>Questions per workout</Text>
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
                      backgroundColor: active ? accentGreen : cardBg,
                      borderColor: active ? accentGreen : borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.questionCountText, { color: active ? '#0A0F0B' : textColor }]}>
                    {count}
                  </Text>
                  <Text style={[styles.questionSubText, { color: active ? '#0A0F0B' : textSubtle }]}>
                    questions
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Training frequency */}
        <View style={styles.goalSection}>
          <Text style={[styles.goalSectionTitle, { color: textColor }]}>Training frequency</Text>
          <View style={styles.pillsRow}>
            {FREQUENCY_DAY_OPTIONS.map((opt) => {
              const active = trainingDays === opt.days;
              return (
                <TouchableOpacity
                  key={opt.days}
                  activeOpacity={0.85}
                  onPress={() => setTrainingDays(opt.days)}
                  style={[
                    styles.goalPill,
                    {
                      backgroundColor: active ? (isDark ? 'rgba(188, 227, 170, 0.2)' : accentGreen) : cardBg,
                      borderColor: active ? accentGreen : borderColor,
                      borderWidth: active ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.goalPillText, { color: textColor }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. 2-Minute Commitment Card */}
        {questionGoal && trainingDays ? (
          <View
            style={[
              styles.projectionCard,
              {
                backgroundColor: isDark ? 'rgba(188, 227, 170, 0.12)' : '#E9F5E3',
                borderColor: isDark ? 'rgba(188, 227, 170, 0.28)' : '#D0E7C7',
              },
            ]}
          >
            <View style={styles.projectionHeader}>
              <Ionicons name="time-outline" size={20} color={isDark ? accentGreen : '#1D4511'} style={{ marginRight: 8 }} />
              <Text style={[styles.projectionTitle, { color: isDark ? accentGreen : '#1D4511' }]}>
                Your workout takes about 2 minutes.
              </Text>
            </View>
            <Text style={[styles.projectionBody, { color: textSubtle }]}>
              That's up to <Text style={{ fontWeight: '800', color: textColor }}>{monthlyEquations} questions</Text> a month at your current goal.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  // ================= STEP 4: Custom Plan Reveal & Sign-up Sale =================
  const renderStep4 = () => {
    return (
      <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.headerBlock}>
          <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.18)' : accentGreen }]}>
            <Ionicons name="checkmark-circle" size={14} color="#0A0F0B" style={{ marginRight: 6 }} />
            <Text style={[styles.badgeText, { color: '#0A0F0B' }]}>PLAN GENERATED</Text>
          </View>
          <Text style={[styles.headline, isTall && { fontSize: 32, lineHeight: 38 }, { color: textColor }]}>
            Your personalized plan{'\n'}is ready.
          </Text>
          <Text style={[styles.subheadline, { color: textSubtle }]}>
            Built around your goal, your weak spot, and the routine you chose.
          </Text>
        </View>

        {/* Plan Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: borderColor }]}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.2)' : accentGreen }]}>
              <Ionicons name="compass-outline" size={20} color={textColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: textSubtle }]}>Focus Track</Text>
              <Text style={[styles.summaryValue, { color: textColor }]}>
                {primaryGoal === 'speed'
                  ? 'Pure Calculation Speed'
                  : primaryGoal === 'memory'
                  ? 'Memory & Cognitive Focus'
                  : primaryGoal === 'career'
                  ? 'Career & Professional Math'
                  : 'Everyday Quick Math'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: isDark ? 'rgba(242, 202, 236, 0.25)' : accentLilac }]}>
              <Ionicons name="options-outline" size={20} color={textColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: textSubtle }]}>Target Weak Spot</Text>
              <Text style={[styles.summaryValue, { color: textColor }]}>
                {frictionArea === 'addition'
                  ? 'Addition & Carrying'
                  : frictionArea === 'multiplication'
                  ? 'Multiplication Tables'
                  : frictionArea === 'subtraction'
                  ? 'Mental Differences & Borrowing'
                  : frictionArea === 'division'
                  ? 'Factor Quotients'
                  : 'Mixed Operation Switching'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.2)' : accentGreen }]}>
              <Ionicons name="calendar-outline" size={20} color={textColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: textSubtle }]}>Daily Habit</Text>
              <Text style={[styles.summaryValue, { color: textColor }]}>
                {questionGoal || 10} questions / workout • {frequencyLabel(trainingDays)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: isDark ? 'rgba(242, 202, 236, 0.25)' : accentLilac }]}>
              <Ionicons name="shuffle" size={20} color={textColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: textSubtle }]}>First Workout</Text>
              <Text style={[styles.summaryValue, { color: textColor }]}>
                Mixed Baseline Challenge (Easy)
              </Text>
            </View>
          </View>
        </View>

        {/* Sell the Signup */}
        <View style={styles.signupPitchBox}>
          <Text style={[styles.pitchHeading, { color: textColor }]}>
            Save your plan and start training.
          </Text>
          <Text style={[styles.pitchSubheading, { color: textSubtle }]}>
            Create your free account to save your plan and track your progress.
          </Text>
        </View>
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
      default:
        return null;
    }
  };

  const canProceed = canProceedCurrentStep();

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top > 0 ? 0 : 8, 4) }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: cardBg }]} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={textColor} />
          </TouchableOpacity>

          <View style={styles.progressTrackWrapper}>
            <View style={[styles.progressTrackBackground, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]}>
              <Animated.View style={[styles.progressFill, { backgroundColor: accentGreen }, progressAnimatedStyle]} />
            </View>
          </View>

          <View style={styles.stepIndicatorPill}>
            <Text style={[styles.stepCountText, { color: textSubtle }]}>
              {currentStep}/{TOTAL_STEPS}
            </Text>
          </View>

          {/* Skip button only allowed on Step 3 */}
          {currentStep === 3 ? (
            <TouchableOpacity onPress={handleSkipStep3} activeOpacity={0.7} style={styles.skipButton}>
              <Text style={[styles.skipButtonText, { color: textSubtle }]}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        {/* STEP CONTENT BODY */}
        <View style={styles.contentBody}>{renderActiveStep()}</View>

        {/* BOTTOM ACTION BUTTON */}
        <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              {
                backgroundColor: canProceed ? accentGreen : (isDark ? 'rgba(188, 227, 170, 0.25)' : 'rgba(10, 15, 11, 0.15)'),
              },
            ]}
            disabled={!canProceed}
            activeOpacity={0.88}
            onPress={handleNext}
          >
            <Text
              style={[
                styles.nextButtonText,
                { color: canProceed ? '#0A0F0B' : (isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(10, 15, 11, 0.4)') },
              ]}
            >
              {currentStep === TOTAL_STEPS ? 'Create my free account' : 'Next'}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={canProceed ? '#0A0F0B' : (isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(10, 15, 11, 0.4)')}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        </View>
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
    fontSize: 14,
    fontWeight: '600',
  },

  /* BODY */
  contentBody: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  scrollBlock: {
    flexGrow: 1,
    paddingVertical: 8,
    justifyContent: 'space-around',
  },

  /* TYPOGRAPHY */
  headerBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    paddingHorizontal: 12,
  },

  /* INTERACTIVE TILES & CARDS */
  cardsList: {
    gap: 12,
  },
  interactiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  /* STEP 3 GOAL PILLS */
  goalSection: {
    marginBottom: 18,
  },
  goalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  goalPill: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPillCompact: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionCountText: {
    fontSize: 18,
    fontWeight: '800',
  },
  questionSubText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  goalPillText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  projectionCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 6,
  },
  projectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  projectionBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  /* STEP 4 SUMMARY */
  summaryCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  signupPitchBox: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  pitchHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  pitchSubheading: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },

  /* FOOTER */
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  nextButton: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});