import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { getUserProfile } from '../../src/services/settingsService';
import { CoachData, LoadedCoachData, loadCoachDataWithFallback } from '../../src/services/coachService';
import {
  activityBuckets,
  CoachOperation,
  COPY,
  dailyGoalOf,
  estimateMinutes,
  getCoachPlan,
  LEVEL_NAMES,
  roundLength,
  toWorkoutParams,
  workoutForOperation,
} from '../../src/lib/coach';
import { useTheme } from '@/src/context/ThemeContext';
import { FONT_FAMILY, MAX_FONT_SCALE, typography } from '@/src/constants/typography';
import { OfflineNote } from '../../src/components/OfflineNote';
import { HeroCard } from '../../src/components/home/HeroCard';
import { HOME_COLORS } from '../../src/components/home/homeColors';
import { PickCard } from '../../src/components/home/PickCard';
import { Rise } from '../../src/components/home/Rise';
import { StreakCard, WeekDay } from '../../src/components/home/StreakCard';
import { useOnlineStatus } from '../../src/hooks/useOnlineStatus';
import { useResponsiveContentWidth } from '../../src/hooks/useResponsiveContentWidth';
import { useResponsiveTopPadding } from '../../src/hooks/useResponsiveTopPadding';
import { getInitials } from '../../src/utils/getInitials';
import { haptics } from '../../src/utils/haptics';
import { countDayStreak, localDayKey } from '../../src/utils/localDates';

type OperationType = CoachOperation;

const EMPTY_COACH_DATA: CoachData = { plan: {}, workouts: [] };

const MAX_CONTENT_WIDTH = 480;

