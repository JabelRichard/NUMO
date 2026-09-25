import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
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
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../src/context/AuthContext';
import { getUserProfile, getUserSettings } from '../../src/services/settingsService';
import {
  getRecentWorkouts,
  getWeeklyStats,
  WorkoutSessionRecord,
  getNextFocus,
  FocusOperation,
} from '../../src/services/workoutService';
import { supabase } from '../../src/config/supabase';
import { useTheme } from '@/src/context/ThemeContext';
import { OfflineNotice } from '../../src/components/OfflineNotice';

type Difficulty = 'easy' | 'medium' | 'hard';
type OperationType = FocusOperation;

interface OperationBubbleProps {
  type: OperationType;
  isFocalCenter?: boolean;
  themeColors: {
    bg: string;
    fg: string;
    borderColor?: string;
  };
}

function OperationBubble({ type, isFocalCenter = false, themeColors }: OperationBubbleProps) {
  const size = isFocalCenter ? 86 : 74;

  const renderGlyph = () => {
    switch (type) {
      case 'addition':
        return <Ionicons name="add" size={isFocalCenter ? 38 : 32} color={themeColors.fg} />;
      case 'subtraction':
        return <Ionicons name="remove" size={isFocalCenter ? 36 : 30} color={themeColors.fg} />;
      case 'multiplication':
        return <Ionicons name="close" size={isFocalCenter ? 38 : 34} color={themeColors.fg} />;
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
        return <Ionicons name="shuffle" size={isFocalCenter ? 36 : 30} color={themeColors.fg} />;
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

async function fetchUserWorkouts(userId: string): Promise<WorkoutSessionRecord[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: true });

  if (error) throw error;
  return (data || []) as WorkoutSessionRecord[];
}

const OP_DISPLAY_NAMES: Record<OperationType, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  mixed: 'Mixed Challenge',
};

