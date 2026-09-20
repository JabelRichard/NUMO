import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../src/context/AuthContext';
import { getUserProfile } from '../../src/services/settingsService';
import { getRecentWorkouts, getWeeklyStats, WorkoutSessionRecord } from '../../src/services/workoutService';
import { useTheme } from '@/src/context/ThemeContext';
import { OfflineNotice } from '../../src/components/OfflineNotice';

type Difficulty = 'easy' | 'medium' | 'hard';

interface StaticCircleProps {
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  iconSize: number;
  bg: string;
  fg: string;
}

function StaticCircle({
  icon,
  size,
  iconSize,
  bg,
  fg,
}: StaticCircleProps) {
  return (
    <View
      style={[
        styles.operationCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={fg} />
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
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string }>({});
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSessionRecord[]>([]);
  const [totalSolved, setTotalSolved] = useState<number>(0);

  // Entrance animations for the overall screen
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(16);

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
      const [workouts, stats] = await Promise.all([
        getRecentWorkouts(),
        getWeeklyStats(),
      ]);

      if (session?.user?.id) {
        const prof = await getUserProfile(session.user.id);
        setProfile(prof || {});
      }

      setRecentWorkouts(workouts || []);
      setTotalSolved(stats?.solvedCount || 0);
      setIsOffline(false);
      setIsLoading(false);
      isInitialMount.current = false;

      contentOpacity.value = withTiming(1, {
        duration: 450,
        easing: Easing.out(Easing.quad),
      });
      contentTranslateY.value = withTiming(0, {
        duration: 450,
        easing: Easing.out(Easing.quad),
      });
    } catch (error) {
      setIsOffline(true);
      setIsLoading(false);
      isInitialMount.current = false;
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardState();
    }, [loadDashboardState])
  );

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const isDark = theme.isDark;
  const screenBg = isDark ? '#0A0F0B' : theme.background || '#F1ECE9';
  const textColor = theme.text;
  const textSubtle = theme.muted;
  const cardBg = theme.card;
  const accentGreen = '#BCE3AA';
  const accentLilac = '#F2CAEC';

  const bottomBarPadding = Math.max(insets.bottom, 16) + 85;

  const displayName =
    profile.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Champion';

  const firstName = displayName.trim().split(' ')[0] || 'Champion';

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

  if (isOffline) {
    return <OfflineNotice onRetry={loadDashboardState} isRetrying={isLoading} />;
  }

  const isNewUser = !isLoading && recentWorkouts.length === 0 && totalSolved === 0;

  const hasWorkedOutToday = (() => {
    if (recentWorkouts.length === 0) return false;
    const latestDate = new Date(recentWorkouts[0].completed_at);
    const now = new Date();
    return (
      latestDate.getDate() === now.getDate() &&
      latestDate.getMonth() === now.getMonth() &&
      latestDate.getFullYear() === now.getFullYear()
    );
  })();

  const determineAdaptiveDifficulty = (): Difficulty => {
    if (recentWorkouts.length === 0) return 'easy';

    const sample = recentWorkouts.slice(0, 5);
    const avgAccuracy = sample.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / sample.length;
    const avgTimePerQuestionMs = sample.reduce((acc, curr) => acc + (curr.average_time_per_question || 0), 0) / sample.length;

    if (avgAccuracy >= 85 && avgTimePerQuestionMs <= 3500) {
      return 'hard';
    }
    if (avgAccuracy >= 70) {
      return 'medium';
    }
    return 'easy';
  };

  const handleStartWorkout = () => {
    const recommendedDifficulty = determineAdaptiveDifficulty();

    router.push({
      pathname: '/workout' as any,
      params: {
        mode: 'adaptive_mix',
        difficulty: recommendedDifficulty,
        source: 'numo_chooses',
      },
    });
  };

  let badgeText = "TODAY'S WORKOUT";
  let headingText = "Ready for today's workout?";
  let subheadingText = "Adaptive mental math challenge chosen for you. Tap START to begin!";
  let buttonText = "Start Training";

  if (isNewUser) {
    badgeText = `WELCOME, ${firstName.toUpperCase()}`;
    headingText = "Are you ready for your first workout?";
    subheadingText = "Start your mental math journey today. Tap START to begin!";
    buttonText = "Start Training";
  } else if (hasWorkedOutToday) {
    badgeText = "GREAT WORK TODAY";
    headingText = "Mind Sharp & Focused";
    subheadingText = "Daily goal reached. NUMO is ready whenever you want another round.";
    buttonText = "Train Again";
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: screenBg }]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={screenBg}
      />

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

      {/* Main Habit Stage */}
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

        {/* Center Stage: Enlarged Static Operation Circles */}
        <View style={styles.centerStageWrapper}>
          <View style={styles.circlesCluster}>
            
            {/* Top Row: Addition & Multiplication */}
            <View style={styles.circlesRow}>
              <StaticCircle
                icon="add"
                size={74}
                iconSize={34}
                bg={isDark ? 'rgba(188, 227, 170, 0.18)' : '#FFFFFF'}
                fg={isDark ? accentGreen : '#0A0F0B'}
              />
              <StaticCircle
                icon="close"
                size={78}
                iconSize={36}
                bg={isDark ? 'rgba(242, 202, 236, 0.22)' : accentLilac}
                fg={isDark ? accentLilac : '#0A0F0B'}
              />
            </View>

            {/* Center Focal Point: Mixed Challenge */}
            <View style={styles.circlesRow}>
              <StaticCircle
                icon="shuffle"
                size={84}
                iconSize={38}
                bg={isDark ? 'rgba(188, 227, 170, 0.28)' : accentGreen}
                fg={isDark ? accentGreen : '#0A0F0B'}
              />
            </View>

            {/* Bottom Row: Subtraction & Division */}
            <View style={styles.circlesRow}>
              <StaticCircle
                icon="remove"
                size={72}
                iconSize={32}
                bg={isDark ? 'rgba(255, 255, 255, 0.09)' : '#FFFFFF'}
                fg={textColor}
              />
              <StaticCircle
                icon="stats-chart"
                size={76}
                iconSize={34}
                bg={isDark ? 'rgba(242, 202, 236, 0.18)' : '#FFFFFF'}
                fg={isDark ? accentLilac : '#0A0F0B'}
              />
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
  operationCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
});