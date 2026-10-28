import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  FadeIn,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { QuestionAttemptResult } from '../../src/lib/math/types';
import { flushWorkoutOutbox, getQueuedWorkoutCount } from '../../src/services/workoutService';
import {
  acceptLevelSuggestion,
  addOperationToPlan,
  CoachData,
  COACH_LOAD_TIMEOUT_MS,
  dismissGraduationPrompt,
  dismissLevelPrompt,
  getGraduationPromptDismissedAt,
  getLevelPromptDismissedAt,
  loadCachedCoachData,
  loadCoachData,
  saveFocusChoice,
} from '../../src/services/coachService';
import {
  buildBreakdown,
  CoachWorkout,
  comfortName,
  compareWithLast,
  COPY,
  findLastComparable,
  getResultsFeedback,
  getVerdict,
  normalizeOperation,
  operationName,
  ResultsFeedback,
  roundLength,
  sameAgainWorkout,
  toWorkoutParams,
  usualMsPerQuestion,
  workoutTitle,
  WorkoutSource,
} from '../../src/lib/coach';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { PALETTE } from '../../src/constants/palette';
import { typography, MAX_FONT_SCALE } from '../../src/constants/typography';
import { withTimeout } from '../../src/utils/withTimeout';

type IconName = keyof typeof Ionicons.glyphMap;

const TOTAL_STEPS = 2;
const CONFETTI_PIECES = 26;

/** History for one finished round. `data` is null when there is nothing to plan from (offline, nothing cached). */
type LoadedHistory = {
  key: string;
  data: CoachData | null;
  levelDismissed: string | null;
  graduationDismissed: string | null;
};

type AskedQuestions = Pick<ResultsFeedback, 'graduation' | 'focusQuestion' | 'levelSuggestion'> & { key: string };

type Celebration = { key: string; icon: IconName; text: string; confetti: boolean };

/** "1.8 seconds per question". */
function secondsPerQuestion(ms: number): string {
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} per question`;
}

function AnimatedRollingNumber({
  target,
  animate,
  duration = 750,
  style,
}: {
  target: number;
  animate: boolean;
  duration?: number;
  style?: any;
}) {
  const [displayVal, setDisplayVal] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate || isNaN(target) || target <= 0) {
      setDisplayVal(isNaN(target) ? 0 : target);
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
  }, [target, duration, animate]);

  return (
    <Text style={style} maxFontSizeMultiplier={MAX_FONT_SCALE.problem}>
      {displayVal}
    </Text>
  );
}

function IconStage({
  icon,
  haloColor,
  animate,
  size = 54,
}: {
  icon: IconName;
  haloColor: string;
  animate: boolean;
  size?: number;
}) {
  const floatAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(animate ? 0.7 : 1);

  useEffect(() => {
    if (!animate) {
      floatAnim.value = 0;
      scaleAnim.value = 1;
      return;
    }
    scaleAnim.value = withSpring(1, { damping: 11, stiffness: 120 });
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [floatAnim, scaleAnim, animate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }, { scale: scaleAnim.value }],
  }));

  return (
    <View style={styles.stageOuterWrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.haloGlow, { backgroundColor: haloColor }]} />
      <Animated.View style={[styles.floatingBadge, animatedStyle]}>
        <Ionicons name={icon} size={size} color={PALETTE.onPrimary} />
      </Animated.View>
      <View style={styles.pedestalShadow} />
    </View>
  );
}

/** A good moment: level up, mastered, goal done, perfect round. */
function CelebrationCard({
  icon,
  text,
  backgroundColor,
  textColor,
}: {
  icon: IconName;
  text: string;
  backgroundColor: string;
  textColor: string;
}) {
  return (
    <View style={[styles.celebrationCard, { backgroundColor }]} accessible accessibilityLabel={text}>
      <View style={styles.celebrationIconDisc}>
        <Ionicons name={icon} size={30} color={PALETTE.onPrimary} />
      </View>
      <Text style={[styles.celebrationText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

function ConfettiPiece({
  x,
  drift,
  fall,
  spin,
  delay,
  duration,
  size,
  color,
}: {
  x: number;
  drift: number;
  fall: number;
  spin: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
  }, [progress, delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 0.75, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: drift * progress.value },
      { translateY: -30 + fall * progress.value },
      { rotate: `${spin * progress.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[styles.confettiPiece, { left: x, width: size, height: size * 0.5, backgroundColor: color }, animatedStyle]}
    />
  );
}

