import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation, DifficultyLevel } from '../math/types';
import { localDayKey } from '../../utils/localDates';
import { normalizePrimaryGoal } from '../../utils/onboardingDraft';
import { COPY, focusLabel, GOAL_LINES, LEVEL_NAMES, roundLength, symbolList } from './copy';
import { getLevelState } from './difficulty';
import { normalizeOperation, OperationEntry, sortNewestFirst, toEntries } from './entries';
import { masteredOperations } from './mastery';
import { getOperationStats, OperationStats, pickWeakest } from './stats';
import {
  CoachOperation,
  CoachPlan,
  CoachPlanInput,
  CoachWorkout,
  CoachWorkoutKind,
  OperationLevels,
  WorkoutRequest,
  WorkoutSource,
} from './types';

export const WARMUP_QUESTION_COUNT = 10;
export const DEFAULT_DAILY_GOAL = 10;
// Every 4th coach workout is a "Mix it up" round.
export const MIX_EVERY = 4;
// A mastered operation with no counted round for this long gets a "Quick check".
export const QUICK_CHECK_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function dailyGoalOf(plan: CoachPlanInput): number {
  const goal = Math.round(Number(plan.dailyQuestionGoal));
  return Number.isFinite(goal) && goal > 0 ? goal : DEFAULT_DAILY_GOAL;
}

/** The four operations the user picked as weak spots, in a fixed order. */
export function chosenOperations(plan: CoachPlanInput): CoreOperation[] {
  const areas = plan.frictionAreas ?? [];
  return CORE_OPERATIONS.filter((op) => areas.includes(op));
}

/** True for "Not sure, test me" (empty) and for older accounts that never chose. */
export const isNotSure = (plan: CoachPlanInput) => (plan.frictionAreas ?? []).length === 0;

const operationsFor = (op: CoachOperation): CoreOperation[] => (op === 'mixed' ? CORE_OPERATIONS : [op]);

function levelsFor(ops: CoreOperation[], levels: OperationLevels, override?: DifficultyLevel) {
  return Object.fromEntries(ops.map((op) => [op, override ?? levels[op]])) as Partial<
    Record<CoreOperation, DifficultyLevel>
  >;
}

function buildRequest(
  kind: CoachWorkoutKind,
  source: WorkoutSource,
  ops: CoreOperation[],
  levels: OperationLevels,
  questionCount: number,
  override?: DifficultyLevel
): WorkoutRequest {
  return {
    kind,
    source,
    operation: ops.length === 1 ? ops[0] : 'mixed',
    operations: ops,
    difficultyByOperation: levelsFor(ops, levels, override),
    questionCount,
  };
}

function statsLookup(entries: OperationEntry[]) {
  const cache = new Map<CoachOperation, OperationStats>();
  return (op: CoachOperation) => {
    if (!cache.has(op)) cache.set(op, getOperationStats(op, entries));
    return cache.get(op)!;
  };
}

