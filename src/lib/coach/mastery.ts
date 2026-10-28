import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation } from '../math/types';
import { FrictionArea } from '../../types/profile';
import { localDayKey } from '../../utils/localDates';
import { LevelState, STRONG_ACCURACY } from './difficulty';
import { accuracyOf } from './entries';
import { OperationStats, pickWeakest } from './stats';
import { CoachOperation } from './types';

// "Graduation": an operation in the plan is mastered, so suggest the next one.

export const MASTERY_ROUNDS = 5;
export const MASTERY_MIN_DAYS = 2;

/**
 * Mastered = on Hard, and the last 5 counted rounds on it at Hard were strong (85%+),
 * done on at least 2 different days. Counted rounds are the same ones that move the
 * level: coach rounds with 5+ questions on the operation, never manual ones.
 */
export function isMastered(state: LevelState, op: CoreOperation): boolean {
  if (state.levels[op] !== 'hard') return false;
  const rounds = state.counted[op].filter((e) => e.difficulty === 'hard').slice(0, MASTERY_ROUNDS);
  return (
    rounds.length === MASTERY_ROUNDS &&
    rounds.every((e) => accuracyOf(e.correct, e.questions) >= STRONG_ACCURACY) &&
    new Set(rounds.map((e) => localDayKey(new Date(e.completedAt)))).size >= MASTERY_MIN_DAYS
  );
}

export const masteredOperations = (state: LevelState): CoreOperation[] =>
  CORE_OPERATIONS.filter((op) => isMastered(state, op));

/**
 * The operation to add after a graduation: the weakest one not in the plan and not
 * already mastered, from mixes and "Try something new" rounds. With no data,
 * the order + → − → × → ÷.
 */
export function suggestNextOperation(
  chosen: CoreOperation[],
  mastered: CoreOperation[],
  statsFor: (op: CoachOperation) => OperationStats
): CoreOperation | null {
  const candidates = CORE_OPERATIONS.filter((op) => !chosen.includes(op) && !mastered.includes(op));
  if (candidates.length === 0) return null;
  return pickWeakest(candidates, statsFor) as CoreOperation;
}

/** "Yes" on the graduation question: the new operation goes first, the rest stay. */
export function addToPlan(frictionAreas: FrictionArea[] | null | undefined, op: CoreOperation): FrictionArea[] {
  return [op, ...(frictionAreas ?? []).filter((area) => area !== op)];
}
