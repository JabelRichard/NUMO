import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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
import NetInfo from '@react-native-community/netinfo';

import { useAuth } from '../../src/context/AuthContext';
import {
  getUserProfile,
  getUserSettings,
} from '../../src/services/settingsService';
import {
  getWeeklyStats,
  getRecentWorkouts,
  WorkoutSessionRecord,
} from '../../src/services/workoutService';
import { fetchAllWorkouts } from '../../src/services/statsService';
import { useTheme } from '@/src/context/ThemeContext';
import { OfflineNotice } from '../../src/components/OfflineNotice';

type Difficulty = 'easy' | 'medium' | 'hard';

type OperationType =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'mixed';

interface OperationBubbleProps {
  type: OperationType;
  isFocalCenter?: boolean;
  themeColors: {
    bg: string;
    fg: string;
    borderColor?: string;
  };
}

interface SkillStats {
  key: OperationType;
  name: string;
  totalQ: number;
  accuracy: number;
  avgPace: number;
  masteryScore: number;
  frictionScore: number;
}

interface HomeRecommendation {
  targetOp: OperationType;
  heading: string;
  subheading: string;
}

/* -------------------------------------------------------------------------- */
/* Operation Bubble                                                           */
/* -------------------------------------------------------------------------- */

function OperationBubble({
  type,
  isFocalCenter = false,
  themeColors,
}: OperationBubbleProps) {
  const size = isFocalCenter ? 86 : 74;

  const renderGlyph = () => {
    switch (type) {
      case 'addition':
        return (
          <Ionicons
            name="add"
            size={isFocalCenter ? 38 : 32}
            color={themeColors.fg}
          />
        );
      case 'subtraction':
        return (
          <Ionicons
            name="remove"
            size={isFocalCenter ? 36 : 30}
            color={themeColors.fg}
          />
        );
      case 'multiplication':
        return (
          <Ionicons
            name="close"
            size={isFocalCenter ? 38 : 34}
            color={themeColors.fg}
          />
        );
      case 'division':
        return (
          <Text
            style={[
              styles.divisionGlyph,
              {
                color: themeColors.fg,
                fontSize: isFocalCenter ? 38 : 32,
                lineHeight: isFocalCenter ? 44 : 36,
              },
            ]}
          >
            ÷
          </Text>
        );
      case 'mixed':
      default:
        return (
          <Ionicons
            name="shuffle"
            size={isFocalCenter ? 36 : 30}
            color={themeColors.fg}
          />
        );
    }
  };

  return (
    <View
      style={[
        styles.operationCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: themeColors.bg,
          borderColor: themeColors.borderColor || 'transparent',
          borderWidth: isFocalCenter ? 1.5 : 0,
        },
      ]}
    >
      {renderGlyph()}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Recommendation Engine                                                      */
/* -------------------------------------------------------------------------- */

function normalizeOperation(value: unknown): OperationType {
  const raw = String(value || '').toLowerCase();

  if (raw === 'adaptive_mix') {
    return 'mixed';
  }

  if (
    raw === 'addition' ||
    raw === 'subtraction' ||
    raw === 'multiplication' ||
    raw === 'division' ||
    raw === 'mixed'
  ) {
    return raw;
  }

  return 'mixed';
}

function buildSkillStats(
  workouts: WorkoutSessionRecord[],
): SkillStats[] {
  const categories: Record<
    OperationType,
    {
      name: string;
      totalQ: number;
      correct: number;
      totalTimeMs: number;
    }
  > = {
    addition: {
      name: 'Addition',
      totalQ: 0,
      correct: 0,
      totalTimeMs: 0,
    },
    subtraction: {
      name: 'Subtraction',
      totalQ: 0,
      correct: 0,
      totalTimeMs: 0,
    },
    multiplication: {
      name: 'Multiplication',
      totalQ: 0,
      correct: 0,
      totalTimeMs: 0,
    },
    division: {
      name: 'Division',
      totalQ: 0,
      correct: 0,
      totalTimeMs: 0,
    },
    mixed: {
      name: 'Mixed Challenge',
      totalQ: 0,
      correct: 0,
      totalTimeMs: 0,
    },
  };

  workouts.forEach((workout) => {
    const operation = normalizeOperation(workout.operation);
    const totalQuestions = Number(workout.total_questions) || 0;
    const correctAnswers = Number(workout.correct_answers) || 0;
    const totalTime = Number(workout.total_time) || 0;

    categories[operation].totalQ += totalQuestions;
    categories[operation].correct += correctAnswers;
    categories[operation].totalTimeMs += totalTime;
  });

  return (
    Object.entries(categories) as [
      OperationType,
      (typeof categories)[OperationType],
    ][]
  ).map(([key, data]) => {
    const accuracy =
      data.totalQ > 0
        ? Math.round((data.correct / data.totalQ) * 100)
        : 0;

    const avgPace =
      data.totalQ > 0
        ? parseFloat((data.totalTimeMs / data.totalQ / 1000).toFixed(1))
        : 0;

    const masteryScore =
      data.totalQ > 0
        ? accuracy * 0.7 + Math.max(0, 10 - avgPace) * 3
        : 0;

    const frictionScore =
      data.totalQ > 0
        ? (100 - accuracy) * 1.4 + avgPace * 3.5
        : -1;

    return {
      key,
      name: data.name,
      totalQ: data.totalQ,
      accuracy,
      avgPace,
      masteryScore,
      frictionScore,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Focus Copy                                                                 */
/* -------------------------------------------------------------------------- */

function getFocusCopy(
  operation: OperationType,
  accuracy?: number,
): {
  heading: string;
  subheading: string;
} {
  switch (operation) {
    case 'addition':
      return {
        heading: "Let's sharpen your addition.",
        subheading:
          accuracy !== undefined
            ? `Your current accuracy is ${Math.round(accuracy)}%. Let's build it up.`
            : 'Build faster, cleaner mental sums.',
      };

    case 'subtraction':
      return {
        heading: "Let's strengthen your subtraction.",
        subheading:
          accuracy !== undefined
            ? `Your current accuracy is ${Math.round(accuracy)}%. Let's lock it in.`
            : 'Sharpen your mental differences and borrowing.',
      };

    case 'multiplication':
      return {
        heading: "Let's sharpen your multiplication.",
        subheading:
          accuracy !== undefined
            ? `Your current accuracy is ${Math.round(accuracy)}%. Let's build speed.`
            : 'Strengthen quick recall of your multiplication facts.',
      };

    case 'division':
      return {
        heading: "Let's strengthen your division.",
        subheading:
          accuracy !== undefined
            ? `Your current accuracy is ${Math.round(accuracy)}%. Let's build confidence.`
            : 'Sharpen factor recall and quick quotients.',
      };

    case 'mixed':
    default:
      return {
        heading: "Let's test your all-around speed.",
        subheading:
          'Keep your skills balanced with a mixed mental-math challenge.',
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Stats-aligned Recommendation Resolver                                      */
/* -------------------------------------------------------------------------- */

function resolveStatsAlignedRecommendation(
  workouts: WorkoutSessionRecord[],
): HomeRecommendation {
  if (!workouts || workouts.length === 0) {
    return {
      targetOp: 'mixed',
      heading: "Let's find your baseline.",
      subheading:
        'Start with a balanced challenge so NUMO can learn how you solve.',
    };
  }

  const skills = buildSkillStats(workouts);

  const eligibleOperations = skills.filter(
    (skill) => skill.totalQ >= 20,
  );

  const unpracticedOperations = skills.filter(
    (skill) => skill.totalQ < 10 && skill.key !== 'mixed',
  );

  /* 2+ mature operations */
  if (eligibleOperations.length >= 2) {
    const strongest = [...eligibleOperations].sort(
      (a, b) => b.masteryScore - a.masteryScore,
    )[0];

    const worstCandidate = [...eligibleOperations].sort(
      (a, b) => b.frictionScore - a.frictionScore,
    )[0];

    if (worstCandidate && worstCandidate.key !== strongest.key) {
      const copy = getFocusCopy(
        worstCandidate.key,
        worstCandidate.accuracy,
      );

      return {
        targetOp: worstCandidate.key,
        heading: copy.heading,
        subheading: copy.subheading,
      };
    }

    return {
      targetOp: 'mixed',
      heading: "Let's test your all-around speed.",
      subheading:
        'Your strongest skills are balanced. Ready for a mixed challenge?',
    };
  }

  /* Exactly 1 mature operation */
  if (eligibleOperations.length === 1) {
    if (unpracticedOperations.length > 0) {
      const nextOperation = unpracticedOperations[0];
      const copy = getFocusCopy(nextOperation.key);

      return {
        targetOp: nextOperation.key,
        heading: copy.heading,
        subheading:
          'Try another operation to build a more complete skill profile.',
      };
    }

    return {
      targetOp: 'mixed',
      heading: "Let's build more variety.",
      subheading:
        'Try a mixed challenge and keep expanding your mental-math range.',
    };
  }

  /* 0 mature operations */
  if (unpracticedOperations.length > 0) {
    const nextOperation = unpracticedOperations[0];
    const copy = getFocusCopy(nextOperation.key);

    return {
      targetOp: nextOperation.key,
      heading: copy.heading,
      subheading:
        'Build your foundation so NUMO can learn your strengths and areas to improve.',
    };
  }

  return {
    targetOp: 'mixed',
    heading: "Let's build your foundation.",
    subheading:
      'Keep practicing so NUMO can learn how you solve across every skill.',
  };
}

/* -------------------------------------------------------------------------- */
/* Main Dashboard Screen Component                                            */
/* -------------------------------------------------------------------------- */

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();

  const isNarrow = width < 360;
  const isInitialMount = useRef(true);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [profile, setProfile] = useState<{
    full_name?: string;
    avatar_url?: string;
  }>({});
  const [userQuestionGoal, setUserQuestionGoal] = useState<number>(10);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSessionRecord[]>([]);
  const [totalSolved, setTotalSolved] = useState<number>(0);

  /* Animations */
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(16);
  const pulseCenter = useSharedValue(1);

  /* Network & Dashboard Data Loading */
  const loadDashboardState = useCallback(async () => {
    const net = await NetInfo.fetch();

    if (net.isConnected === false || net.isInternetReachable === false) {
      setIsOffline(true);
      setIsLoading(false);
      return;
    }

    if (isInitialMount.current) {
      setIsLoading(true);
    }

    try {
      const [
        workoutsData,
        statsData,
        settingsData,
        profileData,
      ] = await Promise.all([
        session?.user?.id
          ? fetchAllWorkouts(session.user.id).catch(() => getRecentWorkouts())
          : getRecentWorkouts(),
        getWeeklyStats(),
        session?.user?.id
          ? getUserSettings(session.user.id).catch(() => null)
          : null,
        session?.user?.id
          ? getUserProfile(session.user.id).catch(() => null)
          : null,
      ]);

      if (profileData) {
        setProfile(profileData);
      }

      if (settingsData?.daily_question_goal) {
        const savedGoal = Number(settingsData.daily_question_goal) || 10;
        setUserQuestionGoal(savedGoal);
      }

      const parsedWorkouts = Array.isArray(workoutsData)
        ? workoutsData
        : (workoutsData as any)?.data || [];

      setAllWorkouts(parsedWorkouts);
      setTotalSolved(statsData?.solvedCount || 0);

      setIsOffline(false);
      setIsLoading(false);
      isInitialMount.current = false;

      contentOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.quad),
      });

      contentTranslateY.value = withTiming(0, {
        duration: 400,
        easing: Easing.out(Easing.quad),
      });
    } catch {
      setIsOffline(true);
      setIsLoading(false);
      isInitialMount.current = false;
    }
  }, [session?.user?.id, contentOpacity, contentTranslateY]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline =
        state.isConnected === false || state.isInternetReachable === false;

      setIsOffline(offline);

      if (!offline && isOffline) {
        loadDashboardState();
      }
    });

    return () => unsubscribe();
  }, [isOffline, loadDashboardState]);

  useEffect(() => {
    pulseCenter.value = withRepeat(
      withSequence(
        withTiming(1.03, {
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      true,
    );
  }, [pulseCenter]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardState();
    }, [loadDashboardState]),
  );

  /* Animated Styles */
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [
      {
        translateY: contentTranslateY.value,
      },
    ],
  }));

  const centerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: pulseCenter.value,
      },
    ],
  }));

  /* Theme Setup */
  const isDark = theme.isDark;
  const screenBg = isDark ? '#0A0F0B' : theme.background || '#F1ECE9';
  const textColor = theme.text;
  const textSubtle = theme.muted;
  const cardBg = theme.card;
  const accentGreen = '#BCE3AA';
  const accentLilac = '#F2CAEC';
  const bottomBarPadding = Math.max(insets.bottom, 16) + 85;

  /* Profile Resolution */
  const displayName =
    profile.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Champion';

  const avatarUrl =
    profile.avatar_url ||
    session?.user?.user_metadata?.avatar_url ||
    null;

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'M';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  /* User State & 6-Hour Context Detection */
  const isNewUser =
    !isLoading && allWorkouts.length === 0 && totalSolved === 0;

  const hasJustCompletedWorkout = (() => {
    if (!allWorkouts || allWorkouts.length === 0) {
      return false;
    }

    const latestDate = new Date(allWorkouts[0].completed_at);
    const now = new Date();

    const isSameCalendarDay =
      latestDate.getDate() === now.getDate() &&
      latestDate.getMonth() === now.getMonth() &&
      latestDate.getFullYear() === now.getFullYear();

    if (!isSameCalendarDay) {
      return false;
    }

    const diffHours =
      (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60);

    return diffHours >= 0 && diffHours <= 6;
  })();

  /* Adaptive Difficulty */
  const determineAdaptiveDifficulty = (): Difficulty => {
    if (!allWorkouts || allWorkouts.length < 3) {
      return 'easy';
    }

    const sample = allWorkouts.slice(0, 5);

    const avgAccuracy =
      sample.reduce(
        (acc, workout) => acc + (Number(workout.accuracy) || 0),
        0,
      ) / sample.length;

    const avgTimePerQuestionMs =
      sample.reduce(
        (acc, workout) =>
          acc + (Number(workout.average_time_per_question) || 0),
        0,
      ) / sample.length;

    if (avgAccuracy >= 90 && avgTimePerQuestionMs <= 2500) {
      return 'hard';
    }

    if (avgAccuracy >= 80 && avgTimePerQuestionMs <= 4000) {
      return 'medium';
    }

    return 'easy';
  };

  /* Recommendation Memo */
  const {
    focusOp,
    badgeText,
    headingText,
    subheadingText,
    buttonText,
  } = useMemo(() => {
    if (isNewUser) {
      return {
        focusOp: 'mixed' as OperationType,
        badgeText: 'WELCOME TO NUMO',
        headingText: "Let's find your baseline.",
        subheadingText:
          'Start with a balanced challenge so NUMO can learn how you solve.',
        buttonText: 'START TRAINING',
      };
    }

    const recommendation = resolveStatsAlignedRecommendation(allWorkouts);

    return {
      focusOp: recommendation.targetOp,
      badgeText: hasJustCompletedWorkout ? 'NICE WORK TODAY' : 'YOUR NEXT STEP',
      headingText: hasJustCompletedWorkout
        ? 'Ready for another challenge?'
        : recommendation.heading,
      subheadingText: hasJustCompletedWorkout
        ? 'Keep building your speed and accuracy, or try a different challenge.'
        : recommendation.subheading,
      buttonText: hasJustCompletedWorkout
        ? 'START ANOTHER WORKOUT'
        : 'START TRAINING',
    };
  }, [isNewUser, allWorkouts, hasJustCompletedWorkout]);

  /* Start Workout Dispatch */
  const handleStartWorkout = () => {
    const recommendedDifficulty = determineAdaptiveDifficulty();
    const questionCount = isNewUser ? 10 : userQuestionGoal || 10;

    router.push({
      pathname: '/workout' as any,
      params: {
        mode: focusOp === 'mixed' ? 'adaptive_mix' : focusOp,
        difficulty: isNewUser ? 'easy' : recommendedDifficulty,
        count: questionCount.toString(),
        source: 'home_coach',
      },
    });
  };

  /* Operation Cluster Bubble Placement */
  const allOps: OperationType[] = [
    'addition',
    'multiplication',
    'subtraction',
    'division',
    'mixed',
  ];

  const outerOps = allOps.filter((operation) => operation !== focusOp);

  const topLeftOp = outerOps[0];
  const topRightOp = outerOps[1];
  const bottomLeftOp = outerOps[2];
  const bottomRightOp = outerOps[3];

  /* Offline Blocker - Executed safely after all hooks have run */
  if (isOffline) {
    return (
      <OfflineNotice
        onRetry={loadDashboardState}
        isRetrying={isLoading}
      />
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: screenBg,
        },
      ]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={screenBg}
      />

      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            paddingHorizontal: isNarrow ? 18 : 24,
            paddingTop: Math.max(insets.top > 0 ? 6 : 14, 10),
          },
        ]}
      >
        <Text
          style={[
            styles.brandTitle,
            {
              color: textColor,
            },
          ]}
        >
          NUMO
        </Text>

        <TouchableOpacity
          style={[
            styles.avatarButton,
            {
              backgroundColor: cardBg,
            },
          ]}
          activeOpacity={0.8}
          onPress={() => router.push('/(app)/settings')}
        >
          {avatarUrl ? (
            <Image
              source={{
                uri: avatarUrl,
              }}
              style={styles.avatarImage}
            />
          ) : (
            <View
              style={[
                styles.avatarInner,
                {
                  backgroundColor: accentGreen,
                },
              ]}
            >
              <Text style={styles.avatarText}>
                {getInitials(displayName)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Main Container */}
      <Animated.View
        style={[
          styles.mainContainer,
          containerAnimatedStyle,
        ]}
      >
        {/* Upper Stage: Directives */}
        <View style={styles.upperStage}>
          <View
            style={[
              styles.tagBadge,
              {
                backgroundColor: isDark
                  ? 'rgba(188, 227, 170, 0.18)'
                  : accentLilac,
              },
            ]}
          >
            <Text
              style={[
                styles.tagBadgeText,
                {
                  color: isDark ? accentGreen : '#0A0F0B',
                },
              ]}
            >
              {badgeText}
            </Text>
          </View>

          <Text
            style={[
              styles.clarityHeading,
              {
                color: textColor,
              },
            ]}
          >
            {headingText}
          </Text>

          <Text
            style={[
              styles.claritySubheading,
              {
                color: textSubtle,
              },
            ]}
          >
            {subheadingText}
          </Text>
        </View>

        {/* Center Stage: Operation Clusters */}
        <View style={styles.centerStageWrapper}>
          <View style={styles.circlesCluster}>
            {/* Top Row */}
            <View style={styles.circlesRow}>
              <OperationBubble
                type={topLeftOp}
                themeColors={{
                  bg: isDark ? 'rgba(188, 227, 170, 0.18)' : '#FFFFFF',
                  fg: isDark ? accentGreen : '#0A0F0B',
                }}
              />
              <OperationBubble
                type={topRightOp}
                themeColors={{
                  bg: isDark ? 'rgba(242, 202, 236, 0.22)' : accentLilac,
                  fg: isDark ? accentLilac : '#0A0F0B',
                }}
              />
            </View>

            {/* Center Focal Point */}
            <Animated.View
              style={[
                styles.centerFocalWrap,
                centerAnimatedStyle,
              ]}
            >
              <OperationBubble
                type={focusOp}
                isFocalCenter
                themeColors={{
                  bg: isDark ? 'rgba(188, 227, 170, 0.28)' : accentGreen,
                  fg: isDark ? accentGreen : '#0A0F0B',
                  borderColor: isDark
                    ? accentGreen
                    : 'rgba(10, 15, 11, 0.12)',
                }}
              />
            </Animated.View>

            {/* Bottom Row */}
            <View style={styles.circlesRow}>
              <OperationBubble
                type={bottomLeftOp}
                themeColors={{
                  bg: isDark ? 'rgba(255, 255, 255, 0.09)' : '#FFFFFF',
                  fg: textColor,
                }}
              />
              <OperationBubble
                type={bottomRightOp}
                themeColors={{
                  bg: isDark ? 'rgba(242, 202, 236, 0.18)' : '#FFFFFF',
                  fg: isDark ? accentLilac : '#0A0F0B',
                }}
              />
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View
          style={[
            styles.actionWrapper,
            {
              paddingBottom: bottomBarPadding,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.startButton,
              {
                backgroundColor: accentGreen,
              },
            ]}
            activeOpacity={0.85}
            onPress={handleStartWorkout}
          >
            <Text style={styles.startButtonText}>
              {buttonText}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={22}
              color="#0A0F0B"
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Stylesheet                                                                 */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    zIndex: 2,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    color: '#0A0F0B',
    fontSize: 15,
    fontWeight: '600',
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  upperStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
  },
  tagBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 12,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  clarityHeading: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  claritySubheading: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 14,
  },
  centerStageWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  circlesCluster: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  circlesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  centerFocalWrap: {
    zIndex: 3,
  },
  operationCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  divisionGlyph: {
    fontWeight: '700',
    textAlign: 'center',
  },
  actionWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  startButton: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0F0B',
    letterSpacing: 1.2,
  },
});