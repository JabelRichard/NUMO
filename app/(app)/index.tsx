import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { GlassCard } from '../../src/components/GlassCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import {
  getWeeklyStats,
  getRecentWorkouts,
  WorkoutSessionRecord,
  WeeklyStats,
} from '../../src/services/workoutService';
import { getUserProfile } from '../../src/services/settingsService';

export default function DashboardScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    solvedCount: 0,
    totalTimeMs: 0,
    avgTimePerQuestionMs: 0,
  });

  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSessionRecord[]>([]);
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string }>({});

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(0, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadDashboardData() {
        const [stats, recent] = await Promise.all([
          getWeeklyStats(),
          getRecentWorkouts(),
        ]);

        if (session?.user?.id) {
          const prof = await getUserProfile(session.user.id);
          if (isMounted) setProfile(prof);
        }

        if (isMounted) {
          setWeeklyStats(stats);
          setRecentWorkouts(recent);
        }
      }

      loadDashboardData();

      return () => {
        isMounted = false;
      };
    }, [session?.user?.id])
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const displayName =
    profile.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'Math Champion';

  const avatarUrl =
    profile.avatar_url ||
    session?.user?.user_metadata?.avatar_url ||
    null;

  // Extracts clean initials (e.g., "Jabel Richard" -> "JR")
  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'M';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatWeeklyTime = (ms: number): string => {
    if (!ms || ms === 0) return '0m';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins > 0) return `${mins}m`;
    return `${secs}s`;
  };

  const formatAvgTime = (ms: number): string => {
    if (!ms || ms === 0) return '—';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  const formatRelativeDate = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getOperationIcon = (op: string) => {
    switch (op.toLowerCase()) {
      case 'addition':
        return 'add-circle-outline';
      case 'subtraction':
        return 'remove-circle-outline';
      case 'multiplication':
        return 'close-circle-outline';
      case 'division':
        return 'stats-chart-outline';
      default:
        return 'sparkles-outline';
    }
  };

  const formatOperationTitle = (op: string) => {
    switch (op.toLowerCase()) {
      case 'addition':
        return 'Addition';
      case 'subtraction':
        return 'Subtraction';
      case 'multiplication':
        return 'Multiplication';
      case 'division':
        return 'Division';
      case 'adaptive_mix':
      case 'mixed':
        return 'Mixed Challenge';
      default:
        return op.charAt(0).toUpperCase() + op.slice(1);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar: Name & Tappable Profile Avatar */}
          <View style={styles.headerRow}>
            <Text style={styles.appTitle}>NUMO</Text>

            <TouchableOpacity
              style={styles.avatarButton}
              activeOpacity={0.8}
              onPress={() => router.push('/(app)/settings')}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Hero Card */}
          <GlassCard style={styles.heroCard} intensity={60}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>DAILY GOAL</Text>
            </View>
            <Text style={styles.heroTitle}>
              Ready for today's mental workout?
            </Text>
            <Text style={styles.heroSubtitle}>
              Keep your brain sharp with a quick 3-minute challenge.
            </Text>
            <PrimaryButton
              title="Start Training"
              onPress={() => router.push('/(app)/training' as any)}
              icon={<Ionicons name="arrow-forward" size={20} color="#FFF" />}
              style={styles.heroButton}
            />
          </GlassCard>

          {/* Quick Statistics Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Overview</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.coloredStatCard, { backgroundColor: '#AFA2FE' }]}>
              <Text style={styles.coloredStatValue}>
                {weeklyStats.solvedCount}
              </Text>
              <Text style={styles.coloredStatLabel}>Solved</Text>
            </View>

            <View style={[styles.coloredStatCard, { backgroundColor: '#EC673C' }]}>
              <Text style={[styles.coloredStatValue, { color: '#FFFFFF' }]}>
                {formatWeeklyTime(weeklyStats.totalTimeMs)}
              </Text>
              <Text style={[styles.coloredStatLabel, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                Time
              </Text>
            </View>

            <View style={[styles.coloredStatCard, { backgroundColor: '#F6FE91' }]}>
              <Text style={styles.coloredStatValue}>
                {formatAvgTime(weeklyStats.avgTimePerQuestionMs)}
              </Text>
              <Text style={styles.coloredStatLabel}>Avg/Q</Text>
            </View>
          </View>

          {/* Recent Workouts Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
          </View>

          {recentWorkouts.length > 0 ? (
            <GlassCard style={styles.recentListCard} intensity={40}>
              {recentWorkouts.map((item, index) => {
                const avgSecs = (item.average_time_per_question / 1000).toFixed(1);
                return (
                  <View key={item.id}>
                    <View style={styles.workoutRow}>
                      <View style={styles.workoutIconCircle}>
                        <Ionicons
                          name={getOperationIcon(item.operation) as any}
                          size={22}
                          color="#1C1C1E"
                        />
                      </View>

                      <View style={styles.workoutInfo}>
                        <Text style={styles.workoutTitle}>
                          {formatOperationTitle(item.operation)}
                        </Text>
                        <Text style={styles.workoutSubtitle}>
                          {item.correct_answers}/{item.total_questions} · {Math.round(item.accuracy)}% · {avgSecs}s/Q
                        </Text>
                      </View>

                      <Text style={styles.workoutDate}>
                        {formatRelativeDate(item.completed_at)}
                      </Text>
                    </View>
                    {index < recentWorkouts.length - 1 ? (
                      <View style={styles.rowDivider} />
                    ) : null}
                  </View>
                );
              })}
            </GlassCard>
          ) : (
            <GlassCard style={styles.activityCard} intensity={35}>
              <View style={styles.emptyActivityContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="time-outline" size={28} color="#8E8E93" />
                </View>
                <Text style={styles.emptyTitle}>No workouts yet</Text>
                <Text style={styles.emptySubtitle}>
                  Complete your first mental session to start building your
                  workout history.
                </Text>
              </View>
            </GlassCard>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E6E6E6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '400',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#EC673C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroCard: {
    marginBottom: 28,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236, 103, 60, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#EC673C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '500',
    color: '#1C1C1E',
    lineHeight: 28,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#636366',
    lineHeight: 20,
    marginBottom: 20,
  },
  heroButton: {
    width: '100%',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  coloredStatCard: {
    flex: 1,
    minWidth: 95,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  coloredStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  coloredStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityCard: {
    minHeight: 140,
    justifyContent: 'center',
  },
  emptyActivityContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  recentListCard: {
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  workoutIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  workoutSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
  },
  workoutDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});