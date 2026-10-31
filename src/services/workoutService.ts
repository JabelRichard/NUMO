import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { QuestionAttemptResult, OperationType } from "../lib/math/types";
import { buildBreakdown, CoachWorkout, WorkoutBreakdown, WorkoutSource } from "../lib/coach";
import { withTimeout } from "../utils/withTimeout";

export const OUTBOX_KEY_PREFIX = "@numo_workout_outbox_v1:";

export interface WorkoutSessionPayload {
  operation: OperationType;
  difficulty: string;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy: number;
  total_time: number; // in milliseconds
  average_time_per_question: number; // in milliseconds
  source: WorkoutSource | null; // null = saved before the coach rebuild
  breakdown: WorkoutBreakdown | null; // per-operation results
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

/** A finished workout whose save failed, waiting in the per-user offline outbox. */
interface QueuedWorkout {
  queueId: string;
  attempts: QuestionAttemptResult[];
  mode: OperationType;
  difficulty: string;
  completedAt: string;
  source?: WorkoutSource; // missing on workouts queued by older app versions
}

/** The upload run in progress for each user, so callers during a run share it. */
const flushes = new Map<string, Promise<number>>();

/** Give up waiting for a save after this long and queue the workout instead. */
export const SAVE_TIMEOUT_MS = 8000;

export async function saveWorkoutSession(
  attempts: QuestionAttemptResult[],
  mode: OperationType,
  difficulty: string = "easy",
  explicitUserId?: string,
  completedAt?: string,
  source?: WorkoutSource
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
      source: source ?? null,
      breakdown: buildBreakdown(attempts),
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
  completedAt: string,
  source?: WorkoutSource
): Promise<void> {
  const outbox = await readOutbox(userId);
  outbox.push({
    queueId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attempts,
    mode,
    difficulty,
    completedAt,
    source,
  });
  await AsyncStorage.setItem(OUTBOX_KEY_PREFIX + userId, JSON.stringify(outbox));
}

export async function getQueuedWorkoutCount(userId: string): Promise<number> {
  return (await readOutbox(userId)).length;
}

/** Queued workouts in the coach's format, so a workout done offline still counts. */
export async function getQueuedWorkouts(userId: string): Promise<CoachWorkout[]> {
  return (await readOutbox(userId)).map((item) => {
    const correct = item.attempts.filter((a) => a.isCorrect).length;
    return {
      operation: item.mode,
      difficulty: item.difficulty,
      total_questions: item.attempts.length,
      correct_answers: correct,
      total_time: item.attempts.reduce((sum, a) => sum + (a.timeTakenMs || 0), 0),
      completed_at: item.completedAt,
      source: item.source ?? null,
      breakdown: buildBreakdown(item.attempts),
    };
  });
}

/**
 * Whether a workout finished at `completedAt` is already saved. A save can reach the
 * server even though the phone never heard back (timeout, lost connection), so a
 * queued workout is checked before it is sent again. Every save sends its finish
 * time, so user + finish time identifies a workout. Null when the check itself fails.
 */
async function isWorkoutSaved(userId: string, completedAt: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("completed_at", completedAt)
      .limit(1);
    if (error) return null;
    return (data?.length ?? 0) > 0;
  } catch {
    return null;
  }
}

/**
 * Tries to save every queued workout, oldest first, skipping any already saved.
 * Returns how many left the queue. A call while a run is going waits for that run.
 */
export function flushWorkoutOutbox(userId: string): Promise<number> {
  if (!userId) return Promise.resolve(0);
  const running = flushes.get(userId);
  if (running) return running;
  const run = flushOutbox(userId).finally(() => flushes.delete(userId));
  flushes.set(userId, run);
  return run;
}

async function flushOutbox(userId: string): Promise<number> {
  try {
    const queued = await readOutbox(userId);
    if (queued.length === 0) return 0;

    const syncedIds = new Set<string>();
    for (const item of queued) {
      const saved = await isWorkoutSaved(userId, item.completedAt);
      if (saved === null) break; // Still offline; keep the rest queued in order.
      if (!saved) {
        const { data, error } = await saveWorkoutSession(
          item.attempts,
          item.mode,
          item.difficulty,
          userId,
          item.completedAt,
          item.source
        );
        if (error || !data) break;
      }
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
  }
}

export type WorkoutSaveStatus = "saved" | "queued" | "failed";

/**
 * Saves a finished workout, or keeps it on the phone to upload later. Offline it goes
 * straight to the queue. Online it waits at most SAVE_TIMEOUT_MS; if the save fails
 * or takes longer, it is queued, and the upload later skips it if the slow save did
 * arrive. "failed" only if the phone couldn't store it either.
 */
export async function saveOrQueueWorkout(
  userId: string,
  attempts: QuestionAttemptResult[],
  mode: OperationType,
  difficulty: string,
  completedAt: string,
  source: WorkoutSource | undefined,
  online: boolean
): Promise<{ status: WorkoutSaveStatus; id?: string }> {
  if (online) {
    try {
      const { data, error } = await withTimeout(
        saveWorkoutSession(attempts, mode, difficulty, userId, completedAt, source),
        SAVE_TIMEOUT_MS
      );
      if (data && !error) return { status: "saved", id: data.id };
    } catch {
      // Timed out; queued below.
    }
  }

  try {
    await queueWorkoutForSync(userId, attempts, mode, difficulty, completedAt, source);
    return { status: "queued" };
  } catch (e) {
    console.warn("Failed to queue workout for later sync:", e);
    return { status: "failed" };
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
