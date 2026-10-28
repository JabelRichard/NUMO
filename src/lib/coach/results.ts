import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation } from '../math/types';
import { ComfortLevel, normalizeComfortLevel } from '../../types/profile';
import { chosenOperations, getCoachPlan, hasStartedPlan, isNotSure } from './coach';
import { COPY } from './copy';
import { diffLevels, getLevelState, LevelChange, STREAK_TO_MOVE } from './difficulty';
import { accuracyOf, sortNewestFirst, toEntries } from './entries';
import { masteredOperations, suggestNextOperation } from './mastery';
import { getOperationStats } from './stats';
import { CoachPlan, CoachPlanInput, CoachWorkout, OperationResult } from './types';

// "Not sure" users are asked about a focus after the warm-up, then every 5th workout.
export const ASK_FOCUS_EVERY = 5;
export const LEVEL_PROMPT_COOLDOWN_DAYS = 7;
export const GRADUATION_PROMPT_COOLDOWN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ResultsFeedback {
  subtitle: string;
  /** "Nice start! ÷ Dividing was the trickiest. We'll practice that next." */
  learned: string | null;
  levelChanges: (LevelChange & { text: string })[];
  /** For "Not sure" users: Yes saves it to friction_areas. */
  focusQuestion: { operation: CoreOperation; text: string } | null;
  /** Yes updates comfort_level; Not now waits at least a week. */
  levelSuggestion: { level: ComfortLevel; text: string } | null;
  /** "Want to add × Multiplying to your plan?" after + Adding is mastered. Yes adds it; Not now waits a week. */
  graduation: { mastered: CoreOperation; operation: CoreOperation; text: string } | null;
  /** Operations mastered by this workout ("You've mastered + Adding! 🎉"). */
  newlyMastered: CoreOperation[];
  /** "You've mastered everything! 🏆", once, on the workout that finished the set. */
  allMastered: string | null;
  /** True only on the workout that reached today's goal (not on bonus rounds after it). */
  goalJustDone: boolean;
  /** What the coach recommends next, including this workout. */
  next: CoachPlan;
}

export interface ResultsFeedbackInput {
  plan: CoachPlanInput;
  /** Earlier workouts, without the one just finished. */
  history: CoachWorkout[];
  current: CoachWorkout;
  now?: Date;
  levelPromptDismissedAt?: string | null;
  graduationPromptDismissedAt?: string | null;
}

/**
 * The trickiest operation in a set of results: lowest accuracy, time only breaks ties.
 * Needs at least two operations to compare.
 */
export function trickiestOperation(
  parts: Partial<Record<CoreOperation, Pick<OperationResult, 'questions' | 'correct' | 'timeMs'>>>
): CoreOperation | null {
  const ranked = CORE_OPERATIONS.filter((op) => (parts[op]?.questions ?? 0) > 0).map((op) => {
    const p = parts[op]!;
    return { op, accuracy: accuracyOf(p.correct, p.questions), avgTime: p.timeMs / p.questions };
  });
  if (ranked.length < 2) return null;
  ranked.sort((a, b) => a.accuracy - b.accuracy || b.avgTime - a.avgTime);
  return ranked[0].op;
}

/** Recent totals per operation (last 10 entries each), for suggesting a focus later on. */
function recentTotals(workouts: CoachWorkout[]) {
  const entries = sortNewestFirst(workouts).flatMap(toEntries);
  const totals: Partial<Record<CoreOperation, { questions: number; correct: number; timeMs: number }>> = {};
  for (const op of CORE_OPERATIONS) {
    const recent = entries.filter((e) => e.operation === op).slice(0, 10);
    if (recent.length === 0) continue;
    totals[op] = recent.reduce(
      (sum, e) => ({ questions: sum.questions + e.questions, correct: sum.correct + e.correct, timeMs: sum.timeMs + e.timeMs }),
      { questions: 0, correct: 0, timeMs: 0 }
    );
  }
  return totals;
}

function cooledDown(dismissedAtIso: string | null | undefined, days: number, now: Date): boolean {
  const dismissedAt = dismissedAtIso ? new Date(dismissedAtIso).getTime() : 0;
  return !dismissedAt || now.getTime() - dismissedAt >= days * DAY_MS;
}

