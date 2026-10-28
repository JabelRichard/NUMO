import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import {
  UserTrainingGoals,
  DEFAULT_TRAINING_GOALS,
  CompletedWorkoutItem,
  ProfileActivityOverview,
  ActivityPeriodSummary,
  ActivityTimeframe,
  FrictionArea,
  normalizeComfortLevel,
} from '../types/profile';
import { normalizePrimaryGoal } from '../utils/onboardingDraft';

export const TRAINING_GOALS_KEY = '@numo_user_training_goals';

const STORAGE_KEYS = {
  TRAINING_GOALS: TRAINING_GOALS_KEY,
};

const PROFILE_GOAL_COLUMNS =
  'daily_question_goal, session_duration_minutes, weekly_frequency_days, goals, friction_areas, friction_area, comfort_level';

interface ProfileGoalsRow {
  daily_question_goal: number | null;
  session_duration_minutes: number | null;
  weekly_frequency_days: number | null;
  goals: string[] | null;
  friction_areas: FrictionArea[] | null;
  friction_area: FrictionArea | null;
  comfort_level: string | null;
}

const positiveNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const clampFrequency = (days: number) => Math.min(7, Math.max(1, Math.round(days)));

/**
 * Reads the phone copy. `stored` is the raw saved object (null if nothing was saved),
 * so callers can tell a real value from a default.
 */
async function readLocalTrainingGoals(): Promise<{ goals: UserTrainingGoals; stored: any | null }> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRAINING_GOALS);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Older saves only have the single frictionArea field.
      const frictionAreas: FrictionArea[] | undefined = Array.isArray(parsed.frictionAreas)
        ? parsed.frictionAreas
        : parsed.frictionArea
        ? [parsed.frictionArea]
        : undefined;
      return {
        stored: parsed,
        goals: {
          dailyQuestions: positiveNumber(parsed.dailyQuestions) ?? DEFAULT_TRAINING_GOALS.dailyQuestions,
          sessionDurationMinutes:
            positiveNumber(parsed.sessionDurationMinutes) ?? DEFAULT_TRAINING_GOALS.sessionDurationMinutes,
          weeklyFrequencyDays: clampFrequency(
            positiveNumber(parsed.weeklyFrequencyDays) ?? DEFAULT_TRAINING_GOALS.weeklyFrequencyDays
          ),
          frictionArea: parsed.frictionArea,
          frictionAreas,
          comfortLevel: normalizeComfortLevel(parsed.comfortLevel),
          primaryGoal: normalizePrimaryGoal(parsed.primaryGoal),
        },
      };
    }
  } catch (err) {
    console.warn('Failed to load training goals from storage:', err);
  }

  return { goals: DEFAULT_TRAINING_GOALS, stored: null };
}

/** Supabase values win; anything empty in the row falls back to the phone copy. */
function mergeProfileRow(row: ProfileGoalsRow, local: UserTrainingGoals): UserTrainingGoals {
  const frictionAreas = Array.isArray(row.friction_areas)
    ? row.friction_areas
    : row.friction_area
    ? [row.friction_area]
    : local.frictionAreas;

  return {
    dailyQuestions: positiveNumber(row.daily_question_goal) ?? local.dailyQuestions,
    sessionDurationMinutes: positiveNumber(row.session_duration_minutes) ?? local.sessionDurationMinutes,
    weeklyFrequencyDays: clampFrequency(positiveNumber(row.weekly_frequency_days) ?? local.weeklyFrequencyDays),
    frictionArea: row.friction_area ?? local.frictionArea,
    frictionAreas,
    comfortLevel: normalizeComfortLevel(row.comfort_level) ?? local.comfortLevel,
    primaryGoal: normalizePrimaryGoal(row.goals?.[0]) ?? local.primaryGoal,
  };
}