/** Whole local days from `from` to `to`. */
function daysBetween(from: number, to: Date): number {
  const start = new Date(from);
  start.setHours(12, 0, 0, 0);
  const end = new Date(to);
  end.setHours(12, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/**
 * "Try something new", for an operation the user didn't pick: shown one day a week
 * (every 7th day after their first workout) if they haven't practised it lately.
 */
function pickTryNew(
  chosen: CoreOperation[],
  workouts: CoachWorkout[],
  now: Date
): CoachPlan['tryNew'] {
  const others = CORE_OPERATIONS.filter((op) => !chosen.includes(op));
  if (chosen.length === 0 || others.length === 0 || workouts.length === 0) return null;

  const first = new Date(workouts[workouts.length - 1].completed_at).getTime();
  const days = daysBetween(first, now);
  if (days <= 0 || days % 7 !== 0) return null;

  const weekAgo = now.getTime() - 7 * DAY_MS;
  // Only rounds on that operation alone count; a few questions inside a mix don't.
  const lastSingle = (op: CoreOperation) => {
    const last = workouts.find((w) => normalizeOperation(w.operation) === op);
    return last ? new Date(last.completed_at).getTime() || 0 : 0;
  };
  const notTriedLately = others.filter((op) => lastSingle(op) <= weekAgo);
  if (notTriedLately.length === 0) return null;

  const operation = notTriedLately.sort((a, b) => lastSingle(a) - lastSingle(b))[0];
  return { operation, text: COPY.tryNew(operation) };
}

/**
 * True once a workout that isn't a manual practice round exists. Manual rounds never
 * count as the warm-up, so the warm-up stays first until it's really done.
 */
export const hasStartedPlan = (workouts: CoachWorkout[]) => workouts.some((w) => w.source !== 'manual');

export interface CoachPlanOptions {
  /**
   * The history couldn't be read (offline, nothing cached): `workouts` is only what's
   * queued on this phone. Don't guess a pick or treat the user as new.
   */
  historyUnknown?: boolean;
}

/**
 * The single coach. The user's plan comes first; history only fine-tunes it.
 * `workouts` = saved rows plus queued offline workouts, in any order.
 */
export function getCoachPlan(
  plan: CoachPlanInput,
  workouts: CoachWorkout[],
  now: Date = new Date(),
  options: CoachPlanOptions = {}
): CoachPlan {
  const history = sortNewestFirst(workouts);
  const entries = history.flatMap(toEntries);
  const statsFor = statsLookup(entries);
  const levelState = getLevelState(history, plan);
  const levels = levelState.levels;
  const mastered = masteredOperations(levelState);
  const dailyGoal = dailyGoalOf(plan);
  const chosen = chosenOperations(plan);
  const wantsMixed = (plan.frictionAreas ?? []).includes('mixed');
  const goal = normalizePrimaryGoal(plan.goal);
  const goalLine = goal ? GOAL_LINES[goal] : null;

  const today = localDayKey(now);
  const questionsToday = history
    .filter((w) => w.completed_at && localDayKey(w.completed_at) === today)
    .reduce((sum, w) => sum + (Number(w.total_questions) || 0), 0);

  // ---- History unknown: practice only, at the plan's starting levels ----
  if (options.historyUnknown) {
    const startLevels = getLevelState([], plan).levels;
    return {
      historyUnknown: true,
      isFirstWorkout: false,
      workout: buildRequest('mix', 'manual', CORE_OPERATIONS, startLevels, dailyGoal),
      focus: 'mixed',
      mastered: [],
      focusLabel: focusLabel('mixed'),
      levels: startLevels,
      message: {
        kind: 'practice_only',
        heading: COPY.practiceOnlyHeading,
        subheading: COPY.practiceOnlySubheading(roundLength(dailyGoal, plan.sessionDurationMinutes)),
        button: COPY.startButton,
      },
      goalLine,
      tryNew: null,
      questionsToday,
      goalDoneToday: false,
    };
  }

  // ---- First workout: the warm-up ----
  if (!hasStartedPlan(history)) {
    const ops = chosen.length > 0 ? chosen : CORE_OPERATIONS;
    const workout = buildRequest('warmup', 'warmup', ops, levels, WARMUP_QUESTION_COUNT);
    const level = levels[ops[0]];
    return {
      historyUnknown: false,
      isFirstWorkout: true,
      workout,
      focus: workout.operation,
      // "× and ÷ · Easy" for a warm-up on the chosen operations.
      mastered,
      focusLabel:
        chosen.length > 1 ? `${symbolList(ops)} · ${LEVEL_NAMES[level]}` : focusLabel(workout.operation, level),
      levels,
      message:
        chosen.length > 0
          ? {
              kind: 'warmup',
              heading: COPY.warmupHeading,
              subheading: COPY.warmupSubheading(WARMUP_QUESTION_COUNT, ops, level),
              button: COPY.warmupButton,
            }
          : {
              kind: 'warmup_not_sure',
              heading: COPY.warmupNotSureHeading,
              subheading: COPY.warmupNotSureSubheading(WARMUP_QUESTION_COUNT),
              button: COPY.warmupButton,
            },
      goalLine,
      tryNew: null,
      questionsToday,
      goalDoneToday: false,
    };
  }

  // ---- After the warm-up: pick from the user's weak spots ----
  // Mastered operations step aside while the plan still has one to work on; they stay in mixes.
  const stillLearning = chosen.filter((op) => !mastered.includes(op));
  const dailyOps = stillLearning.length > 0 ? stillLearning : chosen;
  const candidates: CoachOperation[] = [...dailyOps, ...(wantsMixed ? (['mixed'] as const) : [])];
  const mixedOnly = candidates.length === 0 || (candidates.length === 1 && candidates[0] === 'mixed');
  const nextCoachWorkout = history.filter((w) => w.source !== 'manual').length + 1;
  const isMixDay = !mixedOnly && nextCoachWorkout % MIX_EVERY === 0;

  // Mastered operations skip daily picks, so re-check one that hasn't counted for 14 days.
  const lastCounted = (op: CoreOperation) => levelState.counted[op][0]?.completedAt ?? 0;
  const quickCheck = isMixDay
    ? undefined
    : chosen
        .filter((op) => mastered.includes(op) && lastCounted(op) <= now.getTime() - QUICK_CHECK_AFTER_DAYS * DAY_MS)
        .sort((a, b) => lastCounted(a) - lastCounted(b))[0];

  const focus: CoachOperation = quickCheck
    ? quickCheck
    : mixedOnly || isMixDay
      ? 'mixed'
      : pickWeakest(candidates, statsFor);
  const workout = buildRequest(isMixDay ? 'mix' : 'daily', 'coach', operationsFor(focus), levels, dailyGoal);
  const length = roundLength(dailyGoal, plan.sessionDurationMinutes);
  const goalDoneToday = questionsToday >= dailyGoal;
  const improving = focus !== 'mixed' && statsFor(focus).improving;

  let message: CoachPlan['message'];
  if (goalDoneToday) {
    message = { kind: 'goal_done', heading: COPY.goalDoneHeading, subheading: COPY.goalDoneSubheading, button: COPY.bonusButton };
  } else if (isMixDay) {
    message = { kind: 'mix', heading: COPY.mixHeading, subheading: COPY.mixSubheading(length), button: COPY.startButton };
  } else if (quickCheck) {
    message = {
      kind: 'quick_check',
      heading: COPY.quickCheckHeading(quickCheck),
      subheading: COPY.quickCheckSubheading(length),
      button: COPY.startButton,
    };
  } else if (improving) {
    message = {
      kind: 'improving',
      heading: COPY.improvingHeading,
      subheading: COPY.improvingSubheading(focus, length),
      button: COPY.startButton,
    };
  } else {
    const pickedByUser = focus !== 'mixed' || wantsMixed;
    message = {
      kind: 'daily',
      heading: COPY.dailyHeading(focus),
      subheading: pickedByUser ? COPY.dailyPickedSubheading(length) : COPY.dailyNotSureSubheading(length),
      button: COPY.startButton,
    };
  }

  return {
    historyUnknown: false,
    isFirstWorkout: false,
    workout,
    focus,
    mastered,
    focusLabel: focusLabel(focus, focus === 'mixed' ? undefined : levels[focus]),
    levels,
    message,
    goalLine,
    tryNew: pickTryNew(chosen, history, now),
    questionsToday,
    goalDoneToday,
  };
}

/**
 * True when picking `op` on Training starts the same workout as Home's pick: the one
 * operation it's on, or "Mixing them up" for a mix of all four. A warm-up on some
 * operations (× and ÷) has no single row.
 */
export function isTodaysPick(coachPlan: CoachPlan, op: CoachOperation): boolean {
  const { operation, operations } = coachPlan.workout;
  if (op === 'mixed') return operation === 'mixed' && operations.length === CORE_OPERATIONS.length;
  return operation === op;
}

/**
 * A workout on an operation the user picked themselves (a Home bubble, or Training).
 * Uses the coach's level unless `difficulty` is given. A different level makes it a
 * manual round, so it never moves the coach's levels. A first workout is always the warm-up.
 * With the history unknown, every round is manual.
 */
export function workoutForOperation(
  coachPlan: CoachPlan,
  plan: CoachPlanInput,
  operation: CoachOperation,
  difficulty?: DifficultyLevel
): WorkoutRequest {
  const ops = operationsFor(operation);
  const kind: CoachWorkoutKind = operation === 'mixed' ? 'mix' : 'daily';
  if (coachPlan.historyUnknown) {
    return buildRequest(kind, 'manual', ops, coachPlan.levels, dailyGoalOf(plan), difficulty);
  }
  if (coachPlan.isFirstWorkout) {
    return buildRequest('warmup', 'warmup', ops, coachPlan.levels, WARMUP_QUESTION_COUNT, difficulty);
  }
  const isManual = difficulty !== undefined && ops.some((op) => coachPlan.levels[op] !== difficulty);
  return buildRequest(
    kind,
    isManual ? 'manual' : 'coach',
    ops,
    coachPlan.levels,
    dailyGoalOf(plan),
    difficulty
  );
}
