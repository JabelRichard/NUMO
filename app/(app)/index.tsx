import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { GlassCard } from '../../src/components/GlassCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { QuestionAttemptResult } from '../../src/lib/math/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Weekly aggregate metrics state
  const [weeklySolved, setWeeklySolved] = useState<number>(0);
  const [weeklyTimeMs, setWeeklyTimeMs] = useState<number>(0);
  const [weeklyAvgTimeMs, setWeeklyAvgTimeMs] = useState<number>(0);

  // Reanimated entrance shared values
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

  // Compute weekly statistics connected to session data structure
  useEffect(() => {
    // Note: Replace or hydrate this array with your persistent storage or database logs (e.g. AsyncStorage or Supabase)
    const userSessionHistory: QuestionAttemptResult[] = [];

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Filter attempts recorded within the last 7 days
    const thisWeekAttempts = userSessionHistory.filter(
      (attempt) => attempt.timestamp >= sevenDaysAgo
    );

    const totalSolved = thisWeekAttempts.filter((a) => a.isCorrect).length;
    const totalTime = thisWeekAttempts.reduce((acc, a) => acc + a.timeTakenMs, 0);
    const avgTime = thisWeekAttempts.length > 0 ? totalTime / thisWeekAttempts.length : 0;

    setWeeklySolved(totalSolved);
    setWeeklyTimeMs(totalTime);
    setWeeklyAvgTimeMs(avgTime);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Math Champion';

  // Format total weekly time (e.g., "12m" or "45s")
  const formatWeeklyTime = (ms: number): string => {
    if (!ms || ms === 0) return '0s';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins > 0) return `${mins}m`;
    return `${secs}s`;
  };

  // Format average time per question (e.g., "2.4s")
  const formatAvgTime = (ms: number): string => {
    if (!ms || ms === 0) return '0s';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header Row with Dev Sign Out */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Welcome back 👋</Text>
              <Text style={styles.userName}>{displayName}</Text>
            </View>
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={styles.devSignOutButton}
                onPress={signOut}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={20} color="#D93838" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarButton} activeOpacity={0.8}>
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
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

          {/* Quick Statistics Section - MODIFIED OVERVIEW */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Overview</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.coloredStatCard, { backgroundColor: '#AFA2FE' }]}>
              <Text style={styles.coloredStatValue}>{weeklySolved}</Text>
              <Text style={styles.coloredStatLabel}>Solved</Text>
            </View>

            <View style={[styles.coloredStatCard, { backgroundColor: '#EC673C' }]}>
              <Text style={[styles.coloredStatValue, { color: '#FFFFFF' }]}>
                {formatWeeklyTime(weeklyTimeMs)}
              </Text>
              <Text style={[styles.coloredStatLabel, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                Time
              </Text>
            </View>

            <View style={[styles.coloredStatCard, { backgroundColor: '#F6FE91' }]}>
              <Text style={styles.coloredStatValue}>
                {formatAvgTime(weeklyAvgTimeMs)}
              </Text>
              <Text style={styles.coloredStatLabel}>Avg/Q</Text>
            </View>
          </View>

          {/* Recent Activity Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
          </View>
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
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  devSignOutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 21,
    backgroundColor: '#EE5839',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  heroCard: {
    marginBottom: 28,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(238, 88, 57, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#EE5839',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
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
});