// The picks row, in this order, minus today's focus.
const ALL_OPS: OperationType[] = ['addition', 'subtraction', 'multiplication', 'division', 'mixed'];

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();

  const isNarrow = width < 360;
  const gutter = isNarrow ? 16 : 20;
  // 480 on a phone, wider on a tablet.
  const contentWidth = useResponsiveContentWidth(MAX_CONTENT_WIDTH);
  // Under the safe area; more on a tablet.
  const topPadding = useResponsiveTopPadding(Math.max(insets.top > 0 ? 6 : 14, 10));

  const isInitialMount = useRef(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Reload when the connection comes back (loadDashboardState is defined below; called later).
  const { isOffline, recheck } = useOnlineStatus(() => loadDashboardState());
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string }>({});
  const [loaded, setLoaded] = useState<LoadedCoachData | null>(null);
  // Only the newest load may update the screen.
  const loadIdRef = useRef(0);

  // A tapped pick card is a one-time choice; the coach's plan returns afterwards.
  const [selectedOverrideOp, setSelectedOverrideOp] = useState<OperationType | null>(null);

  // Skeleton pulse animation
  const skeletonPulse = useSharedValue(0.4);

  useEffect(() => {
    skeletonPulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [skeletonPulse]);

  // Same as Practice: live data, else the cached copy plus queued workouts, else the
  // plan saved on this phone. Offline never replaces the screen; a small note says so.
  const loadDashboardState = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const loadId = ++loadIdRef.current;
    const online = await recheck();

    // The name and photo are extras; the screen works without them.
    if (online) {
      getUserProfile(userId)
        .then((profileData) => {
          if (profileData) setProfile(profileData);
        })
        .catch(() => {});
    }

    // Also pushes any workouts that failed to save offline.
    const next = await loadCoachDataWithFallback(userId, online);
    if (loadId !== loadIdRef.current) return;
    setLoaded(next);

    // The sections stagger in (see Rise) when they first mount.
    if (isInitialMount.current) {
      setIsLoading(false);
      isInitialMount.current = false;
    }
  }, [session?.user?.id, recheck]);

  useFocusEffect(
    useCallback(() => {
      // Coming back from a workout: drop the one-time pick and follow the plan again.
      setSelectedOverrideOp(null);
      loadDashboardState();
    }, [loadDashboardState])
  );

  const skeletonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skeletonPulse.value,
  }));

  const isDark = theme.isDark;
  const screenBg = isDark ? '#0A0F0B' : theme.background || HOME_COLORS.background;
  const textColor = theme.text;
  const textSubtle = isDark ? theme.subtext : HOME_COLORS.textSecondary;
  const textMuted = isDark ? theme.subtext : HOME_COLORS.textMuted;
  const cardBg = theme.card;

  const skeletonBoneColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 15, 11, 0.07)';
  const bottomBarPadding = Math.max(insets.bottom, 16) + 85;

  const displayName =
    profile.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Champion';
  const firstName = displayName.trim().split(/\s+/)[0];

  const avatarUrl =
    profile.avatar_url ||
    session?.user?.user_metadata?.avatar_url ||
    null;

  const coachData = loaded?.data ?? EMPTY_COACH_DATA;

  // Today's plan from the shared coach (the same one Results, Practice and Statistics use).
  // Without history (offline, nothing cached) there is no pick: "Pick something to practice".
  const coach = useMemo(
    () =>
      getCoachPlan(coachData.plan, coachData.workouts, new Date(), {
        historyUnknown: loaded?.from === 'phone',
      }),
    [coachData, loaded?.from]
  );

  const pickedRequest = useMemo(
    () => (selectedOverrideOp ? workoutForOperation(coach, coachData.plan, selectedOverrideOp) : null),
    [coach, coachData.plan, selectedOverrideOp]
  );

  const focusOp: OperationType = selectedOverrideOp ?? coach.focus;

  const { headingText, subheadingText, buttonText } = useMemo(() => {
    if (selectedOverrideOp && pickedRequest) {
      const length = roundLength(pickedRequest.questionCount, coachData.plan.sessionDurationMinutes);
      return {
        headingText: COPY.pickHeading(selectedOverrideOp),
        subheadingText: coach.historyUnknown
          ? COPY.practiceOnlyPickSubheading(length)
          : coach.isFirstWorkout
            ? COPY.pickWarmupSubheading(length)
            : COPY.pickSubheading(length),
        buttonText: coach.isFirstWorkout ? COPY.warmupButton : COPY.startButton,
      };
    }
    return {
      // Home shows "You're getting faster" in the pill, so the heading names today's focus.
      headingText: coach.message.kind === 'improving' ? COPY.dailyHeading(coach.focus) : coach.message.heading,
      subheadingText: coach.message.subheading,
      buttonText: coach.message.button,
    };
  }, [coach, coachData.plan.sessionDurationMinutes, pickedRequest, selectedOverrideOp]);

  // Streak card: the same local-day helpers Statistics uses.
  const { streak, week } = useMemo(() => {
    const now = new Date();
    const times = coachData.workouts.map((w) => w.completed_at);
    const practiced = new Set(times.filter(Boolean).map((t) => localDayKey(t)));
    const days: WeekDay[] = activityBuckets('week', now).map((day) => ({
      letter: day.label,
      name: day.name,
      practiced: practiced.has(localDayKey(new Date(day.start))),
      isToday: day.isCurrent,
    }));
    return { streak: countDayStreak(times, now), week: days };
  }, [coachData.workouts]);
  const dailyGoal = dailyGoalOf(coachData.plan);

  const goalDone = coach.message.kind === 'goal_done' && !selectedOverrideOp;
  const improving = coach.message.kind === 'improving' && !selectedOverrideOp;
  const chipText = goalDone ? COPY.goalDoneChip : improving ? COPY.improvingChip : coach.goalLine;

  const request = pickedRequest ?? coach.workout;
  const heroChips = [
    focusOp === 'mixed' ? COPY.mixedLevelsTag : LEVEL_NAMES[request.difficultyByOperation[focusOp] ?? coach.levels[focusOp]],
    COPY.heroQuestions(request.questionCount),
    COPY.heroMinutes(estimateMinutes(request.questionCount, coachData.plan.sessionDurationMinutes)),
  ];

  const pickTag = (op: OperationType) =>
    op === 'mixed'
      ? COPY.mixedLevelsTag
      : coach.mastered.includes(op)
        ? COPY.masteredTag
        : LEVEL_NAMES[coach.levels[op]];

  const handleStartWorkout = () => {
    router.push({
      pathname: '/workout' as any,
      params: {
        ...toWorkoutParams(request),
        reset: 'true',
        sessionKey: Date.now().toString(),
      },
    });
  };

  const handleHeroPress = () => {
    haptics.light();
    handleStartWorkout();
  };

  // The four operations that aren't today's focus.
  const outerOps = ALL_OPS.filter((op) => op !== focusOp);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Greeting header */}
      <View
        style={[
          styles.headerRow,
          {
            maxWidth: contentWidth,
            paddingHorizontal: gutter,
            paddingTop: topPadding,
          },
        ]}
      >
        {isLoading ? (
          <Animated.View style={[styles.greeting, skeletonAnimatedStyle]}>
            <View style={[styles.skeletonGreetingSmall, { backgroundColor: skeletonBoneColor }]} />
            <View style={[styles.skeletonGreetingName, { backgroundColor: skeletonBoneColor }]} />
          </Animated.View>
        ) : (
          <Rise index={0} style={styles.greeting}>
            <Text style={[styles.greetingLine, { color: textSubtle }]}>
              {COPY.greeting(new Date().getHours())}
            </Text>
            <Text
              style={[styles.greetingName, { color: textColor }]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE.screenTitle}
            >
              {firstName}
            </Text>
          </Rise>
        )}

        <TouchableOpacity
          style={[styles.avatarButton, { backgroundColor: cardBg }]}
          activeOpacity={0.8}
          onPress={() => router.push('/(app)/Profile')}
          accessibilityRole="button"
          accessibilityLabel={COPY.openProfile}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarInner, { backgroundColor: HOME_COLORS.green }]}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Animated.View
          style={[
            styles.mainContainer,
            styles.skeletonContainer,
            { maxWidth: contentWidth, paddingHorizontal: gutter, paddingBottom: bottomBarPadding },
            skeletonAnimatedStyle,
          ]}
        >
          <View style={[styles.skeletonStreak, { backgroundColor: skeletonBoneColor }]} />
          <View>
            <View style={[styles.skeletonChip, { backgroundColor: skeletonBoneColor }]} />
            <View style={[styles.skeletonHeading, { backgroundColor: skeletonBoneColor }]} />
            <View style={[styles.skeletonSubheading, { backgroundColor: skeletonBoneColor }]} />
          </View>
          <View style={[styles.skeletonHero, { backgroundColor: skeletonBoneColor }]} />
          <View style={styles.picksRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.skeletonPick, { backgroundColor: skeletonBoneColor }]} />
            ))}
          </View>
        </Animated.View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.mainContainer,
            { maxWidth: contentWidth, paddingHorizontal: gutter, paddingBottom: bottomBarPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loaded && (
            <OfflineNote
              from={loaded.from}
              isOffline={isOffline}
              pendingSync={loaded.data.pendingSync}
            />
          )}

          <Rise index={1}>
            <StreakCard
              streak={streak}
              questionsToday={coach.questionsToday}
              dailyGoal={dailyGoal}
              week={week}
              isDark={isDark}
              cardColor={cardBg}
              textColor={textColor}
              subtleColor={textMuted}
            />
          </Rise>

          {/* Coach chip + heading */}
          <Rise index={2}>
            {chipText && (
              <View style={styles.chip}>
                <Ionicons
                  name={goalDone ? 'checkmark-circle' : 'flash'}
                  size={13}
                  color={HOME_COLORS.ink}
                />
                <Text style={styles.chipText}>{chipText}</Text>
              </View>
            )}
            <Text
              style={[styles.heading, { color: textColor }]}
              maxFontSizeMultiplier={MAX_FONT_SCALE.display}
            >
              {headingText}
            </Text>
            <Text style={[styles.subheading, { color: textSubtle }]}>{subheadingText}</Text>
          </Rise>

          {/* The card is the start button */}
          <Rise index={3} style={styles.heroWrap}>
            <HeroCard
              operation={focusOp}
              chips={heroChips}
              progress={goalDone ? 1 : coach.questionsToday / dailyGoal}
              accent={goalDone ? HOME_COLORS.lilac : HOME_COLORS.green}
              buttonText={buttonText}
              accessibilityLabel={COPY.heroLabel(buttonText, focusOp, request.questionCount)}
              goalDone={goalDone}
              onPress={handleHeroPress}
            />
          </Rise>

          {/* Or pick your own */}
          <Rise index={4}>
            <View style={styles.picksHeader}>
              <Text style={[styles.picksLabel, { color: textColor }]}>{COPY.pickYourOwn}</Text>
              {selectedOverrideOp ? (
                <TouchableOpacity
                  onPress={() => setSelectedOverrideOp(null)}
                  hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={COPY.backToPlan}
                >
                  <Text style={[styles.linkText, { color: textMuted }]}>{COPY.backToPlan}</Text>
                </TouchableOpacity>
              ) : (
                coach.tryNew && (
                  <TouchableOpacity
                    onPress={() => setSelectedOverrideOp(coach.tryNew!.operation)}
                    hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={coach.tryNew.text}
                    style={styles.linkShrink}
                  >
                    <Text style={[styles.linkText, { color: textMuted }]} numberOfLines={1}>
                      {COPY.tryNewShort(coach.tryNew.operation)}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
            <View style={styles.picksRow}>
              {outerOps.map((op) => (
                <PickCard
                  key={op}
                  operation={op}
                  tag={pickTag(op)}
                  mastered={op !== 'mixed' && coach.mastered.includes(op)}
                  isDark={isDark}
                  cardColor={cardBg}
                  textColor={textColor}
                  subtleColor={textMuted}
                  onPress={() => setSelectedOverrideOp(op)}
                />
              ))}
            </View>
          </Rise>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    gap: 12,
    zIndex: 2,
  },
  greeting: {
    flex: 1,
  },
  greetingLine: {
    ...typography.secondary,
    fontSize: 15,
  },
  greetingName: {
    fontFamily: FONT_FAMILY.heading,
    fontWeight: '600',
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.6,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.button,
    color: HOME_COLORS.ink,
  },
  scroll: {
    flex: 1,
  },
  mainContainer: {
    flexGrow: 1,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 14,
    gap: 18,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: HOME_COLORS.lilac,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
    color: HOME_COLORS.ink,
  },
  heading: {
    fontFamily: FONT_FAMILY.heading,
    fontWeight: '600',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  subheading: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  heroWrap: {
    flex: 1,
  },
  picksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  picksLabel: {
    ...typography.button,
    fontSize: 14,
  },
  linkShrink: {
    flexShrink: 1,
  },
  linkText: {
    ...typography.caption,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  picksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonContainer: {
    flex: 1,
  },
  skeletonGreetingSmall: {
    width: 120,
    height: 14,
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonGreetingName: {
    width: 150,
    height: 26,
    borderRadius: 8,
  },
  skeletonStreak: {
    height: 102,
    borderRadius: 22,
  },
  skeletonChip: {
    width: 150,
    height: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonHeading: {
    width: 250,
    height: 30,
    borderRadius: 8,
    marginBottom: 10,
  },
  skeletonSubheading: {
    width: 220,
    height: 14,
    borderRadius: 6,
  },
  skeletonHero: {
    flex: 1,
    minHeight: 210,
    borderRadius: 32,
  },
  skeletonPick: {
    flex: 1,
    height: 112,
    borderRadius: 20,
  },
});
