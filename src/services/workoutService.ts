import { supabase } from "../lib/supabase"; // Ensure this points to your configured Supabase client
import { QuestionAttemptResult, OperationType } from "../lib/math/types";

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

/**
 * Saves a completed workout session to Supabase
 */
export async function saveWorkoutSession(
  attempts: QuestionAttemptResult[],
  mode: OperationType,
  difficulty: string = "easy",
): Promise<{ data: WorkoutSessionRecord | null; error: Error | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated.");
    }

    const total_questions = attempts.length;
    const correct_answers = attempts.filter((a) => a.isCorrect).length;
    const incorrect_answers = total_questions - correct_answers;
    const accuracy =
      total_questions > 0
        ? parseFloat(((correct_answers / total_questions) * 100).toFixed(2))
        : 0;

    const total_time = attempts.reduce((sum, a) => sum + a.timeTakenMs, 0);
    const average_time_per_question =
      total_questions > 0
        ? parseFloat((total_time / total_questions).toFixed(2))
        : 0;

    const payload = {
      user_id: user.id,
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
    console.error("Error saving workout session:", error);
    return { data: null, error };
  }
}

/**
 * Calculates current calendar week statistics for the authenticated user
 */
export async function getWeeklyStats(): Promise<WeeklyStats> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { solvedCount: 0, totalTimeMs: 0, avgTimePerQuestionMs: 0 };

    // Get current calendar week start (Monday at 00:00:00)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ...
    const distanceToMon = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMon);
    startOfWeek.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("workout_sessions")
      .select("correct_answers, total_time, total_questions")
      .eq("user_id", user.id)
      .gte("completed_at", startOfWeek.toISOString());

    if (error || !data || data.length === 0) {
      return { solvedCount: 0, totalTimeMs: 0, avgTimePerQuestionMs: 0 };
    }

    const solvedCount = data.reduce(
      (acc: number, row) => acc + row.correct_answers,
      0,
    );
    const totalTimeMs = data.reduce(
      (acc: number, row) => acc + row.total_time,
      0,
    );
    const totalQuestions = data.reduce(
      (acc: number, row) => acc + row.total_questions,
      0,
    );

    const avgTimePerQuestionMs =
      totalQuestions > 0 ? totalTimeMs / totalQuestions : 0;

    return { solvedCount, totalTimeMs, avgTimePerQuestionMs };
  } catch (err) {
    console.error("Failed to fetch weekly stats:", err);
    return { solvedCount: 0, totalTimeMs: 0, avgTimePerQuestionMs: 0 };
  }
}

/**
 * Fetches the user's latest 4 completed workouts
 */
export async function getRecentWorkouts(): Promise<WorkoutSessionRecord[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(4);

    if (error || !data) return [];

    return data as WorkoutSessionRecord[];
  } catch (err) {
    console.error("Failed to fetch recent workouts:", err);
    return [];
  }
}
