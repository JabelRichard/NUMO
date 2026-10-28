import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation, DifficultyLevel } from '../math/types';
import { focusLabel } from './copy';
import { accuracyOf, normalizeDifficulty, normalizeOperation, sortNewestFirst, toEntries } from './entries';
import { fromWorkoutParams } from './params';
import { getOperationStats } from './stats';
import { CoachWorkout, WorkoutRequest } from './types';

// What the Results screen says about one finished round: how it compares with the
// last round like it, and a verdict on speed measured against the user's own pace.

/** Earlier rounds needed (per operation, at that level) before speed is judged. */
export const MIN_ROUNDS_FOR_SPEED = 2;
/** Up to 5% slower than usual still counts as "quick". */
const QUICK_RATIO = 1.05;
/** 10% faster than usual counts as "fast" ("Fast, but check your answers"). */
const FAST_RATIO = 0.9;
/** "Faster than last time" needs at least 5% less time per question. */
const FASTER_THAN_LAST_RATIO = 0.95;

type Levels = Partial<Record<CoreOperation, DifficultyLevel>>;

/** The operations in a round and the level of each. Mixed rows without a breakdown give null. */
function levelsOf(workout: CoachWorkout): Levels | null {
  const operation = normalizeOperation(workout.operation);
  if (operation !== 'mixed') return { [operation]: normalizeDifficulty(workout.difficulty) };
  const levels: Levels = {};
  for (const op of CORE_OPERATIONS) {
    const part = workout.breakdown?.[op];
    if (part && Number(part.questions) > 0) levels[op] = normalizeDifficulty(part.difficulty);
  }
  return Object.keys(levels).length > 0 ? levels : null;
}

/** Same operation at the same level; a mix needs the same operations, each at the same level. */
export function isSameKindOfRound(a: CoachWorkout, b: CoachWorkout): boolean {
  if (normalizeOperation(a.operation) !== normalizeOperation(b.operation)) return false;
  const la = levelsOf(a);
  const lb = levelsOf(b);
  if (!la || !lb) return false;
  const ops = Object.keys(la) as CoreOperation[];
  return ops.length === Object.keys(lb).length && ops.every((op) => la[op] === lb[op]);
}

/** The newest earlier round of the same kind, or null the first time. */
export function findLastComparable(history: CoachWorkout[], current: CoachWorkout): CoachWorkout | null {
  return sortNewestFirst(history).find((w) => Number(w.total_questions) > 0 && isSameKindOfRound(w, current)) ?? null;
}

const msPerQuestion = (w: CoachWorkout) =>
  Number(w.total_time) > 0 && Number(w.total_questions) > 0 ? Number(w.total_time) / Number(w.total_questions) : null;

export interface RoundComparison {
  /** better = green; same, lower and first = neutral gray. */
  tone: 'better' | 'same' | 'lower' | 'first';
  text: string;
}

/** "First time on ÷ Dividing · Hard. Next time you'll see your progress." */
export function firstTimeText(current: CoachWorkout): string {
  const operation = normalizeOperation(current.operation);
  if (operation === 'mixed') return "First time mixing at these levels. Next time you'll see your progress.";
  return `First time on ${focusLabel(operation, normalizeDifficulty(current.difficulty))}. Next time you'll see your progress.`;
}

/**
 * One line comparing this round with the last one like it. Score comes first;
 * speed only decides when the score is the same.
 */
export function compareWithLast(current: CoachWorkout, last: CoachWorkout | null): RoundComparison {
  if (!last) return { tone: 'first', text: firstTimeText(current) };

  if (Number(current.total_questions) === Number(last.total_questions)) {
    const diff = Number(current.correct_answers) - Number(last.correct_answers);
    if (diff > 0) return { tone: 'better', text: `↑ ${diff} more correct than last time` };
    if (diff < 0) return { tone: 'lower', text: 'A bit lower than last time' };
  } else {
    const now = Math.round(accuracyOf(Number(current.correct_answers), Number(current.total_questions)));
    const before = Math.round(accuracyOf(Number(last.correct_answers), Number(last.total_questions)));
    if (now > before) return { tone: 'better', text: `Up from ${before}% to ${now}% correct` };
    if (now < before) return { tone: 'lower', text: `Down from ${before}% to ${now}% correct` };
  }

  const nowMs = msPerQuestion(current);
  const beforeMs = msPerQuestion(last);
  if (nowMs !== null && beforeMs !== null && nowMs <= beforeMs * FASTER_THAN_LAST_RATIO) {
    return { tone: 'better', text: 'Faster than last time' };
  }
  return { tone: 'same', text: 'About the same as last time' };
}

