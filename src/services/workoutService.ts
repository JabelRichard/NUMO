import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { QuestionAttemptResult, OperationType } from "../lib/math/types";

const OUTBOX_KEY_PREFIX = "@numo_workout_outbox_v1:";
const LAST_SUMMARY_KEY_PREFIX = "numo_last_workout_summary_v1:";

export interface WorkoutSessionPayload {
  operation: OperationType;
  difficulty: string;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy: number;
  total_time: number; // in milliseconds
  average_time_per_question: number; // in milliseconds
}

export interface WorkoutSessionRecord extends WorkoutSessionPayload {
  id: string;
  user_id: string;
  completed_at: string;
}

export interface WeeklyStats {
  solvedCount: number;
  totalTimeMs: number;
  avgTimePerQuestionMs: number;
}

/** Compact snapshot of a finished workout, cached per user for the "vs last workout" comparison. */
export interface WorkoutSummarySnapshot {
  accuracy: number;
  avgTimeSecs: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string;
}

/** A finished workout whose save failed, waiting in the per-user offline outbox. */
interface QueuedWorkout {
  queueId: string;
  attempts: QuestionAttemptResult[];
  mode: OperationType;
  difficulty: string;
  completedAt: string;
}

const flushingUsers = new Set<string>();

export async function saveWorkoutSession(
  attempts: QuestionAttemptResult[],
  mode: OperationType,
  difficulty: string = "easy",
  explicitUserId?: string,
  completedAt?: string
): Promise<{ data: WorkoutSessionRecord | null; error: Error | null }> {
  try {
    let targetUserId = explicitUserId;

    if (!targetUserId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error("User not authenticated.");
      }
      targetUserId = session.user.id;
    }

    const total_questions = attempts.length;
    const correct_answers = attempts.filter((a) => a.isCorrect).length;
    const incorrect_answers = total_questions - correct_answers;
    const accuracy =
      total_questions > 0
        ? parseFloat(((correct_answers / total_questions) * 100).toFixed(2))
        : 0;

    const total_time = attempts.reduce((sum, a) => sum + (a.timeTakenMs || 0), 0);
    const average_time_per_question =
      total_questions > 0
        ? parseFloat((total_time / total_questions).toFixed(2))
        : 0;

    const payload = {
      user_id: targetUserId,
      operation: mode,
      difficulty,
      total_questions,
      correct_answers,
      incorrect_answers,
      accuracy,
      total_time,
      average_time_per_question,
      // Preserve the real finish time for workouts synced later from the outbox.
      ...(completedAt ? { completed_at: completedAt } : {}),
    };

    const { data, error } = await supabase
      .from("workout_sessions")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return { data: data as WorkoutSessionRecord, error: null };
  } catch (error: any) {
    console.warn("Error saving workout session:", error?.message || error);
    return { data: null, error };
  }
}

// -------------------------------------------------------------
// Offline outbox: workouts whose save failed are retried later
// -------------------------------------------------------------

async function readOutbox(userId: string): Promise<QueuedWorkout[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY_PREFIX + userId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to read workout outbox:", e);
    return [];
  }
}

export async function queueWorkoutForSync(
  userId: string,
  attempts: QuestionAttemptResult[],
  mode: OperationType,
  difficulty: string,
  completedAt: string
): Promise<void> {
  const outbox = await readOutbox(userId);
  outbox.push({
    queueId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attempts,
    mode,
    difficulty,
    completedAt,
  });
  await AsyncStorage.setItem(OUTBOX_KEY_PREFIX + userId, JSON.stringify(outbox));
}

export async function getQueuedWorkoutCount(userId: string): Promise<number> {
  return (await readOutbox(userId)).length;
}

/** Tries to save every queued workout. Returns how many were synced. */
export async function flushWorkoutOutbox(userId: string): Promise<number> {
  if (!userId || flushingUsers.has(userId)) return 0;
  flushingUsers.add(userId);

  try {
    const queued = await readOutbox(userId);
    if (queued.length === 0) return 0;

    const syncedIds = new Set<string>();
    for (const item of queued) {
      const { data, error } = await saveWorkoutSession(
        item.attempts,
        item.mode,
        item.difficulty,
        userId,
        item.completedAt
      );
      if (error || !data) break; // Still offline; keep the rest queued in order.
      syncedIds.add(item.queueId);
    }

    if (syncedIds.size > 0) {
      // Re-read so workouts queued while we were flushing aren't dropped.
      const latest = await readOutbox(userId);
      const remaining = latest.filter((item) => !syncedIds.has(item.queueId));
      await AsyncStorage.setItem(OUTBOX_KEY_PREFIX + userId, JSON.stringify(remaining));
    }

    return syncedIds.size;
  } catch (err) {
    console.warn("Error flushing workout outbox:", err);
    return 0;
  } finally {
    flushingUsers.delete(userId);
  }
}

