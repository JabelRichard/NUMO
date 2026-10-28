import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
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
import { FONT_FAMILY, MAX_FONT_SCALE, typography } from '@/src/constants/typography';
import { PALETTE } from '@/src/constants/palette';
import { saveUserSettings } from '@/src/services/settingsService';
import { saveTrainingGoals } from '@/src/services/profileService';
import { ComfortLevel, FrictionArea } from '@/src/types/profile';
import {
  DURATION_MINUTE_OPTIONS,
  FREQUENCY_DAY_OPTIONS,
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_DRAFT_KEY,
  OnboardingPrimaryGoal,
  RECOMMENDED_DURATION_MINUTES,
  RECOMMENDED_FREQUENCY_DAYS,
  buildOnboardingDraft,
  questionsForDuration,
} from '@/src/utils/onboardingDraft';
import {
  COMFORT_LEVELS,
  GOALS,
  IoniconName,
  NOT_SURE_OPTION,
  WEAK_SPOTS,
} from '@/src/constants/planOptions';

const TOTAL_STEPS = 5;

const FIRST_WORKOUT_LABEL: Record<ComfortLevel, string> = {
  starting: 'A quick, easy warm-up',
  getting_there: 'A quick warm-up',
  confident: 'A quick warm-up challenge',
};

const OFFLINE_MESSAGE = "You're offline. Connect to the internet to save your plan.";
const SAVE_FAILED_MESSAGE =
  "We couldn't save your plan just now. Your answers are kept on this device, so please try again.";

