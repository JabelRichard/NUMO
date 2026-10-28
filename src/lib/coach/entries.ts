import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation, DifficultyLevel, QuestionAttemptResult } from '../math/types';
import { CoachOperation, CoachWorkout, OperationResult, WorkoutBreakdown, WorkoutSource } from './types';

/** One operation's part of one workout. A mixed workout gives one entry per operation it covered. */
export interface OperationEntry {
  operation: CoachOperation;
  questions: number;
  correct: number;
  timeMs: number;
  difficulty: DifficultyLevel;
  completedAt: number;
  source: WorkoutSource | null;
  /** Part of a round over 2+ operations (a mix or a warm-up). */
  fromMix: boolean;
}

export function normalizeOperation(raw: string | null | undefined): CoachOperation {
  const op = (raw || 'mixed').toLowerCase();
  return (CORE_OPERATIONS as string[]).includes(op) ? (op as CoreOperation) : 'mixed';
}

export function normalizeDifficulty(raw: string | null | undefined): DifficultyLevel {
  return raw === 'medium' || raw === 'hard' ? raw : 'easy';
}

const timeOf = (w: CoachWorkout) => new Date(w.completed_at).getTime() || 0;

export function sortNewestFirst(workouts: CoachWorkout[]): CoachWorkout[] {
  return [...workouts].sort((a, b) => timeOf(b) - timeOf(a));
}

/**
 * Splits a workout into per-operation entries.
 * Rows with a breakdown give one entry per operation; older mixed rows only count as "mixed".
 * Mixed rounds (not warm-ups) also count as practice for "Mixing them up".
 */
export function toEntries(workout: CoachWorkout): OperationEntry[] {
  const operation = normalizeOperation(workout.operation);
  const base = {
    completedAt: timeOf(workout),
    source: workout.source ?? null,
    fromMix: false,
  };

  const whole: OperationEntry = {
    ...base,
    operation,
    questions: Number(workout.total_questions) || 0,
    correct: Number(workout.correct_answers) || 0,
    timeMs: Number(workout.total_time) || 0,
    difficulty: normalizeDifficulty(workout.difficulty),
  };

  const parts = Object.entries(workout.breakdown ?? {}) as [CoreOperation, OperationResult][];
  const fromBreakdown = parts
    .filter(([op, part]) => CORE_OPERATIONS.includes(op) && part && Number(part.questions) > 0)
    .map(([op, part]) => ({
      ...base,
      operation: op,
      questions: Number(part.questions) || 0,
      correct: Number(part.correct) || 0,
      timeMs: Number(part.timeMs) || 0,
      difficulty: normalizeDifficulty(part.difficulty),
    }));

  if (fromBreakdown.length === 0) return whole.questions > 0 ? [whole] : [];
  if (fromBreakdown.length > 1) fromBreakdown.forEach((part) => (part.fromMix = true));
  if (operation === 'mixed' && workout.source !== 'warmup') return [...fromBreakdown, whole];
  return fromBreakdown;
}

/** Per-operation totals for a finished round, saved as workout_sessions.breakdown. */
export function buildBreakdown(attempts: QuestionAttemptResult[]): WorkoutBreakdown {
  const breakdown: WorkoutBreakdown = {};
  for (const attempt of attempts) {
    const op = attempt.question?.operation;
    if (!op || !CORE_OPERATIONS.includes(op)) continue;
    const part = (breakdown[op] ??= {
      questions: 0,
      correct: 0,
      timeMs: 0,
      difficulty: normalizeDifficulty(attempt.question.difficulty),
    });
    part.questions += 1;
    part.correct += attempt.isCorrect ? 1 : 0;
    part.timeMs += attempt.timeTakenMs || 0;
  }
  return breakdown;
}

export const accuracyOf = (correct: number, questions: number) =>
  questions > 0 ? (correct / questions) * 100 : 0;