// -------------------------------------------------------------
// Last-workout summary cache (scoped per user)
// -------------------------------------------------------------

export function summarizeAttempts(
  attempts: QuestionAttemptResult[],
  completedAt: string
): WorkoutSummarySnapshot {
  const totalQuestions = attempts.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const totalTimeMs = attempts.reduce((sum, a) => sum + (a.timeTakenMs || 0), 0);

  return {
    accuracy: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
    avgTimeSecs:
      totalQuestions > 0 && totalTimeMs > 0
        ? parseFloat((totalTimeMs / totalQuestions / 1000).toFixed(1))
        : 1.8,
    correctCount,
    totalQuestions,
    completedAt,
  };
}

export async function getLastWorkoutSummary(userId: string): Promise<WorkoutSummarySnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SUMMARY_KEY_PREFIX + userId);
    return raw ? (JSON.parse(raw) as WorkoutSummarySnapshot) : null;
  } catch {
    return null;
  }
}

export async function setLastWorkoutSummary(
  userId: string,
  summary: WorkoutSummarySnapshot
): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SUMMARY_KEY_PREFIX + userId, JSON.stringify(summary));
  } catch (e) {
    console.warn("Failed to cache last workout summary:", e);
  }
}

export async function getWeeklyStats(): Promise<WeeklyStats> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return { solvedCount: 0, totalTimeMs: 0, avgTimePerQuestionMs: 0 };
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMon = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMon);
    startOfWeek.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("workout_sessions")
      .select("correct_answers, total_time, total_questions")
      .eq("user_id", session.user.id)
      .gte("completed_at", startOfWeek.toISOString());

    if (error) throw error;
    if (!data || data.length === 0) {
      return { solvedCount: 0, totalTimeMs: 0, avgTimePerQuestionMs: 0 };
    }

    const solvedCount = data.reduce((acc: number, row) => acc + (row.correct_answers || 0), 0);
    const totalTimeMs = data.reduce((acc: number, row) => acc + (row.total_time || 0), 0);
    const totalQuestions = data.reduce((acc: number, row) => acc + (row.total_questions || 0), 0);

    const avgTimePerQuestionMs = totalQuestions > 0 ? totalTimeMs / totalQuestions : 0;

    return { solvedCount, totalTimeMs, avgTimePerQuestionMs };
  } catch (err: any) {
    if (
      err?.name === "AuthSessionMissingError" ||
      err?.message?.includes("Auth session missing")
    ) {
      return { solvedCount: 0, totalTimeMs: 0, avgTimePerQuestionMs: 0 };
    }

    throw err;
  }
}

export async function getRecentWorkouts(): Promise<WorkoutSessionRecord[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return [];

    const { data, error } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("completed_at", { ascending: false })
      .limit(4);

    if (error) throw error;
    return (data || []) as WorkoutSessionRecord[];
  } catch (err: any) {
    if (
      err?.name === "AuthSessionMissingError" ||
      err?.message?.includes("Auth session missing")
    ) {
      return [];
    }

    throw err;
  }
}

export async function fetchAllWorkouts(userId: string): Promise<WorkoutSessionRecord[]> {
  try {
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("completed_at", { ascending: true });

    if (error) throw error;
    return (data || []) as WorkoutSessionRecord[];
  } catch (err: any) {
    if (
      err?.name === "AuthSessionMissingError" ||
      err?.message?.includes("Auth session missing")
    ) {
      return [];
    }

    throw err;
  }
}

// -------------------------------------------------------------
// 3-Stage Recommendation State Machine
// -------------------------------------------------------------

export type FocusOperation = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';
export type RecommendationStage = 'baseline' | 'tour' | 'coach';

export interface NextFocusRecommendation {
  targetOp: FocusOperation;
  stage: RecommendationStage;
  heading: string;
  subheading: string;
  coachOpName: string;
}