/**
 * The user's usual time per question for a round like this one, from their own history
 * at the same levels. A mix weighs each operation by its questions in this round.
 * Null when any operation has fewer than 2 timed earlier rounds at that level.
 */
export function usualMsPerQuestion(history: CoachWorkout[], current: CoachWorkout): number | null {
  const levels = levelsOf(current);
  if (!levels) return null;
  const entries = sortNewestFirst(history)
    .flatMap(toEntries)
    .filter((e) => e.timeMs > 0);

  // Rows saved before breakdowns existed are single-operation: all questions count.
  const hasBreakdown = CORE_OPERATIONS.some((op) => Number(current.breakdown?.[op]?.questions) > 0);
  let expectedMs = 0;
  let questions = 0;
  for (const op of Object.keys(levels) as CoreOperation[]) {
    const count = hasBreakdown ? Number(current.breakdown?.[op]?.questions) || 0 : Number(current.total_questions);
    if (count <= 0) continue;
    const stats = getOperationStats(op, entries.filter((e) => e.difficulty === levels[op]));
    if (stats.recent.length < MIN_ROUNDS_FOR_SPEED || stats.avgTimeMs <= 0) return null;
    expectedMs += count * stats.avgTimeMs;
    questions += count;
  }
  return questions > 0 ? expectedMs / questions : null;
}

export interface Verdict {
  title: string;
  desc: string;
}

/**
 * Accuracy plus speed against the user's own usual pace. With no usual pace yet
 * (or no timing for this round), it judges accuracy only.
 */
export function getVerdict(accuracy: number, msPerQ: number | null, usualMs: number | null): Verdict {
  if (msPerQ === null || usualMs === null || usualMs <= 0) {
    if (accuracy >= 90) return { title: 'Excellent accuracy', desc: 'Almost every answer was right. Great job!' };
    if (accuracy >= 80) return { title: 'Mostly right', desc: 'Check a couple of answers to reach 90%.' };
    return { title: 'Good practice', desc: 'Every round helps. Keep it up!' };
  }

  const ratio = msPerQ / usualMs;
  const quick = ratio <= QUICK_RATIO;
  if (accuracy >= 90 && quick) return { title: 'Fast and correct', desc: 'Quick and right. Great job!' };
  if (accuracy >= 80 && quick) {
    return { title: 'Quick and mostly right', desc: 'Great speed. Check a couple of answers to reach 90%.' };
  }
  if (accuracy >= 80) return { title: 'Right answers, steady pace', desc: 'Very accurate. Speed will come with practice.' };
  if (accuracy < 75 && ratio <= FAST_RATIO) {
    return { title: 'Fast, but check your answers', desc: 'Quicker than usual! Slow down a little to check each one.' };
  }
  return { title: 'Good practice', desc: 'Every round helps. Keep it up!' };
}

/**
 * "Same again": the same operation(s) at the same level(s) as this round. Used when
 * there is no history to plan from (offline, nothing cached). A warm-up repeats as a
 * normal coach round, never as another warm-up.
 */
export function sameAgainWorkout(current: CoachWorkout): WorkoutRequest | null {
  const levels = levelsOf(current);
  const total = Number(current.total_questions);
  if (!levels || total <= 0) return null;
  const ops = Object.keys(levels) as CoreOperation[];
  return fromWorkoutParams({
    mode: ops.length === 1 ? ops[0] : 'mixed',
    difficulty: normalizeDifficulty(current.difficulty),
    count: String(total),
    ops: ops.join(','),
    levels: ops.map((op) => `${op}:${levels[op]}`).join(','),
    source: current.source === 'warmup' || !current.source ? 'coach' : current.source,
    kind: ops.length === 1 ? 'daily' : 'mix',
  });
}