const OP_SUBHEADINGS: Record<OperationType, string> = {
  addition: 'Build confidence on quick mental additions and carries.',
  subtraction: 'Strengthen mental differences and subtraction recall.',
  multiplication: 'Sharpen recall across your times tables.',
  division: 'Master quick quotients and factor identification.',
  mixed: 'Balanced sprint across all 4 math operations.',
};

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
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string }>({});
  const [userQuestionGoal, setUserQuestionGoal] = useState<number>(10);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSessionRecord[]>([]);
  const [totalSolved, setTotalSolved] = useState<number>(0);

  // User Interactive Selection State
  const [selectedOverrideOp, setSelectedOverrideOp] = useState<OperationType | null>(null);

  // Animations
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(16);
  const pulseCenter = useSharedValue(1);

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

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      if (!offline && isOffline) {
        loadDashboardState();
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  useEffect(() => {
    pulseCenter.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulseCenter]);

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
      const [workoutsData, statsData, settingsData, profileData] = await Promise.all([
        session?.user?.id ? fetchUserWorkouts(session.user.id).catch(() => getRecentWorkouts()) : getRecentWorkouts(),
        getWeeklyStats(),
        session?.user?.id ? getUserSettings(session.user.id).catch(() => null) : null,
        session?.user?.id ? getUserProfile(session.user.id).catch(() => null) : null,
      ]);

      if (profileData) setProfile(profileData);
      if (settingsData?.daily_question_goal) {
        setUserQuestionGoal(Number(settingsData.daily_question_goal) || 10);
      }

      const parsedWorkouts = Array.isArray(workoutsData)
        ? workoutsData
        : (workoutsData as any)?.data || [];

      setAllWorkouts(parsedWorkouts);
      setTotalSolved(statsData?.solvedCount || 0);
      setIsOffline(false);

      if (isInitialMount.current) {
        setIsLoading(false);
        isInitialMount.current = false;
        contentOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
        contentTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
      }
    } catch {
      setIsOffline(true);
      if (isInitialMount.current) {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    }
  }, [session?.user?.id, contentOpacity, contentTranslateY]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardState();
    }, [loadDashboardState])
  );

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const centerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseCenter.value }],
  }));

  const skeletonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skeletonPulse.value,
  }));

  const isDark = theme.isDark;
  const screenBg = isDark ? '#0A0F0B' : theme.background || '#F1ECE9';
  const textColor = theme.text;
  const textSubtle = theme.muted;
  const cardBg = theme.card;
  const accentGreen = '#BCE3AA';
  const accentLilac = '#F2CAEC';

  const skeletonBoneColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 15, 11, 0.07)';
  const bottomBarPadding = Math.max(insets.bottom, 16) + 85;

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

  const isNewUser = !isLoading && allWorkouts.length === 0 && totalSolved === 0;

  const latestWorkout = useMemo(() => {
    if (!allWorkouts || allWorkouts.length === 0) return null;
    return allWorkouts.reduce<WorkoutSessionRecord | null>((latest, workout) => {
      if (!latest) return workout;
      const latestTime = new Date(latest.completed_at).getTime();
      const workoutTime = new Date(workout.completed_at).getTime();
      return workoutTime > latestTime ? workout : latest;
    }, null);
  }, [allWorkouts]);

  const workoutsCompletedToday = useMemo(() => {
    if (!allWorkouts || allWorkouts.length === 0) return 0;
    const now = new Date();
    return allWorkouts.filter((w) => {
      if (!w.completed_at) return false;
      const d = new Date(w.completed_at);
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [allWorkouts]);

  const hasJustCompletedWorkout = useMemo(() => {
    if (!latestWorkout?.completed_at) return false;
    const latestDate = new Date(latestWorkout.completed_at);
    const now = new Date();
    if (Number.isNaN(latestDate.getTime())) return false;

    const isSameCalendarDay =
      latestDate.getDate() === now.getDate() &&
      latestDate.getMonth() === now.getMonth() &&
      latestDate.getFullYear() === now.getFullYear();

    if (!isSameCalendarDay) return false;

    const diffHours = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 6;
  }, [latestWorkout]);

  const determineAdaptiveDifficulty = (): Difficulty => {
    if (allWorkouts.length === 0) return 'easy';
    const sample = allWorkouts.slice(0, 5);
    const avgAccuracy = sample.reduce((acc, curr) => acc + (Number(curr.accuracy) || 0), 0) / sample.length;
    const avgTimePerQuestionMs = sample.reduce((acc, curr) => acc + (Number(curr.average_time_per_question) || 0), 0) / sample.length;

    if (avgAccuracy >= 85 && avgTimePerQuestionMs <= 3500) return 'hard';
    if (avgAccuracy >= 70) return 'medium';
    return 'easy';
  };

  // Dynamic Focus & Messaging Engine
  const { focusOp, badgeText, headingText, subheadingText, buttonText } = useMemo(() => {
    if (isNewUser) {
      const activeOp = selectedOverrideOp || ('mixed' as OperationType);
      return {
        focusOp: activeOp,
        badgeText: selectedOverrideOp ? 'CUSTOM SELECTION' : 'WELCOME TO NUMO',
        headingText: selectedOverrideOp ? `Custom Focus: ${OP_DISPLAY_NAMES[selectedOverrideOp]}` : "Let's find your baseline.",
        subheadingText: selectedOverrideOp ? OP_SUBHEADINGS[selectedOverrideOp] : 'Start with a balanced challenge so NUMO can learn how you solve.',
        buttonText: 'START TRAINING',
      };
    }

    const recommendation = getNextFocus(allWorkouts);
    const effectiveOp: OperationType = selectedOverrideOp || (recommendation.targetOp as OperationType);
    const isCustom = Boolean(selectedOverrideOp && selectedOverrideOp !== recommendation.targetOp);

    // If user explicitly picked an operation via outer bubble
    if (isCustom) {
      return {
        focusOp: effectiveOp,
        badgeText: 'CUSTOM SELECTION',
        headingText: `Custom Focus: ${OP_DISPLAY_NAMES[effectiveOp]}`,
        subheadingText: OP_SUBHEADINGS[effectiveOp],
        buttonText: hasJustCompletedWorkout ? 'START ANOTHER WORKOUT' : 'START TRAINING',
      };
    }

    // Fresh Day / First Workout of Today
    if (workoutsCompletedToday === 0 && !isNewUser) {
      const opName = OP_DISPLAY_NAMES[effectiveOp];
      const isTour = recommendation.stage === 'tour';

      return {
        focusOp: effectiveOp,
        badgeText: isTour ? 'PLACEMENT TOUR' : "COACH'S DAILY PICK",
        headingText: isTour
          ? `Explore ${opName}`
          : `Start today with ${opName}`,
        subheadingText: isTour
          ? `Complete 10 quick ${opName.toLowerCase()} questions to continue your tour.`
          : `Warm up your mental pace and keep your consistency streak alive.`,
        buttonText: "START TODAY'S WORKOUT",
      };
    }

    // Default to Coach's Choice / Tour Recommendation
    if (hasJustCompletedWorkout) {
      let postBadge = 'NICE WORK TODAY';
      let postHeading = 'Ready for another challenge?';

      if (workoutsCompletedToday === 2) {
        postBadge = 'KEEP IT GOING';
        postHeading = 'Ready to push a little further?';
      } else if (workoutsCompletedToday >= 3) {
        postBadge = 'GREAT SESSION';
        postHeading = "You're building serious fluency.";
      }

      return {
        focusOp: effectiveOp,
        badgeText: postBadge,
        headingText: postHeading,
        subheadingText: recommendation.subheading || 'Keep building your speed and accuracy, or try a different challenge.',
        buttonText: 'START ANOTHER WORKOUT',
      };
    }

    return {
      focusOp: effectiveOp,
      badgeText: recommendation.stage === 'tour' ? 'PLACEMENT TOUR' : 'COACH RECOMMENDATION',
      headingText: recommendation.heading,
      subheadingText: recommendation.subheading,
      buttonText: 'START TRAINING',
    };
  }, [isNewUser, selectedOverrideOp, hasJustCompletedWorkout, workoutsCompletedToday, allWorkouts]);

  const handleStartWorkout = () => {
    const recommendedDifficulty = determineAdaptiveDifficulty();
    const questionCount = isNewUser ? 10 : userQuestionGoal;

    router.push({
      pathname: '/workout' as any,
      params: {
        mode: focusOp === 'mixed' ? 'adaptive_mix' : focusOp,
        difficulty: isNewUser ? 'easy' : recommendedDifficulty,
        count: questionCount.toString(),
        source: selectedOverrideOp ? 'home_manual_selection' : 'home_coach',
        reset: 'true',
        sessionKey: Date.now().toString(),
      },
    });
  };

  const allOps: OperationType[] = [
    'addition',
    'multiplication',
    'subtraction',
    'division',
    'mixed',
  ];

  // Outer 4 non-active operations arranged in the grid
  const outerOps = allOps.filter((op) => op !== focusOp);

  const topLeftOp = outerOps[0];
  const topRightOp = outerOps[1];
  const bottomLeftOp = outerOps[2];
  const bottomRightOp = outerOps[3];

  if (isOffline) {
    return <OfflineNotice onRetry={loadDashboardState} isRetrying={isLoading} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={screenBg} />

      {/* Header Bar */}
      <View
        style={[
          styles.headerRow,
          {
            paddingHorizontal: isNarrow ? 18 : 24,
            paddingTop: Math.max(insets.top > 0 ? 6 : 14, 10),
          },
        ]}
      >
        <Text style={[styles.brandTitle, { color: textColor }]}>NUMO</Text>

        <TouchableOpacity
          style={[styles.avatarButton, { backgroundColor: cardBg }]}
          activeOpacity={0.8}
          onPress={() => router.push('/(app)/settings')}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarInner, { backgroundColor: accentGreen }]}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Animated.View style={[styles.mainContainer, skeletonAnimatedStyle]}>
          <View style={styles.upperStage}>
            <View style={[styles.skeletonBadge, { backgroundColor: skeletonBoneColor }]} />
            <View style={[styles.skeletonHeadingLine, { backgroundColor: skeletonBoneColor }]} />
            <View style={[styles.skeletonHeadingLineShort, { backgroundColor: skeletonBoneColor }]} />
            <View style={[styles.skeletonSubheadingLine, { backgroundColor: skeletonBoneColor }]} />
          </View>

          <View style={styles.centerStageWrapper}>
            <View style={styles.circlesCluster}>
              <View style={styles.circlesRow}>
                <View style={[styles.skeletonCircle, { backgroundColor: skeletonBoneColor }]} />
                <View style={[styles.skeletonCircle, { backgroundColor: skeletonBoneColor }]} />
              </View>

              <View style={[styles.skeletonCircleCenter, { backgroundColor: skeletonBoneColor }]} />

              <View style={styles.circlesRow}>
                <View style={[styles.skeletonCircle, { backgroundColor: skeletonBoneColor }]} />
                <View style={[styles.skeletonCircle, { backgroundColor: skeletonBoneColor }]} />
              </View>
            </View>
          </View>

          <View style={[styles.actionWrapper, { paddingBottom: bottomBarPadding }]}>
            <View style={[styles.skeletonButton, { backgroundColor: skeletonBoneColor }]} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.mainContainer, containerAnimatedStyle]}>
          
          {/* Upper Text Stage */}
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
                  { color: isDark ? accentGreen : '#0A0F0B' },
                ]}
              >
                {badgeText}
              </Text>
            </View>

            <Text style={[styles.clarityHeading, { color: textColor }]}>
              {headingText}
            </Text>

            <Text style={[styles.claritySubheading, { color: textSubtle }]}>
              {subheadingText}
            </Text>
          </View>

          {/* Center Stage: Interactive Operation Bubbles */}
          <View style={styles.centerStageWrapper}>
            <View style={styles.circlesCluster}>
              
              {/* Top Row: Interactive Outer Bubbles */}
              <View style={styles.circlesRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSelectedOverrideOp(topLeftOp)}
                >
                  <OperationBubble
                    type={topLeftOp}
                    themeColors={{
                      bg: isDark ? 'rgba(188, 227, 170, 0.18)' : '#FFFFFF',
                      fg: isDark ? accentGreen : '#0A0F0B',
                    }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSelectedOverrideOp(topRightOp)}
                >
                  <OperationBubble
                    type={topRightOp}
                    themeColors={{
                      bg: isDark ? 'rgba(242, 202, 236, 0.22)' : accentLilac,
                      fg: isDark ? accentLilac : '#0A0F0B',
                    }}
                  />
                </TouchableOpacity>
              </View>

              {/* Center Focal Point: Active Recommended / Selected Operation */}
              <Animated.View style={[styles.centerFocalWrap, centerAnimatedStyle]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    // Tapping center resets back to coach's automatic recommendation
                    if (selectedOverrideOp) setSelectedOverrideOp(null);
                  }}
                >
                  <OperationBubble
                    type={focusOp}
                    isFocalCenter={true}
                    themeColors={{
                      bg: isDark ? 'rgba(188, 227, 170, 0.28)' : accentGreen,
                      fg: isDark ? accentGreen : '#0A0F0B',
                      borderColor: isDark ? accentGreen : 'rgba(10, 15, 11, 0.12)',
                    }}
                  />
                </TouchableOpacity>
              </Animated.View>

              {/* Bottom Row: Interactive Outer Bubbles */}
              <View style={styles.circlesRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSelectedOverrideOp(bottomLeftOp)}
                >
                  <OperationBubble
                    type={bottomLeftOp}
                    themeColors={{
                      bg: isDark ? 'rgba(255, 255, 255, 0.09)' : '#FFFFFF',
                      fg: textColor,
                    }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSelectedOverrideOp(bottomRightOp)}
                >
                  <OperationBubble
                    type={bottomRightOp}
                    themeColors={{
                      bg: isDark ? 'rgba(242, 202, 236, 0.18)' : '#FFFFFF',
                      fg: isDark ? accentLilac : '#0A0F0B',
                    }}
                  />
                </TouchableOpacity>
              </View>

            </View>
          </View>

          {/* Start Button */}
          <View style={[styles.actionWrapper, { paddingBottom: bottomBarPadding }]}>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: accentGreen }]}
              activeOpacity={0.85}
              onPress={handleStartWorkout}
            >
              <Text style={styles.startButtonText}>{buttonText}</Text>
              <Ionicons name="arrow-forward" size={22} color="#0A0F0B" />
            </TouchableOpacity>
          </View>

        </Animated.View>
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
    shadowOffset: { width: 0, height: 6 },
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
    shadowOffset: { width: 0, height: 6 },
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
  skeletonBadge: {
    width: 130,
    height: 26,
    borderRadius: 13,
    marginBottom: 16,
  },
  skeletonHeadingLine: {
    width: 260,
    height: 28,
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonHeadingLineShort: {
    width: 180,
    height: 28,
    borderRadius: 8,
    marginBottom: 14,
  },
  skeletonSubheadingLine: {
    width: 220,
    height: 14,
    borderRadius: 6,
  },
  skeletonCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  skeletonCircleCenter: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  skeletonButton: {
    width: '100%',
    height: 64,
    borderRadius: 32,
  },
});