function daysPhrase(days: number): string {
  return days >= 7 ? 'every day' : `${days} days a week`;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = Boolean(theme.isDark ?? true);

  const isNarrow = width < 360;

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // User selections. Step 4 starts on the recommended values so Next works right away.
  const [primaryGoal, setPrimaryGoal] = useState<OnboardingPrimaryGoal | null>(null);
  const [weakSpots, setWeakSpots] = useState<FrictionArea[]>([]);
  const [isUnsure, setIsUnsure] = useState(false);
  const [comfortLevel, setComfortLevel] = useState<ComfortLevel | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(RECOMMENDED_DURATION_MINUTES);
  const [trainingDays, setTrainingDays] = useState<number>(RECOMMENDED_FREQUENCY_DAYS);

  const checkConnectivity = async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return !(state.isConnected === false || state.isInternetReachable === false);
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
    if (currentStep === 2) return isUnsure || weakSpots.length > 0;
    if (currentStep === 3) return Boolean(comfortLevel);
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
    setSaveError(null);
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      updateProgress(prev);
    } else {
      router.replace('/(auth)/welcome');
    }
  };

  // "Not sure" and the specific weak spots exclude each other.
  const toggleWeakSpot = (id: FrictionArea) => {
    setIsUnsure(false);
    setWeakSpots((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  };

  const toggleUnsure = () => {
    setWeakSpots([]);
    setIsUnsure((prev) => !prev);
  };

  const handleCompleteAndGoSignup = async () => {
    if (isSaving) return;
    setSaveError(null);
    setIsSaving(true);

    try {
      const isOnline = await checkConnectivity();
      if (!isOnline) {
        setSaveError(OFFLINE_MESSAGE);
        return;
      }

      const draft = buildOnboardingDraft({
        primaryGoal,
        frictionAreas: weakSpots,
        comfortLevel,
        weeklyFrequencyDays: trainingDays,
        sessionDurationMinutes: sessionDuration,
      });

      // Store the draft first so the answers survive a failed save.
      // useProtectedRoute syncs any leftover draft once the user is signed in.
      await AsyncStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
      await saveTrainingGoals(draft.trainingGoals);

      if (user?.id) {
        const result = await saveUserSettings(user.id, draft.settings);
        if (!result.success) throw new Error(result.error);
        await saveTrainingGoals(draft.trainingGoals, user.id);

        await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
        await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
        router.replace('/(app)');
      } else {
        await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
        router.replace('/(auth)/signup');
      }
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setSaveError(SAVE_FAILED_MESSAGE);
    } finally {
      setIsSaving(false);
    }
  };

  // Theme Constants
  const screenBg = isDark ? '#0A0F0B' : theme.background || '#F1ECE9';
  const textColor = theme.text;
  const textSubtle = theme.subtext;
  const cardBg = theme.card;
  const borderColor = theme.border;
  // One accent for every selected state. Light mode uses the deep sage so the border stays visible.
  const accent = theme.primary;
  const selectedBorder = isDark ? theme.primary : theme.primaryText;
  const selectedSoft = theme.primarySoft;
  const checkColor = isDark ? theme.onPrimary : PALETTE.white;
  const iconBoxIdle = theme.pillBg;

  const renderHeader = (title: string, subtitle: string) => (
    <View style={styles.headerBlock}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE.screenTitle}
        style={[styles.headline, { color: textColor }, isNarrow && { fontSize: 24, lineHeight: 30 }]}
      >
        {title}
      </Text>
      <Text style={[styles.subheadline, { color: textSubtle }]}>{subtitle}</Text>
    </View>
  );

  const renderSelectionMark = (selected: boolean, shape: 'radio' | 'checkbox') => (
    <View
      style={[
        styles.selectionMark,
        shape === 'checkbox' && styles.selectionMarkSquare,
        selected
          ? { backgroundColor: selectedBorder, borderColor: selectedBorder }
          : { borderColor: theme.border, backgroundColor: 'transparent' },
      ]}
    >
      {selected && <Ionicons name="checkmark" size={16} color={checkColor} />}
    </View>
  );

  const renderOptionCard = (opts: {
    key: string;
    title: string;
    desc: string;
    selected: boolean;
    role: 'radio' | 'checkbox';
    onPress: () => void;
    leading: React.ReactNode;
  }) => (
    <TouchableOpacity
      key={opts.key}
      activeOpacity={0.85}
      onPress={opts.onPress}
      accessibilityRole={opts.role}
      accessibilityState={opts.role === 'radio' ? { selected: opts.selected } : { checked: opts.selected }}
      accessibilityLabel={`${opts.title}. ${opts.desc}`}
      style={[
        styles.interactiveCard,
        {
          backgroundColor: cardBg,
          borderColor: opts.selected ? selectedBorder : borderColor,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: opts.selected ? selectedSoft : iconBoxIdle }]}>
        {opts.leading}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: textColor }]}>{opts.title}</Text>
        <Text style={[styles.cardDesc, { color: textSubtle }]}>{opts.desc}</Text>
      </View>
      {renderSelectionMark(opts.selected, opts.role)}
    </TouchableOpacity>
  );

  const renderIcon = (name: IoniconName) => <Ionicons name={name} size={22} color={textColor} />;

  // ================= STEP 1: Goal =================
  const renderStep1 = () => (
    <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
      {renderHeader('What do you want to get better at?', "Pick your goal. We'll tailor your workouts around it.")}

      <View style={styles.cardsList} accessibilityRole="radiogroup">
        {GOALS.map((item) =>
          renderOptionCard({
            key: item.id,
            title: item.title,
            desc: item.desc,
            selected: primaryGoal === item.id,
            role: 'radio',
            onPress: () => setPrimaryGoal(item.id),
            leading: renderIcon(item.icon),
          })
        )}
      </View>
    </ScrollView>
  );

  // ================= STEP 2: Weak spots (multi-select) =================
  const renderStep2 = () => (
    <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
      {renderHeader("What's hardest for you?", 'Pick as many as you like.')}

      <View style={styles.cardsList}>
        {WEAK_SPOTS.map((item) =>
          renderOptionCard({
            key: item.id,
            title: item.title,
            desc: item.desc,
            selected: weakSpots.includes(item.id),
            role: 'checkbox',
            onPress: () => toggleWeakSpot(item.id),
            leading: item.symbol ? (
              <Text
                importantForAccessibility="no"
                accessibilityElementsHidden
                maxFontSizeMultiplier={1.3}
                style={[styles.mathSymbol, { color: textColor }]}
              >
                {item.symbol}
              </Text>
            ) : (
              renderIcon(item.icon!)
            ),
          })
        )}
        {renderOptionCard({
          key: 'unsure',
          title: NOT_SURE_OPTION.title,
          desc: NOT_SURE_OPTION.desc,
          selected: isUnsure,
          role: 'checkbox',
          onPress: toggleUnsure,
          leading: renderIcon(NOT_SURE_OPTION.icon),
        })}
      </View>
    </ScrollView>
  );

  // ================= STEP 3: Comfort level =================
  const renderStep3 = () => (
    <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
      {renderHeader('How comfortable are you with math?', "We'll pick a starting level that suits you.")}

      <View style={styles.cardsList} accessibilityRole="radiogroup">
        {COMFORT_LEVELS.map((item) =>
          renderOptionCard({
            key: item.id,
            title: item.title,
            desc: item.desc,
            selected: comfortLevel === item.id,
            role: 'radio',
            onPress: () => setComfortLevel(item.id),
            leading: renderIcon(item.icon),
          })
        )}
      </View>
    </ScrollView>
  );

  const renderPill = (opts: {
    key: string | number;
    label: string;
    spokenLabel: string;
    selected: boolean;
    recommended: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      key={opts.key}
      activeOpacity={0.85}
      onPress={opts.onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: opts.selected }}
      accessibilityLabel={opts.recommended ? `${opts.spokenLabel}, recommended` : opts.spokenLabel}
      style={[
        styles.goalPill,
        {
          backgroundColor: opts.selected ? selectedSoft : cardBg,
          borderColor: opts.selected ? selectedBorder : borderColor,
        },
      ]}
    >
      <View style={styles.goalPillRow}>
        {opts.selected && (
          <Ionicons name="checkmark-circle" size={18} color={selectedBorder} style={{ marginRight: 4 }} />
        )}
        <Text style={[styles.goalPillText, { color: textColor }]}>{opts.label}</Text>
      </View>
      {opts.recommended && (
        <Text style={[styles.recommendedText, { color: theme.primaryText }]}>Recommended</Text>
      )}
    </TouchableOpacity>
  );

  // ================= STEP 4: Training amount =================
  const renderStep4 = () => (
    <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
      {renderHeader('How much do you want to train?', 'Short, regular practice works best.')}

      <View style={styles.goalSection}>
        <Text style={[styles.goalSectionTitle, { color: textColor }]} accessibilityRole="header">
          Time per day
        </Text>
        <View style={styles.pillsRow} accessibilityRole="radiogroup">
          {DURATION_MINUTE_OPTIONS.map((minutes) =>
            renderPill({
              key: minutes,
              label: `${minutes} min`,
              spokenLabel: `${minutes} minutes a day`,
              selected: sessionDuration === minutes,
              recommended: minutes === RECOMMENDED_DURATION_MINUTES,
              onPress: () => setSessionDuration(minutes),
            })
          )}
        </View>
      </View>

      <View style={styles.goalSection}>
        <Text style={[styles.goalSectionTitle, { color: textColor }]} accessibilityRole="header">
          Days per week
        </Text>
        <View style={styles.pillsRow} accessibilityRole="radiogroup">
          {FREQUENCY_DAY_OPTIONS.map((opt) =>
            renderPill({
              key: opt.days,
              label: opt.label,
              spokenLabel: opt.days >= 7 ? 'Every day' : `${opt.days} days a week`,
              selected: trainingDays === opt.days,
              recommended: opt.days === RECOMMENDED_FREQUENCY_DAYS,
              onPress: () => setTrainingDays(opt.days),
            })
          )}
        </View>
      </View>

      <View
        accessible
        style={[styles.projectionCard, { backgroundColor: selectedSoft, borderColor: borderColor }]}
      >
        <View style={styles.projectionHeader}>
          <Ionicons name="time-outline" size={20} color={theme.primaryText} style={{ marginRight: 8 }} />
          <Text style={[styles.projectionTitle, { color: textColor }]}>
            About {sessionDuration} minutes a day, {daysPhrase(trainingDays)}.
          </Text>
        </View>
        <Text style={[styles.projectionBody, { color: textSubtle }]}>
          That's around {questionsForDuration(sessionDuration)} questions per workout.
        </Text>
      </View>
    </ScrollView>
  );

  const weakSpotSummary = isUnsure || weakSpots.length === 0
    ? "Not sure yet, we'll test you"
    : WEAK_SPOTS.filter((w) => weakSpots.includes(w.id)).map((w) => w.title).join(', ');

  const summaryRows: { icon: IoniconName; label: string; value: string }[] = [
    {
      icon: 'compass-outline',
      label: 'Your goal',
      value: GOALS.find((g) => g.id === primaryGoal)?.title ?? GOALS[0].title,
    },
    { icon: 'options-outline', label: 'Hardest for you', value: weakSpotSummary },
    {
      icon: 'speedometer-outline',
      label: 'Comfort level',
      value: COMFORT_LEVELS.find((c) => c.id === comfortLevel)?.title ?? COMFORT_LEVELS[0].title,
    },
    {
      icon: 'calendar-outline',
      label: 'Daily habit',
      value: `${sessionDuration} min a day • ${daysPhrase(trainingDays)}`,
    },
    {
      icon: 'play-outline',
      label: 'First workout',
      value: FIRST_WORKOUT_LABEL[comfortLevel ?? 'starting'],
    },
  ];

  // ================= STEP 5: Plan ready =================
  const renderStep5 = () => (
    <ScrollView contentContainerStyle={styles.scrollBlock} showsVerticalScrollIndicator={false} bounces={false}>
      <View style={styles.headerBlock}>
        <View style={[styles.badgePill, { backgroundColor: selectedSoft }]}>
          <Ionicons name="checkmark-circle" size={14} color={theme.primaryText} style={{ marginRight: 6 }} />
          <Text style={[styles.badgeText, { color: theme.primaryText }]}>PLAN GENERATED</Text>
        </View>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE.screenTitle}
          style={[styles.headline, { color: textColor }, isNarrow && { fontSize: 24, lineHeight: 30 }]}
        >
          Your personalized plan is ready.
        </Text>
        <Text style={[styles.subheadline, { color: textSubtle }]}>
          Built around your goal, your weak spots, and the routine you chose.
        </Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: borderColor }]}>
        {summaryRows.map((row) => (
          <View key={row.label} style={styles.summaryItem} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
            <View style={[styles.summaryIcon, { backgroundColor: selectedSoft }]}>
              <Ionicons name={row.icon} size={20} color={textColor} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.summaryLabel, { color: textSubtle }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, { color: textColor }]}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.signupPitchBox}>
        <Text style={[styles.pitchHeading, { color: textColor }]}>Save your plan and start training.</Text>
        <Text style={[styles.pitchSubheading, { color: textSubtle }]}>
          Create your free account to save your plan and track your progress.
        </Text>
      </View>
    </ScrollView>
  );

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

  const canProceed = canProceedCurrentStep() && !isSaving;
  const isLastStep = currentStep === TOTAL_STEPS;
  const nextLabel = isLastStep ? 'Create my free account' : 'Next';
  const disabledFg = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(10, 15, 11, 0.4)';

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top > 0 ? 0 : 8, 4) }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: cardBg }]}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={currentStep > 1 ? 'Back to previous question' : 'Back to welcome screen'}
          >
            <Ionicons name="chevron-back" size={22} color={textColor} />
          </TouchableOpacity>

          <View
            style={styles.progressTrackWrapper}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${currentStep} of ${TOTAL_STEPS}`}
            accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: currentStep }}
          >
            <View style={[styles.progressTrackBackground, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]}>
              <Animated.View style={[styles.progressFill, { backgroundColor: accent }, progressAnimatedStyle]} />
            </View>
          </View>

          <Text
            importantForAccessibility="no"
            accessibilityElementsHidden
            style={[styles.stepCountText, { color: textSubtle }]}
          >
            {currentStep}/{TOTAL_STEPS}
          </Text>
        </View>

        {/* STEP CONTENT BODY */}
        <View style={styles.contentBody}>{renderActiveStep()}</View>

        {/* BOTTOM ACTION AREA */}
        <View style={[styles.footerContainer, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}>
          {saveError && isLastStep ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.errorBox, { backgroundColor: cardBg, borderColor: PALETTE.dangerText }]}
            >
              <Ionicons
                name={saveError === OFFLINE_MESSAGE ? 'cloud-offline-outline' : 'alert-circle-outline'}
                size={22}
                color={PALETTE.dangerText}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.errorText, { color: textColor }]}>{saveError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.nextButton,
              {
                backgroundColor: canProceed ? accent : (isDark ? 'rgba(188, 227, 170, 0.25)' : 'rgba(10, 15, 11, 0.15)'),
              },
            ]}
            disabled={!canProceed}
            activeOpacity={0.88}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={saveError && isLastStep ? 'Try again' : nextLabel}
            accessibilityState={{ disabled: !canProceed, busy: isSaving }}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <>
                <Text style={[styles.nextButtonText, { color: canProceed ? theme.onPrimary : disabledFg }]}>
                  {saveError && isLastStep ? 'Try again' : nextLabel}
                </Text>
                <Ionicons
                  name={saveError && isLastStep ? 'refresh' : 'arrow-forward'}
                  size={18}
                  color={canProceed ? theme.onPrimary : disabledFg}
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
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
    paddingVertical: 8,
    gap: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  progressTrackWrapper: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  progressTrackBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepCountText: {
    ...typography.secondary,
    minWidth: 32,
    textAlign: 'right',
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
    ...typography.caption,
    letterSpacing: 0.8,
  },
  headline: {
    ...typography.screenTitle,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheadline: {
    ...typography.body,
    textAlign: 'center',
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
    minHeight: 72,
    padding: 14,
    borderRadius: 20,
    // Fixed width in both states so selecting a card doesn't shift its content.
    borderWidth: 2,
  },
  iconBox: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  mathSymbol: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  cardText: {
    flex: 1,
    flexShrink: 1,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardDesc: {
    ...typography.body,
  },
  selectionMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  selectionMarkSquare: {
    borderRadius: 7,
  },

  /* STEP 4 GOAL PILLS */
  goalSection: {
    marginBottom: 18,
  },
  goalSectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 10,
  },
  // Pills size to their content and wrap onto a new line when large text doesn't fit.
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalPill: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 92,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalPillText: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  recommendedText: {
    ...typography.caption,
    marginTop: 2,
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
    ...typography.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  projectionBody: {
    ...typography.body,
  },

  /* STEP 5 SUMMARY */
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
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '600',
  },
  signupPitchBox: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  pitchHeading: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  pitchSubheading: {
    ...typography.secondary,
    textAlign: 'center',
  },

  /* FOOTER */
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  errorText: {
    ...typography.body,
    flex: 1,
  },
  nextButton: {
    minHeight: 60,
    paddingVertical: 12,
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
    ...typography.button,
    letterSpacing: 0.5,
  },
});