/** Maps the goals being changed onto profiles columns. */
function toProfileColumns(goals: Partial<UserTrainingGoals>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if (goals.dailyQuestions !== undefined) columns.daily_question_goal = goals.dailyQuestions;
  if (goals.sessionDurationMinutes !== undefined) columns.session_duration_minutes = goals.sessionDurationMinutes;
  if (goals.weeklyFrequencyDays !== undefined) columns.weekly_frequency_days = goals.weeklyFrequencyDays;
  if (goals.frictionAreas !== undefined) columns.friction_areas = goals.frictionAreas;
  if (goals.frictionArea !== undefined) columns.friction_area = goals.frictionArea;
  if (goals.comfortLevel !== undefined) {
    columns.comfort_level = goals.comfortLevel;
    // The coach restarts every operation from the new Level, ignoring older workouts.
    columns.level_set_at = new Date().toISOString();
  }
  if (goals.primaryGoal !== undefined) columns.goals = [goals.primaryGoal];
  return columns;
}

/**
 * Retrieves the normalized user training goals.
 * With a userId, reads the profiles row and refreshes the phone copy; if Supabase
 * can't be reached, returns the phone copy instead.
 */
export async function getTrainingGoals(userId?: string): Promise<UserTrainingGoals> {
  const local = await readLocalTrainingGoals();
  if (!userId) return local.goals;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_GOAL_COLUMNS)
      .eq('id', userId)
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Profile not found');

    const row = data as ProfileGoalsRow;
    const merged = mergeProfileRow(row, local.goals);
    await AsyncStorage.setItem(STORAGE_KEYS.TRAINING_GOALS, JSON.stringify(merged)).catch(() => {});

    // Duration and frequency used to be saved on the phone only. Copy them up once
    // so the user's other devices get them too.
    const backfill: Partial<UserTrainingGoals> = {};
    if (row.session_duration_minutes == null && positiveNumber(local.stored?.sessionDurationMinutes)) {
      backfill.sessionDurationMinutes = local.goals.sessionDurationMinutes;
    }
    if (row.weekly_frequency_days == null && positiveNumber(local.stored?.weeklyFrequencyDays)) {
      backfill.weeklyFrequencyDays = local.goals.weeklyFrequencyDays;
    }
    if (Object.keys(backfill).length > 0) {
      supabase
        .from('profiles')
        .update(toProfileColumns(backfill))
        .eq('id', userId)
        .then(({ error: backfillError }) => {
          if (backfillError) console.warn('Goal backfill failed:', backfillError.message);
        });
    }

    return merged;
  } catch (err) {
    console.warn('Failed to load training goals from profile, using phone copy:', err);
    return local.goals;
  }
}

/**
 * Saves training goals with normalized numbers.
 * With a userId, the profiles row is updated first; the phone copy is only written
 * once that succeeds. Throws on failure, so callers can roll back and tell the user.
 */
export async function saveTrainingGoals(
  goals: Partial<UserTrainingGoals>,
  userId?: string
): Promise<UserTrainingGoals> {
  if (userId) {
    const columns = toProfileColumns(goals);
    if (Object.keys(columns).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update({ ...columns, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw new Error(error.message);
    }
  }

  const current = (await readLocalTrainingGoals()).goals;
  const updated: UserTrainingGoals = {
    dailyQuestions: goals.dailyQuestions ?? current.dailyQuestions,
    sessionDurationMinutes: goals.sessionDurationMinutes ?? current.sessionDurationMinutes,
    weeklyFrequencyDays: goals.weeklyFrequencyDays ?? current.weeklyFrequencyDays,
    frictionArea: goals.frictionArea ?? current.frictionArea,
    frictionAreas: goals.frictionAreas ?? current.frictionAreas,
    comfortLevel: goals.comfortLevel ?? current.comfortLevel,
    primaryGoal: goals.primaryGoal ?? current.primaryGoal,
  };

  await AsyncStorage.setItem(STORAGE_KEYS.TRAINING_GOALS, JSON.stringify(updated));

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