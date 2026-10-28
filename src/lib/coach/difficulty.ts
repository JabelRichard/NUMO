import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation, DifficultyLevel } from '../math/types';
import { comfortToDifficulty, normalizeComfortLevel } from '../../types/profile';
import { accuracyOf, OperationEntry, sortNewestFirst, toEntries } from './entries';
import { CoachPlanInput, CoachWorkout, OperationLevels } from './types';

export const STRONG_ACCURACY = 85;
export const WEAK_ACCURACY = 60;
export const STREAK_TO_MOVE = 3;
// A round needs this many questions on an operation to count toward its level.
// In mixes, an operation's few questions are pooled across rounds until they reach it.
export const MIN_QUESTIONS_TO_COUNT = 5;

const LEVEL_ORDER: DifficultyLevel[] = ['easy', 'medium', 'hard'];

const stepUp = (level: DifficultyLevel) => LEVEL_ORDER[Math.min(2, LEVEL_ORDER.indexOf(level) + 1)];
const stepDown = (level: DifficultyLevel) => LEVEL_ORDER[Math.max(0, LEVEL_ORDER.indexOf(level) - 1)];

/** Two mix parts judged as one round; it's dated when the newer part was played. */
const combine = (older: OperationEntry, newer: OperationEntry): OperationEntry => ({
  ...newer,
  questions: older.questions + newer.questions,
  correct: older.correct + newer.correct,
  timeMs: older.timeMs + newer.timeMs,
});

export interface LevelState {
  levels: OperationLevels;
  /** Rounds that counted toward each operation's level, newest first. Pooled mix parts appear as one round. */
  counted: Record<CoreOperation, OperationEntry[]>;
}

/**
 * Works out each operation's current level by replaying the history, oldest first.
 *
 * Start: the Level (comfort_level). Users without one (signed up before it existed)
 * start each operation at the level of their most recent older workout on it.
 *
 * Moves: up after 3 strong rounds in a row (85%+) at the current level, down after
 * 3 weak rounds in a row (under 60%). One step at a time. Rounds at another level
 * are skipped, and manual Training rounds never count.
 *
 * A round counts with 5+ questions on the operation. Mixes often have fewer, so an
 * operation's mix questions are pooled, in the order played, until there are 5+;
 * then they're judged together as one round. Each question is used once, and the
 * newest few wait in the pool for the next mix.
 */
export function getLevelState(workouts: CoachWorkout[], plan: CoachPlanInput): LevelState {
  const comfort = normalizeComfortLevel(plan.comfortLevel);
  const levelSetAt = plan.levelSetAt ? new Date(plan.levelSetAt).getTime() || 0 : 0;

  const entriesByOp = Object.fromEntries(CORE_OPERATIONS.map((op) => [op, [] as OperationEntry[]])) as Record<
    CoreOperation,
    OperationEntry[]
  >;
  for (const workout of sortNewestFirst(workouts).reverse()) {
    for (const entry of toEntries(workout)) {
      if (entry.operation !== 'mixed') entriesByOp[entry.operation].push(entry);
    }
  }

  const levels = {} as OperationLevels;
  const counted = {} as Record<CoreOperation, OperationEntry[]>;

  for (const op of CORE_OPERATIONS) {
    const entries = entriesByOp[op];
    let level: DifficultyLevel;
    let replay: OperationEntry[];

    if (comfort) {
      level = comfortToDifficulty(comfort);
      replay = entries.filter((e) => e.completedAt > levelSetAt);
    } else {
      // Older account: anchor on the newest pre-coach workout, then replay coach rounds after it.
      const lastLegacy = [...entries].reverse().find((e) => e.source === null);
      level = lastLegacy ? lastLegacy.difficulty : 'easy';
      replay = entries.filter(
        (e) => e.source !== null && (!lastLegacy || e.completedAt > lastLegacy.completedAt)
      );
    }

    let strong = 0;
    let weak = 0;
    let pool: OperationEntry | null = null;
    const countedForOp: OperationEntry[] = [];

    for (const entry of replay) {
      if (entry.source === 'manual' || entry.difficulty !== level) continue;

      let round: OperationEntry;
      if (entry.questions >= MIN_QUESTIONS_TO_COUNT) {
        round = entry;
      } else if (entry.fromMix) {
        pool = pool ? combine(pool, entry) : entry;
        if (pool.questions < MIN_QUESTIONS_TO_COUNT) continue;
        round = pool;
        pool = null;
      } else {
        continue;
      }
      countedForOp.push(round);

      const accuracy = accuracyOf(round.correct, round.questions);
      if (accuracy >= STRONG_ACCURACY) {
        strong += 1;
        weak = 0;
      } else if (accuracy < WEAK_ACCURACY) {
        weak += 1;
        strong = 0;
      } else {
        strong = 0;
        weak = 0;
      }

      if (strong >= STREAK_TO_MOVE) {
        level = stepUp(level);
        strong = 0;
        pool = null;
      } else if (weak >= STREAK_TO_MOVE) {
        level = stepDown(level);
        weak = 0;
        pool = null;
      }
    }

    levels[op] = level;
    counted[op] = countedForOp.reverse();
  }

  return { levels, counted };
}

export function getOperationLevels(workouts: CoachWorkout[], plan: CoachPlanInput): OperationLevels {
  return getLevelState(workouts, plan).levels;
}

export interface LevelChange {
  operation: CoreOperation;
  from: DifficultyLevel;
  to: DifficultyLevel;
  direction: 'up' | 'down';
}

export function diffLevels(before: OperationLevels, after: OperationLevels): LevelChange[] {
  return CORE_OPERATIONS.filter((op) => before[op] !== after[op]).map((op) => ({
    operation: op,
    from: before[op],
    to: after[op],
    direction: LEVEL_ORDER.indexOf(after[op]) > LEVEL_ORDER.indexOf(before[op]) ? 'up' : 'down',
  }));
}
