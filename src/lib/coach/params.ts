import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation, DifficultyLevel } from '../math/types';
import { focusLabel, COPY } from './copy';
import { normalizeDifficulty, normalizeOperation } from './entries';
import { CoachWorkoutKind, WorkoutRequest, WorkoutSource } from './types';

// The workout screen gets everything it needs as route params (strings only).

export type WorkoutRouteParams = {
  mode: string;
  difficulty: string;
  count: string;
  ops: string;
  levels: string;
  source: WorkoutSource;
  kind: CoachWorkoutKind;
};

/** The level saved in workout_sessions.difficulty: the most common one in the round. */
export function mainDifficulty(request: Pick<WorkoutRequest, 'operations' | 'difficultyByOperation'>): DifficultyLevel {
  const counts = new Map<DifficultyLevel, number>();
  for (const op of request.operations) {
    const level = request.difficultyByOperation[op] ?? 'easy';
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  let best: DifficultyLevel = 'easy';
  let bestCount = 0;
  for (const [level, count] of counts) {
    if (count > bestCount) {
      best = level;
      bestCount = count;
    }
  }
  return best;
}

export function toWorkoutParams(request: WorkoutRequest): WorkoutRouteParams {
  return {
    mode: request.operation,
    difficulty: mainDifficulty(request),
    count: String(request.questionCount),
    ops: request.operations.join(','),
    levels: request.operations.map((op) => `${op}:${request.difficultyByOperation[op] ?? 'easy'}`).join(','),
    source: request.source,
    kind: request.kind,
  };
}

const SOURCES: WorkoutSource[] = ['warmup', 'coach', 'manual'];
const KINDS: CoachWorkoutKind[] = ['warmup', 'daily', 'mix'];

/**
 * Reads the params back. Links without the new params (e.g. the demo) fall back to
 * `mode` / `difficulty`, and count as manual so they never move the coach's levels.
 */
export function fromWorkoutParams(params: Partial<Record<keyof WorkoutRouteParams, string>>): WorkoutRequest {
  const operation = normalizeOperation(params.mode);
  const listed = (params.ops ?? '')
    .split(',')
    .filter((op): op is CoreOperation => (CORE_OPERATIONS as string[]).includes(op));
  const operations = listed.length > 0 ? listed : operation === 'mixed' ? CORE_OPERATIONS : [operation as CoreOperation];

  const fallback = normalizeDifficulty(params.difficulty);
  const parsedLevels = new Map(
    (params.levels ?? '').split(',').map((pair) => pair.split(':') as [string, string])
  );
  const difficultyByOperation = Object.fromEntries(
    operations.map((op) => [op, parsedLevels.has(op) ? normalizeDifficulty(parsedLevels.get(op)) : fallback])
  ) as Partial<Record<CoreOperation, DifficultyLevel>>;

  const count = parseInt(params.count ?? '', 10);
  const source = SOURCES.includes(params.source as WorkoutSource) ? (params.source as WorkoutSource) : 'manual';
  const kind = KINDS.includes(params.kind as CoachWorkoutKind)
    ? (params.kind as CoachWorkoutKind)
    : operation === 'mixed'
    ? 'mix'
    : 'daily';

  return {
    kind,
    source,
    operation: operations.length === 1 ? operations[0] : 'mixed',
    operations,
    difficultyByOperation,
    questionCount: Number.isFinite(count) && count > 0 ? count : 0,
  };
}

/** Title on the workout screen: "Warm-up · 10 questions", "× Multiplying · Medium", "Mix it up". */
export function workoutTitle(request: WorkoutRequest, questionCount: number): string {
  if (request.kind === 'warmup' || request.source === 'warmup') return COPY.warmupTitle(questionCount);
  if (request.operation === 'mixed') return request.kind === 'mix' ? COPY.mixHeading : focusLabel('mixed');
  return focusLabel(request.operation, request.difficultyByOperation[request.operation]);
}