/** A short, light burst from the top of the screen. Plays once. */
function ConfettiBurst({ colors }: { colors: string[] }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        fall: height * (0.4 + Math.random() * 0.25),
        spin: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360),
        delay: Math.random() * 300,
        duration: 1500 + Math.random() * 700,
        size: 7 + Math.random() * 4,
        color: colors[i % colors.length],
      })),
    [width, height, colors]
  );

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} {...piece} />
      ))}
    </View>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { session } = useAuth();
  const reduceMotion = useReducedMotion();

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');

  const { mode, difficulty, source, completedAt, results, sessionKey, savedSessionId, saveStatus } =
    useLocalSearchParams<{
      mode?: string;
      difficulty?: string;
      source?: string;
      completedAt?: string;
      results?: string;
      sessionKey?: string;
      savedSessionId?: string;
      saveStatus?: string;
    }>();

  const userId = session?.user?.id;
  // This screen stays mounted between workouts (it's a tab); everything loaded or
  // asked here is tied to this key so nothing from an earlier round shows up.
  const roundKey = `${sessionKey ?? ''}|${completedAt ?? ''}`;

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [showMistakesModal, setShowMistakesModal] = useState(false);
  // The plan and earlier workouts (without this one), for the coach's feedback.
  const [loaded, setLoaded] = useState<LoadedHistory | null>(null);
  // The question asked on this screen, fixed when it first shows, so answering one
  // (which changes the plan) never brings up another one here.
  const [askedState, setAskedState] = useState<AskedQuestions | null>(null);
  const [graduationAnswer, setGraduationAnswer] = useState<'yes' | 'no' | null>(null);
  const [focusAnswer, setFocusAnswer] = useState<'yes' | 'no' | null>(null);
  const [levelAnswer, setLevelAnswer] = useState<'yes' | 'no' | null>(null);
  const [isSaveQueued, setIsSaveQueued] = useState(saveStatus === 'queued');
  const [isRetryingSync, setIsRetryingSync] = useState(false);

  const stepOpacity = useSharedValue(1);
  const stepTranslateX = useSharedValue(0);
  const isAnimatingRef = useRef(false);
  // Bumped by every load and every new round, so a slow, older load can't overwrite a newer one.
  const loadIdRef = useRef(0);
  const celebratedRef = useRef(new Set<string>());

  const history = loaded?.key === roundKey ? loaded : null;
  const coachData = history?.data ?? null;
  const historyStatus: 'loading' | 'ready' | 'limited' = !history ? 'loading' : coachData ? 'ready' : 'limited';
  const asked = askedState?.key === roundKey ? askedState : null;

  useEffect(() => {
    setCurrentStep(1);
    isAnimatingRef.current = false;
    setShowMistakesModal(false);
    setGraduationAnswer(null);
    setFocusAnswer(null);
    setLevelAnswer(null);
    stepOpacity.value = 1;
    stepTranslateX.value = 0;
  }, [roundKey, stepOpacity, stepTranslateX]);

  useEffect(() => {
    setIsSaveQueued(saveStatus === 'queued');
  }, [roundKey, saveStatus]);

  const attempts: QuestionAttemptResult[] = useMemo(() => {
    if (!results) return [];
    try {
      const decoded = results.startsWith('%') ? decodeURIComponent(results) : results;
      const parsed = JSON.parse(decoded);
      if (!Array.isArray(parsed)) return [];

      // Missing timing stays 0: speed then shows "—" instead of a made-up number.
      return parsed.map((item: any) => ({
        ...item,
        timeTakenMs: Number(item.timeTakenMs ?? item.timeSpentMs) || 0,
      }));
    } catch {
      return [];
    }
  }, [results]);

  const totalQuestions = attempts.length;
  const missedAttempts = attempts.filter((a) => !a.isCorrect);
  const correctCount = totalQuestions - missedAttempts.length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const isPerfect = totalQuestions > 0 && missedAttempts.length === 0;
  const hasTiming = totalQuestions > 0 && attempts.every((a) => a.timeTakenMs > 0);
  const totalTimeSpentMs = hasTiming ? attempts.reduce((acc, item) => acc + item.timeTakenMs, 0) : 0;
  const msPerQuestion = hasTiming ? totalTimeSpentMs / totalQuestions : null;
  const speedText = msPerQuestion !== null ? secondsPerQuestion(msPerQuestion) : '— seconds per question';

  // This workout as the coach sees it.
  const currentWorkout = useMemo((): CoachWorkout => ({
    operation: normalizeOperation(mode),
    difficulty: difficulty || 'easy',
    total_questions: totalQuestions,
    correct_answers: correctCount,
    total_time: totalTimeSpentMs,
    completed_at: completedAt || new Date().toISOString(),
    source: (['warmup', 'coach', 'manual'] as WorkoutSource[]).includes(source as WorkoutSource)
      ? (source as WorkoutSource)
      : 'manual',
    breakdown: buildBreakdown(attempts),
  }), [mode, difficulty, totalQuestions, correctCount, totalTimeSpentMs, completedAt, source, attempts]);

  // Same coach as Home: what we learned, level changes, questions, and what's next.
  const feedback = useMemo(() => {
    if (!coachData || !history) return null;
    return getResultsFeedback({
      plan: coachData.plan,
      history: coachData.workouts,
      current: currentWorkout,
      levelPromptDismissedAt: history.levelDismissed,
      graduationPromptDismissedAt: history.graduationDismissed,
    });
  }, [coachData, history, currentWorkout]);

  // Against the last round of the same operation and level, and the user's own usual pace.
  const comparison = useMemo(
    () => (coachData ? compareWithLast(currentWorkout, findLastComparable(coachData.workouts, currentWorkout)) : null),
    [coachData, currentWorkout]
  );
  const usualMs = useMemo(
    () => (coachData ? usualMsPerQuestion(coachData.workouts, currentWorkout) : null),
    [coachData, currentWorkout]
  );
  const verdict = getVerdict(accuracy, msPerQuestion, usualMs);

  useEffect(() => {
    if (feedback && !asked) {
      const { graduation, focusQuestion, levelSuggestion } = feedback;
      setAskedState({ key: roundKey, graduation, focusQuestion, levelSuggestion });
    }
  }, [feedback, asked, roundKey]);

  // Read-only: workout.tsx has already saved (or queued) this session. Anything
  // fetched must exclude it so we never count a session twice. Never throws.
  const loadHistory = useCallback(async (): Promise<Omit<LoadedHistory, 'key'>> => {
    const empty = { data: null, levelDismissed: null, graduationDismissed: null };
    if (!userId) return empty;
    const finishedAt = completedAt ? new Date(completedAt).getTime() : NaN;
    const isCurrent = (w: CoachWorkout) =>
      (savedSessionId && w.id === savedSessionId) || new Date(w.completed_at).getTime() === finishedAt;

    let data: CoachData | null = null;
    try {
      data = await withTimeout(loadCoachData(userId), COACH_LOAD_TIMEOUT_MS);
    } catch {
      // Offline: the copy saved on this phone plus anything queued here.
      try {
        data = await loadCachedCoachData(userId);
      } catch {
        data = null;
      }
    }

    let levelDismissed: string | null = null;
    let graduationDismissed: string | null = null;
    try {
      [levelDismissed, graduationDismissed] = await Promise.all([
        getLevelPromptDismissedAt(userId),
        getGraduationPromptDismissedAt(userId),
      ]);
    } catch {
      // Treated as never dismissed.
    }

    return {
      data: data ? { plan: data.plan, workouts: data.workouts.filter((w) => !isCurrent(w)) } : null,
      levelDismissed,
      graduationDismissed,
    };
  }, [userId, savedSessionId, completedAt]);

  const refreshHistory = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    let result: Omit<LoadedHistory, 'key'>;
    try {
      result = await loadHistory();
    } catch {
      result = { data: null, levelDismissed: null, graduationDismissed: null };
    }
    if (loadId !== loadIdRef.current) return;
    // Set together, so the first feedback already knows about earlier "Not now" answers.
    setLoaded({ key: roundKey, ...result });
  }, [loadHistory, roundKey]);

  useEffect(() => {
    if (attempts.length === 0) {
      loadIdRef.current += 1;
      setLoaded({ key: roundKey, data: null, levelDismissed: null, graduationDismissed: null });
      return;
    }
    refreshHistory();
    return () => {
      loadIdRef.current += 1;
    };
  }, [attempts, roundKey, refreshHistory]);

  const handleRetrySync = async () => {
    if (!userId || isRetryingSync) return;
    setIsRetryingSync(true);
    try {
      await flushWorkoutOutbox(userId);
      const remaining = await getQueuedWorkoutCount(userId);
      if (remaining === 0) {
        setIsSaveQueued(false);
        await refreshHistory();
      }
    } catch (e) {
      console.warn('Retry sync failed:', e);
    } finally {
      setIsRetryingSync(false);
    }
  };

  // Biggest first: mastered everything, mastered one, goal done, level up.
  const celebrations = useMemo((): Celebration[] => {
    if (!feedback) return [];
    const list: Celebration[] = [];
    if (feedback.allMastered) {
      list.push({ key: 'all', icon: 'trophy', text: feedback.allMastered, confetti: true });
    } else {
      for (const op of feedback.newlyMastered) {
        list.push({ key: `mastered-${op}`, icon: 'ribbon', text: COPY.mastered(op), confetti: true });
      }
    }
    if (feedback.goalJustDone) {
      list.push({ key: 'goal', icon: 'checkmark-done', text: COPY.goalDoneHeading, confetti: true });
    }
    for (const change of feedback.levelChanges) {
      if (change.direction === 'up') {
        list.push({ key: `up-${change.operation}`, icon: 'trending-up', text: change.text, confetti: false });
      }
    }
    return list;
  }, [feedback]);

  // Calm lines: what we learned and levels going down.
  const coachLines = feedback
    ? [feedback.learned, ...feedback.levelChanges.filter((c) => c.direction === 'down').map((c) => c.text)].filter(
        (line): line is string => Boolean(line)
      )
    : [];

  const hasCelebration = currentStep === 1 ? isPerfect : celebrations.length > 0;
  const showConfetti = currentStep === 2 && !reduceMotion && celebrations.some((c) => c.confetti);

  // One success haptic per screen with a celebration.
  useEffect(() => {
    if (!hasCelebration) return;
    const key = `${roundKey}:${currentStep}`;
    if (celebratedRef.current.has(key)) return;
    celebratedRef.current.add(key);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [hasCelebration, roundKey, currentStep]);

  // With no history to plan from, offer the same round again, never a warm-up.
  const nextWorkout = useMemo(
    () => feedback?.next.workout ?? (historyStatus === 'limited' ? sameAgainWorkout(currentWorkout) : null),
    [feedback, historyStatus, currentWorkout]
  );

  const finishStepAnimation = () => {
    isAnimatingRef.current = false;
  };

  const handleNextStep = () => {
    setCurrentStep(2);
    stepTranslateX.value = reduceMotion ? 0 : 24;
    stepOpacity.value = withTiming(1, { duration: 220 }, () => {
      runOnJS(finishStepAnimation)();
    });
    stepTranslateX.value = withSpring(0, { damping: 14 });
  };

  const advanceStep = () => {
    // Ignore taps while a transition is running (double-tap on "Continue").
    if (isAnimatingRef.current || currentStep >= TOTAL_STEPS) return;
    isAnimatingRef.current = true;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    stepOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(handleNextStep)();
    });
  };

  const handleStartNextWorkout = () => {
    if (!nextWorkout) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const targetPayload = {
      ...toWorkoutParams(nextWorkout),
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

  const updatePlan = (change: (plan: CoachData['plan']) => CoachData['plan']) => {
    setLoaded((prev) => (prev?.data ? { ...prev, data: { ...prev.data, plan: change(prev.data.plan) } } : prev));
  };

  // "Want to add × Multiplying to your plan?"
  const handleGraduationAnswer = async (yes: boolean) => {
    if (!asked?.graduation || !userId || !coachData) return;
    setGraduationAnswer(yes ? 'yes' : 'no');
    if (!yes) {
      await dismissGraduationPrompt(userId);
      return;
    }
    try {
      const frictionAreas = await addOperationToPlan(userId, coachData.plan, asked.graduation.operation);
      updatePlan((plan) => ({ ...plan, frictionAreas }));
    } catch (e) {
      console.warn('Failed to add operation to plan:', e);
      setGraduationAnswer(null);
    }
  };

  // "Want to focus on ÷ Dividing?"
  const handleFocusAnswer = async (yes: boolean) => {
    if (!asked?.focusQuestion || !userId || !coachData) return;
    setFocusAnswer(yes ? 'yes' : 'no');
    if (!yes) return; // Not now: stay on mixed practice; we ask again in a few workouts.
    const operation = asked.focusQuestion.operation;
    try {
      await saveFocusChoice(userId, operation);
      updatePlan((plan) => ({ ...plan, frictionAreas: [operation] }));
    } catch (e) {
      console.warn('Failed to save focus choice:', e);
      setFocusAnswer(null);
    }
  };

  // "Want to change your level to Confident?"
  const handleLevelAnswer = async (yes: boolean) => {
    if (!asked?.levelSuggestion || !userId || !coachData) return;
    setLevelAnswer(yes ? 'yes' : 'no');
    if (!yes) {
      await dismissLevelPrompt(userId);
      return;
    }
    const level = asked.levelSuggestion.level;
    try {
      await acceptLevelSuggestion(userId, level);
      updatePlan((plan) => ({ ...plan, comfortLevel: level, levelSetAt: new Date().toISOString() }));
    } catch (e) {
      console.warn('Failed to save level:', e);
      setLevelAnswer(null);
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
  const subtextColor = theme.subtext;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const fillColor = isDark ? PALETTE.fillDark : PALETTE.fillLight;
  const accentSoft = isDark ? PALETTE.primarySoftDark : PALETTE.primarySoftLight;
  // Green for "better" text; sage itself is too faint on light backgrounds.
  const betterColor = isDark ? PALETTE.primary : PALETTE.primaryDeep;
  const confettiColors = useMemo(
    () => (isDark ? [PALETTE.primary, PALETTE.primarySoftLight] : [PALETTE.primary, PALETTE.primaryDeep]),
    [isDark]
  );

  const renderQuestion = (
    text: string,
    onAnswer: (yes: boolean) => void,
    yesLabel: string,
    noLabel: string,
    context?: string | null
  ) => (
    <View style={[styles.questionCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
      {context ? <Text style={[styles.recDesc, { color: subtextColor, marginBottom: 6 }]}>{context}</Text> : null}
      <Text style={[styles.recTitle, { color: textColor }]}>{text}</Text>
      <View style={styles.questionButtons}>
        <TouchableOpacity
          style={[styles.questionYes, { backgroundColor: PALETTE.primary }]}
          onPress={() => onAnswer(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={yesLabel}
        >
          <Text style={styles.questionYesText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.questionNo}
          onPress={() => onAnswer(false)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={noLabel}
        >
          <Text style={[styles.questionNoText, { color: subtextColor }]}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const primaryLabel = currentStep === 1
    ? 'Continue'
    : feedback?.next.goalDoneToday
    ? COPY.bonusButton
    : 'Start next workout';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* TOP PROGRESS + CLOSE */}
      <View style={styles.topTimelineWrapper}>
        <View style={styles.topTimelineRow}>
          <View
            style={styles.timelineSegmentsRow}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${currentStep} of ${TOTAL_STEPS}`}
            accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: currentStep }}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
              <View
                key={step}
                style={[styles.timelineSegment, { backgroundColor: step <= currentStep ? PALETTE.primary : fillColor }]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.closeIconBtn, { backgroundColor: cardBg }]}
            onPress={handleGoHome}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* BODY */}
      <Animated.View style={[styles.contentWrapper, stepAnimatedStyle]}>
        <ScrollView
          key={currentStep}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* SCREEN 1: YOUR RESULT */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <IconStage icon="sparkles" haloColor={accentSoft} animate={!reduceMotion} size={52} />

              <Text style={[styles.stepHeadline, { color: textColor }]} maxFontSizeMultiplier={MAX_FONT_SCALE.screenTitle}>
                Your result
              </Text>

              <View
                style={styles.scoreRow}
                accessible
                accessibilityLabel={`${correctCount} out of ${totalQuestions} correct`}
              >
                <AnimatedRollingNumber
                  key={roundKey}
                  target={correctCount}
                  animate={!reduceMotion}
                  style={[styles.massiveScoreText, { color: textColor }]}
                />
                <Text
                  style={[styles.massiveScoreDivider, { color: subtextColor }]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE.display}
                >
                  /{totalQuestions}
                </Text>
              </View>

              <Text
                style={[styles.metricSubtitle, { color: textColor }]}
                accessibilityLabel={`${accuracy}% accuracy, ${msPerQuestion !== null ? speedText : 'speed not recorded'}`}
              >
                {accuracy}% accuracy · {speedText}
              </Text>

              {historyStatus !== 'loading' && (
                <Animated.View entering={FadeIn.duration(250)} style={styles.fullWidth}>
                  <View style={[styles.interpretationCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                    <Text style={[styles.interpretationTitle, { color: textColor }]}>{verdict.title}</Text>
                    <Text style={[styles.interpretationDesc, { color: subtextColor }]}>{verdict.desc}</Text>
                  </View>

                  {comparison && (
                    <Text
                      style={[
                        styles.comparisonText,
                        { color: comparison.tone === 'better' ? betterColor : subtextColor },
                      ]}
                    >
                      {comparison.text}
                    </Text>
                  )}
                </Animated.View>
              )}

              {isPerfect ? (
                <View style={styles.celebrationSpacing}>
                  <CelebrationCard
                    icon="star"
                    text="Perfect round · 100% correct"
                    backgroundColor={accentSoft}
                    textColor={textColor}
                  />
                </View>
              ) : missedAttempts.length > 0 ? (
                <TouchableOpacity
                  style={[styles.mistakeReviewPill, { backgroundColor: fillColor }]}
                  activeOpacity={0.8}
                  onPress={() => setShowMistakesModal(true)}
                  accessibilityRole="button"
                >
                  <Ionicons name="eye-outline" size={18} color={subtextColor} />
                  <Text style={[styles.mistakeReviewPillText, { color: textColor }]}>
                    Review {missedAttempts.length} {missedAttempts.length === 1 ? 'question' : 'questions'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={subtextColor} />
                </TouchableOpacity>
              ) : null}

              {isSaveQueued && (
                <View style={[styles.syncNotice, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                  <Ionicons name="cloud-offline-outline" size={18} color={subtextColor} />
                  <Text style={[styles.syncNoticeText, { color: subtextColor }]}>
                    Saved on this device. It will sync when you're back online.
                  </Text>
                  <TouchableOpacity
                    style={styles.syncNoticeActionBtn}
                    onPress={handleRetrySync}
                    disabled={isRetryingSync}
                    accessibilityRole="button"
                    accessibilityLabel="Retry sync"
                  >
                    <Text style={[styles.syncNoticeAction, { color: textColor }]}>
                      {isRetryingSync ? 'Retrying…' : 'Retry'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* SCREEN 2: WHAT'S NEXT */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <IconStage icon="compass-outline" haloColor={accentSoft} animate={!reduceMotion} size={56} />

              <Text style={[styles.stepHeadline, { color: textColor }]} maxFontSizeMultiplier={MAX_FONT_SCALE.screenTitle}>
                What's next
              </Text>

              {historyStatus === 'loading' && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={subtextColor} />
                  <Text style={[styles.stepSubtitle, { color: subtextColor, marginBottom: 0 }]}>
                    Loading your next step…
                  </Text>
                </View>
              )}

              {feedback && (
                <>
                  <Text style={[styles.stepSubtitle, { color: subtextColor }]}>{feedback.subtitle}</Text>

                  {celebrations.map((c) => (
                    <View key={c.key} style={[styles.fullWidth, styles.celebrationGap]}>
                      <CelebrationCard icon={c.icon} text={c.text} backgroundColor={accentSoft} textColor={textColor} />
                    </View>
                  ))}

                  {coachLines.map((line) => (
                    <Text key={line} style={[styles.coachLine, { color: textColor }]}>
                      {line}
                    </Text>
                  ))}

                  {asked?.graduation &&
                    graduationAnswer === null &&
                    renderQuestion(
                      asked.graduation.text,
                      handleGraduationAnswer,
                      `Yes, add ${operationName(asked.graduation.operation)} to my plan`,
                      `Not now, don't add ${operationName(asked.graduation.operation)}`,
                      feedback.newlyMastered.includes(asked.graduation.mastered)
                        ? null
                        : COPY.masteredBefore(asked.graduation.mastered)
                    )}

                  {asked?.focusQuestion &&
                    focusAnswer === null &&
                    renderQuestion(
                      asked.focusQuestion.text,
                      handleFocusAnswer,
                      `Yes, focus on ${operationName(asked.focusQuestion.operation)}`,
                      'Not now, keep mixing'
                    )}

                  {asked?.levelSuggestion &&
                    levelAnswer === null &&
                    renderQuestion(
                      asked.levelSuggestion.text,
                      handleLevelAnswer,
                      `Yes, change my level to ${comfortName(asked.levelSuggestion.level)}`,
                      'Not now, keep my level'
                    )}
                </>
              )}

              {historyStatus === 'limited' && (
                <Text style={[styles.stepSubtitle, { color: subtextColor }]}>
                  You're offline, so here's the same round again. Your plan updates when you're back online.
                </Text>
              )}

              {nextWorkout && (
                <View style={[styles.recommendationCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                  <Text style={[styles.recDesc, { color: subtextColor }]}>Next up</Text>
                  <Text style={[styles.recTitle, { color: textColor }]}>
                    {feedback ? workoutTitle(nextWorkout, nextWorkout.questionCount) : 'Same again'}
                  </Text>
                  {!feedback && (
                    <Text style={[styles.recDesc, { color: subtextColor }]}>
                      {workoutTitle(nextWorkout, nextWorkout.questionCount)}
                    </Text>
                  )}
                  <Text style={[styles.recDesc, { color: subtextColor }]}>
                    {roundLength(nextWorkout.questionCount, coachData?.plan.sessionDurationMinutes)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* BOTTOM ACTIONS */}
      <View style={[styles.dockContainer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.doubleActionWrap}>
          {(currentStep === 1 || historyStatus === 'loading' || nextWorkout) && (
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                { backgroundColor: PALETTE.primary },
                currentStep === 2 && !nextWorkout && styles.disabledBtn,
              ]}
              activeOpacity={0.85}
              onPress={currentStep === 1 ? advanceStep : handleStartNextWorkout}
              disabled={currentStep === 2 && !nextWorkout}
              accessibilityRole="button"
              accessibilityState={{ disabled: currentStep === 2 && !nextWorkout }}
            >
              <Text style={styles.primaryActionBtnText}>{primaryLabel}</Text>
              <Ionicons name="arrow-forward" size={18} color={PALETTE.onPrimary} />
            </TouchableOpacity>
          )}

          {currentStep === 2 && (
            <TouchableOpacity
              style={styles.ghostActionBtn}
              activeOpacity={0.7}
              onPress={handleGoHome}
              accessibilityRole="button"
            >
              <Text style={[styles.ghostActionBtnText, { color: subtextColor }]}>
                {feedback?.next.goalDoneToday ? 'Done for today' : 'Back to home'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showConfetti && <ConfettiBurst key={roundKey} colors={confettiColors} />}

      {/* QUESTIONS TO REVIEW */}
      <Modal
        visible={showMistakesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMistakesModal(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: PALETTE.scrim }]}>
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setShowMistakesModal(false)}
            accessible={false}
          />

          <View style={[styles.modalSheet, { backgroundColor: cardBg, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
            <View style={[styles.modalHandle, { backgroundColor: subtextColor }]} />

            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textColor }]} accessibilityRole="header">
                Questions to review
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowMistakesModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close-circle" size={28} color={subtextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              {missedAttempts.map((item, index) => {
                const said = item.userAnswer === undefined || item.userAnswer === null || `${item.userAnswer}` === ''
                  ? '—'
                  : `${item.userAnswer}`;
                return (
                  <View
                    key={item.question?.id || `missed-${index}`}
                    style={[styles.missedItemCard, { backgroundColor: fillColor }]}
                    accessible
                    accessibilityLabel={`${item.question?.equation || 'Problem'}. You said ${said}. Answer ${item.question?.answer}.`}
                  >
                    <Text style={[styles.missedEquationText, { color: textColor }]}>
                      {item.question?.equation || 'Problem'}
                    </Text>
                    <Text style={[styles.missedAnswerText, { color: subtextColor }]}>
                      You said <Text style={styles.strikeText}>{said}</Text>
                    </Text>
                    <Text style={[styles.missedAnswerText, { color: betterColor }]}>
                      Answer <Text style={styles.boldText}>{item.question?.answer}</Text>
                    </Text>
                  </View>
                );
              })}
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
  fullWidth: {
    width: '100%',
  },
  topTimelineWrapper: {
    paddingHorizontal: 20,
    paddingTop: 4,
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
  closeIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.dark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
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
    backgroundColor: PALETTE.primary,
    shadowColor: PALETTE.dark,
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
    backgroundColor: PALETTE.dark,
    opacity: 0.12,
    transform: [{ scaleY: 0.4 }],
  },
  stepHeadline: {
    ...typography.screenTitle,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  stepSubtitle: {
    ...typography.secondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 18,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  massiveScoreText: {
    ...typography.problem,
    letterSpacing: -1,
  },
  massiveScoreDivider: {
    ...typography.display,
    marginLeft: 2,
  },
  metricSubtitle: {
    ...typography.button,
    textAlign: 'center',
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
    ...typography.button,
    textAlign: 'center',
    marginBottom: 4,
  },
  interpretationDesc: {
    ...typography.secondary,
    textAlign: 'center',
  },
  comparisonText: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  celebrationSpacing: {
    width: '100%',
    marginTop: 14,
  },
  celebrationGap: {
    marginBottom: 12,
  },
  celebrationCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
  },
  celebrationIconDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.primary,
  },
  celebrationText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
  mistakeReviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginTop: 14,
  },
  mistakeReviewPillText: {
    ...typography.secondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  syncNotice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  syncNoticeText: {
    ...typography.secondary,
    flex: 1,
    paddingVertical: 4,
  },
  syncNoticeActionBtn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncNoticeAction: {
    ...typography.secondary,
    fontWeight: '600',
  },
  coachLine: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  questionCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    alignItems: 'center',
  },
  questionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
  },
  questionYes: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionYesText: {
    ...typography.button,
    color: PALETTE.onPrimary,
  },
  questionNo: {
    minWidth: 96,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNoText: {
    ...typography.button,
  },
  recommendationCard: {
    width: '100%',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
  },
  recTitle: {
    ...typography.sectionHeading,
    marginBottom: 6,
    textAlign: 'center',
  },
  recDesc: {
    ...typography.secondary,
    textAlign: 'center',
  },
  dockContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  primaryActionBtn: {
    width: '100%',
    minHeight: 58,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: PALETTE.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  primaryActionBtnText: {
    ...typography.button,
    color: PALETTE.onPrimary,
    letterSpacing: 0.6,
    flexShrink: 1,
    textAlign: 'center',
  },
  doubleActionWrap: {
    width: '100%',
    gap: 8,
  },
  ghostActionBtn: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostActionBtnText: {
    ...typography.button,
  },
  modalBackdrop: {
    flex: 1,
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
    maxHeight: '75%',
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    ...typography.sectionHeading,
    flexShrink: 1,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  modalScrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  missedItemCard: {
    padding: 16,
    borderRadius: 16,
    gap: 4,
  },
  missedEquationText: {
    ...typography.sectionHeading,
    marginBottom: 4,
  },
  missedAnswerText: {
    ...typography.body,
  },
  strikeText: {
    textDecorationLine: 'line-through',
  },
  boldText: {
    fontWeight: '700',
  },
});