export function getResultsFeedback(input: ResultsFeedbackInput): ResultsFeedback {
  const { plan, history, current } = input;
  const now = input.now ?? new Date();
  const all = [current, ...history];
  // A manual practice round is never the warm-up, and doesn't use it up.
  const isWarmup = current.source !== 'manual' && !hasStartedPlan(history);
  const next = getCoachPlan(plan, all, now);

  // ---- What we learned (warm-up only) ----
  let learned: string | null = null;
  if (isWarmup) {
    const trickiest = trickiestOperation(current.breakdown ?? {});
    if (!trickiest) {
      learned = COPY.warmupDone;
    } else {
      const willPractice = next.workout.operations.length === 1 && next.focus === trickiest;
      learned = willPractice ? `${COPY.trickiest(trickiest)} ${COPY.practiceNext}` : COPY.trickiest(trickiest);
    }
  }

  // ---- Level changes ----
  const before = getLevelState(history, plan);
  const after = getLevelState(all, plan);
  const levelChanges = diffLevels(before.levels, after.levels).map((change) => ({
    ...change,
    text: change.direction === 'up' ? COPY.levelUp(change.operation, change.to) : COPY.levelDown(change.operation, change.to),
  }));

  // ---- Graduation: an operation in the plan is mastered ----
  // Only one Yes / Not now question per screen: graduation first, then focus, then level.
  const chosen = chosenOperations(plan);
  const comfort = normalizeComfortLevel(plan.comfortLevel);
  const masteredBefore = masteredOperations(before);
  const masteredNow = masteredOperations(after);
  const allMastered =
    masteredNow.length === CORE_OPERATIONS.length && masteredBefore.length < CORE_OPERATIONS.length
      ? COPY.allMastered(comfort === 'confident')
      : null;

  let graduation: ResultsFeedback['graduation'] = null;
  const masteredInPlan = chosen.filter((op) => masteredNow.includes(op));
  if (
    masteredInPlan.length > 0 &&
    cooledDown(input.graduationPromptDismissedAt, GRADUATION_PROMPT_COOLDOWN_DAYS, now)
  ) {
    const entries = sortNewestFirst(all).flatMap(toEntries);
    const operation = suggestNextOperation(chosen, masteredNow, (op) => getOperationStats(op, entries));
    // Name the one that just got mastered, if any.
    const mastered = masteredInPlan.find((op) => !masteredBefore.includes(op)) ?? masteredInPlan[0];
    if (operation) graduation = { mastered, operation, text: COPY.graduation(operation) };
  }
  const newlyMastered = masteredNow.filter((op) => !masteredBefore.includes(op));

  // ---- "Want to focus on ÷ Dividing?" for Not sure users ----
  let focusQuestion: ResultsFeedback['focusQuestion'] = null;
  const workoutCount = all.length;
  if (!graduation && isNotSure(plan) && (workoutCount === 1 || workoutCount % ASK_FOCUS_EVERY === 0)) {
    const suggestion = trickiestOperation(recentTotals(all));
    if (suggestion) focusQuestion = { operation: suggestion, text: COPY.focusQuestion(suggestion) };
  }

  // ---- "Want to change your level to Confident?" ----
  let levelSuggestion: ResultsFeedback['levelSuggestion'] = null;
  const hardForAWhile =
    chosen.length > 0 &&
    chosen.every((op) => {
      const lastRounds = after.counted[op].slice(0, STREAK_TO_MOVE);
      return (
        after.levels[op] === 'hard' &&
        lastRounds.length === STREAK_TO_MOVE &&
        lastRounds.every((e) => e.difficulty === 'hard')
      );
    });
  if (
    !graduation &&
    !focusQuestion &&
    hardForAWhile &&
    comfort !== 'confident' &&
    cooledDown(input.levelPromptDismissedAt, LEVEL_PROMPT_COOLDOWN_DAYS, now)
  ) {
    levelSuggestion = { level: 'confident', text: COPY.levelSuggestion('confident') };
  }

  return {
    subtitle: isWarmup ? COPY.resultsWarmupSubtitle : COPY.resultsSubtitle,
    learned,
    levelChanges,
    focusQuestion,
    levelSuggestion,
    graduation,
    newlyMastered,
    allMastered,
    goalJustDone: next.goalDoneToday && !getCoachPlan(plan, history, now).goalDoneToday,
    next,
  };
}
