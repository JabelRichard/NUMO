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
import { useAuth } from '../../src/context/AuthContext';
import { getUserProfile } from '../../src/services/settingsService';
import { CoachData, LoadedCoachData, loadCoachDataWithFallback } from '../../src/services/coachService';
import {
  CoachOperation,
  COPY,
  focusLabel,
  getCoachPlan,
  roundLength,
  toWorkoutParams,
  workoutForOperation,
} from '../../src/lib/coach';
import { useTheme } from '@/src/context/ThemeContext';
import { typography } from '@/src/constants/typography';
import { OfflineNote } from '../../src/components/OfflineNote';
import { useOnlineStatus } from '../../src/hooks/useOnlineStatus';
import { getInitials } from '../../src/utils/getInitials';

type OperationType = CoachOperation;

const EMPTY_COACH_DATA: CoachData = { plan: {}, workouts: [] };

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

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();

  const isNarrow = width < 360;

  const isInitialMount = useRef(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Reload when the connection comes back (loadDashboardState is defined below; called later).
  const { isOffline, recheck } = useOnlineStatus(() => loadDashboardState());
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string }>({});
  const [loaded, setLoaded] = useState<LoadedCoachData | null>(null);
  // Only the newest load may update the screen.
  const loadIdRef = useRef(0);

  // A tapped outer bubble is a one-time choice; the coach's plan returns afterwards.
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
    pulseCenter.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulseCenter]);

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

    if (isInitialMount.current) {
      setIsLoading(false);
      isInitialMount.current = false;
      contentOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
      contentTranslateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
    }
  }, [session?.user?.id, contentOpacity, contentTranslateY, recheck]);

  useFocusEffect(
    useCallback(() => {
      // Coming back from a workout: drop the one-time pick and follow the plan again.
      setSelectedOverrideOp(null);
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
  const textSubtle = theme.subtext;
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
  const focusText = selectedOverrideOp
    ? focusLabel(selectedOverrideOp, selectedOverrideOp === 'mixed' ? undefined : coach.levels[selectedOverrideOp])
    : coach.focusLabel;

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
      headingText: coach.message.heading,
      subheadingText: coach.message.subheading,
      buttonText: coach.message.button,
    };
  }, [coach, coachData.plan.sessionDurationMinutes, pickedRequest, selectedOverrideOp]);

  const handleStartWorkout = () => {
    const request = pickedRequest ?? coach.workout;
    router.push({
      pathname: '/workout' as any,
      params: {
        ...toWorkoutParams(request),
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

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
          onPress={() => router.push('/(app)/Profile')}
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
          {loaded && <OfflineNote from={loaded.from} isOffline={isOffline} style={styles.offlineNote} />}

          {/* Upper Text Stage */}
          <View style={styles.upperStage}>
            {coach.goalLine && (
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
                  {coach.goalLine}
                </Text>
              </View>
            )}

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
                <Text style={[styles.focusLabel, { color: textColor }]} numberOfLines={1}>
                  {focusText}
                </Text>
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

            {coach.tryNew && !selectedOverrideOp && (
              <TouchableOpacity
                style={styles.tryNewLink}
                activeOpacity={0.7}
                onPress={() => setSelectedOverrideOp(coach.tryNew!.operation)}
              >
                <Text style={[styles.tryNewText, { color: textSubtle }]}>{coach.tryNew.text}</Text>
              </TouchableOpacity>
            )}
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
    ...typography.sectionHeading,
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
    ...typography.button,
    color: '#0A0F0B',
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
  offlineNote: {
    marginTop: 12,
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
    ...typography.caption,
  },
  clarityHeading: {
    ...typography.display,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  claritySubheading: {
    ...typography.body,
    textAlign: 'center',
    marginTop: 8,
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
    alignItems: 'center',
  },
  focusLabel: {
    ...typography.caption,
    marginTop: 8,
    textAlign: 'center',
  },
  tryNewLink: {
    marginTop: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tryNewText: {
    ...typography.caption,
    textAlign: 'center',
    textDecorationLine: 'underline',
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
    ...typography.button,
    color: '#0A0F0B',
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