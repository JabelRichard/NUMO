import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import {
  UserTrainingGoals,
  DEFAULT_TRAINING_GOALS,
  CompletedWorkoutItem,
  ProfileActivityOverview,
  ActivityPeriodSummary,
  ActivityTimeframe,
} from '../types/profile';

const STORAGE_KEYS = {
  TRAINING_GOALS: '@numo_user_training_goals',
};

/**
 * Retrieves the normalized user training goals
 */
export async function getTrainingGoals(userId?: string): Promise<UserTrainingGoals> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRAINING_GOALS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        dailyQuestions: Number(parsed.dailyQuestions) || DEFAULT_TRAINING_GOALS.dailyQuestions,
        sessionDurationMinutes: Number(parsed.sessionDurationMinutes) || DEFAULT_TRAINING_GOALS.sessionDurationMinutes,
        weeklyFrequencyDays: Number(parsed.weeklyFrequencyDays) || DEFAULT_TRAINING_GOALS.weeklyFrequencyDays,
      };
    }
  } catch (err) {
    console.warn('Failed to load training goals from storage:', err);
  }

  // Fallback to defaults
  return DEFAULT_TRAINING_GOALS;
}

/**
 * Saves training goals with normalized numbers
 */
export async function saveTrainingGoals(
  goals: Partial<UserTrainingGoals>,
  userId?: string
): Promise<UserTrainingGoals> {
  const current = await getTrainingGoals(userId);
  const updated: UserTrainingGoals = {
    dailyQuestions: goals.dailyQuestions ?? current.dailyQuestions,
    sessionDurationMinutes: goals.sessionDurationMinutes ?? current.sessionDurationMinutes,
    weeklyFrequencyDays: goals.weeklyFrequencyDays ?? current.weeklyFrequencyDays,
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TRAINING_GOALS, JSON.stringify(updated));

    // Also sync the daily question goal to user settings table if authenticated
    if (userId && goals.dailyQuestions !== undefined) {
      await supabase
        .from('user_settings')
        .upsert({ user_id: userId, daily_question_goal: goals.dailyQuestions });
    }
  } catch (err) {
    console.warn('Failed to save training goals:', err);
  }

  return updated;
}

/**
 * Computes lifetime metrics and the last completed workout for the Profile card
 */
export function calculateProfileOverview(workouts: any[]): ProfileActivityOverview {
  if (!workouts || workouts.length === 0) {
    return {
      lifetimeQuestions: 0,
      lifetimeSessions: 0,
      latestWorkout: null,
    };
  }

  let lifetimeQuestions = 0;
  let latestRaw: any = null;
  let latestTime = 0;

  const normalizedSessions: CompletedWorkoutItem[] = workouts.map((w) => {
    const q = Number(w.total_questions) || 0;
    const c = Number(w.correct_answers) || 0;
    const t = Number(w.total_time) || 0;
    const timeMs = new Date(w.completed_at).getTime();

    lifetimeQuestions += q;

    if (timeMs > latestTime) {
      latestTime = timeMs;
      latestRaw = w;
    }

    return {
      id: w.id,
      operation: w.operation || 'mixed',
      difficulty: w.difficulty || 'easy',
      totalQuestions: q,
      correctAnswers: c,
      accuracy: q > 0 ? Math.round((c / q) * 100) : 0,
      totalTimeMs: t,
      completedAt: w.completed_at,
    };
  });

  const latestWorkout: CompletedWorkoutItem | null = latestRaw
    ? {
        id: latestRaw.id,
        operation: latestRaw.operation || 'mixed',
        difficulty: latestRaw.difficulty || 'easy',
        totalQuestions: Number(latestRaw.total_questions) || 0,
        correctAnswers: Number(latestRaw.correct_answers) || 0,
        accuracy:
          Number(latestRaw.total_questions) > 0
            ? Math.round(
                (Number(latestRaw.correct_answers) / Number(latestRaw.total_questions)) * 100
              )
            : 0,
        totalTimeMs: Number(latestRaw.total_time) || 0,
        completedAt: latestRaw.completed_at,
      }
    : null;

  return {
    lifetimeQuestions,
    lifetimeSessions: workouts.length,
    latestWorkout,
  };
}

/**
 * Filters and aggregates metrics for the Activity Bottom Sheet based on timeframe (7D, 30D, 3M)
 */
export function calculateActivitySummary(
  workouts: any[],
  timeframe: ActivityTimeframe
): ActivityPeriodSummary {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const thresholdMs =
    timeframe === '7D' ? 7 * dayMs : timeframe === '30D' ? 30 * dayMs : 90 * dayMs;

  const filtered = (workouts || []).filter((w) => {
    if (!w.completed_at) return false;
    const sessionTime = new Date(w.completed_at).getTime();
    return now - sessionTime <= thresholdMs;
  });

  // Sort latest first
  filtered.sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );

  let totalQuestions = 0;
  let totalCorrect = 0;

  const recentSessions: CompletedWorkoutItem[] = filtered.map((w) => {
    const q = Number(w.total_questions) || 0;
    const c = Number(w.correct_answers) || 0;
    const t = Number(w.total_time) || 0;

    totalQuestions += q;
    totalCorrect += c;

    return {
      id: w.id,
      operation: w.operation || 'mixed',
      difficulty: w.difficulty || 'easy',
      totalQuestions: q,
      correctAnswers: c,
      accuracy: q > 0 ? Math.round((c / q) * 100) : 0,
      totalTimeMs: t,
      completedAt: w.completed_at,
    };
  });

  const averageAccuracy =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return {
    timeframe,
    questionsSolved: totalQuestions,
    sessionsCompleted: filtered.length,
    averageAccuracy,
    recentSessions,
  };
}