export function getNextFocus(workouts: any[]): NextFocusRecommendation {
  if (!workouts || workouts.length === 0) {
    return {
      targetOp: 'mixed',
      stage: 'baseline',
      heading: "Let's find your baseline.",
      subheading: 'Start with a balanced challenge so NUMO can learn how you solve.',
      coachOpName: 'Mixed Challenge',
    };
  }

  const categories: Record<FocusOperation, { label: string; totalQ: number; correct: number; totalTimeMs: number }> = {
    addition: { label: 'Addition', totalQ: 0, correct: 0, totalTimeMs: 0 },
    subtraction: { label: 'Subtraction', totalQ: 0, correct: 0, totalTimeMs: 0 },
    multiplication: { label: 'Multiplication', totalQ: 0, correct: 0, totalTimeMs: 0 },
    division: { label: 'Division', totalQ: 0, correct: 0, totalTimeMs: 0 },
    mixed: { label: 'Mixed Challenge', totalQ: 0, correct: 0, totalTimeMs: 0 },
  };

  workouts.forEach((w) => {
    let rawOp = (w.operation || 'mixed').toLowerCase();
    if (rawOp === 'adaptive_mix') rawOp = 'mixed';
    if (!categories[rawOp as FocusOperation]) return;

    const opKey = rawOp as FocusOperation;
    categories[opKey].totalQ += Number(w.total_questions) || 0;
    categories[opKey].correct += Number(w.correct_answers) || 0;
    categories[opKey].totalTimeMs += Number(w.total_time) || 0;
  });

  const parsed = (Object.keys(categories) as FocusOperation[]).map((key) => {
    const data = categories[key];
    const acc = data.totalQ > 0 ? (data.correct / data.totalQ) * 100 : 0;
    const avgPace = data.totalQ > 0 ? data.totalTimeMs / data.totalQ / 1000 : 0;
    const friction = data.totalQ > 0 ? (100 - acc) * 1.4 + avgPace * 3.5 : -1;
    const mastery = data.totalQ > 0 ? acc * 0.7 + Math.max(0, 10 - avgPace) * 3 : 0;

    return {
      key,
      name: data.label,
      totalQ: data.totalQ,
      accuracy: acc,
      avgPace,
      frictionScore: friction,
      masteryScore: mastery,
    };
  });

  // STAGE 1: Baseline Check (Under 20 questions in Mixed)
  if (categories.mixed.totalQ < 20 && workouts.length < 2) {
    return {
      targetOp: 'mixed',
      stage: 'baseline',
      heading: "Let's find your baseline.",
      subheading: 'Start with a balanced challenge so NUMO can learn how you solve.',
      coachOpName: 'Mixed Challenge',
    };
  }

  // STAGE 2: Core Onboarding Tour (Addition -> Subtraction -> Multiplication -> Division)
  const tourOrder: FocusOperation[] = ['addition', 'subtraction', 'multiplication', 'division'];
  const nextTourOp = tourOrder.find((op) => categories[op].totalQ < 10);

  if (nextTourOp) {
    const opInfo = categories[nextTourOp];
    return {
      targetOp: nextTourOp,
      stage: 'tour',
      heading: `Explore ${opInfo.label}`,
      subheading: `Try ${opInfo.label} to complete your placement tour.`,
      coachOpName: opInfo.label,
    };
  }

  // STAGE 3: Smart Coach Mode (All 4 core operations tested)
  const coreTested = parsed.filter((p) => p.key !== 'mixed' && p.totalQ >= 10);
  const sortedByFriction = [...coreTested].sort((a, b) => b.frictionScore - a.frictionScore);
  const weakest = sortedByFriction[0];

  const sortedByMastery = [...coreTested].sort((a, b) => b.masteryScore - a.masteryScore);
  const strongest = sortedByMastery[0];

  if (weakest && weakest.key !== strongest.key) {
    return {
      targetOp: weakest.key,
      stage: 'coach',
      heading: `Coach's Choice: ${weakest.name}`,
      subheading: `Targeted session to sharpen your ${weakest.name.toLowerCase()} speed and accuracy.`,
      coachOpName: weakest.name,
    };
  }

  return {
    targetOp: 'mixed',
    stage: 'coach',
    heading: "Coach's Choice: Mixed Challenge",
    subheading: 'Your operations are balanced. Test your speed across all modes.',
    coachOpName: 'Mixed Challenge',
  };
}