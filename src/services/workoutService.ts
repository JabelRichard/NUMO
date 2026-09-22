import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { QuestionAttemptResult, OperationType } from "../lib/math/types";

const PENDING_DEMO_KEY = "@numo_pending_demo_workout";

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

export interface PendingDemoSession {
  attempts: QuestionAttemptResult[];
  mode: OperationType;
  difficulty: string;
  completedAt: string;
}

// In-memory fallback & concurrency lock
let inMemoryPendingDemo: PendingDemoSession | null = null;
let isSyncingDemo = false;

/**
 * Stores a completed demo workout locally while the user creates an account / signs in
 */
export async function setPendingDemoSession(
  attempts: QuestionAttemptResult[],
  mode: OperationType = "mixed" as OperationType,
  difficulty: string = "easy"
): Promise<void> {
  const pendingData: PendingDemoSession = {
    attempts,
    mode,
    difficulty,
    completedAt: new Date().toISOString(),
  };

  inMemoryPendingDemo = pendingData;
  try {
    await AsyncStorage.setItem(PENDING_DEMO_KEY, JSON.stringify(pendingData));
  } catch (e) {
    console.warn("Failed to store pending demo session in AsyncStorage:", e);
  }
}

/**
 * Retrieves the pending demo workout if one exists
 */
export async function getPendingDemoSession(): Promise<PendingDemoSession | null> {
  if (inMemoryPendingDemo) return inMemoryPendingDemo;
  try {
    const raw = await AsyncStorage.getItem(PENDING_DEMO_KEY);
    return raw ? (JSON.parse(raw) as PendingDemoSession) : null;
  } catch (e) {
    console.warn("Failed to retrieve pending demo session:", e);
    return null;
  }
}

/**
 * Clears the pending demo workout
 */
export async function clearPendingDemoSession(): Promise<void> {
  inMemoryPendingDemo = null;
  try {
    await AsyncStorage.removeItem(PENDING_DEMO_KEY);
  } catch (e) {
    console.warn("Failed to clear pending demo session:", e);
  }
}

/**
 * Saves a completed workout session to Supabase (authenticated user)
 */
export async function saveWorkoutSession(
  attempts: QuestionAttemptResult[],
  mode: OperationType,
  difficulty: string = "easy",
  explicitUserId?: string
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

/**
 * Syncs and saves any pending demo session once the user logs in or signs up.
 * Includes concurrency locking to prevent duplicate insertions.
 */
export async function syncPendingDemoWorkout(userId: string): Promise<boolean> {
  if (isSyncingDemo || !userId) return false;

  try {
    isSyncingDemo = true;
    const pendingSession = await getPendingDemoSession();

    if (!pendingSession || !pendingSession.attempts || pendingSession.attempts.length === 0) {
      isSyncingDemo = false;
      return false;
    }

    // Clear local storage first to prevent duplicate attempts if re-triggered
    await clearPendingDemoSession();

    const { data, error } = await saveWorkoutSession(
      pendingSession.attempts,
      pendingSession.mode,
      pendingSession.difficulty,
      userId
    );

    if (error || !data) {
      console.warn("Failed to sync pending demo workout to Supabase:", error?.message || error);
      await setPendingDemoSession(
        pendingSession.attempts,
        pendingSession.mode,
        pendingSession.difficulty
      );
      isSyncingDemo = false;
      return false;
    }

    isSyncingDemo = false;
    return true;
  } catch (err) {
    console.warn("Error during demo workout sync:", err);
    isSyncingDemo = false;
    return false;
  }
}

/**
 * Calculates current calendar week statistics for the authenticated user
 */
export async function getWeeklyStats(): Promise<WeeklyStats> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If there is no active session yet, return empty stats without throwing
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

    // Re-throw genuine network errors so screens can trigger the offline view
    throw err;
  }
}

/**
 * Fetches the user's latest 4 completed workouts
 */
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

    // Re-throw genuine network errors so screens can trigger the offline view
    throw err;
  }
}