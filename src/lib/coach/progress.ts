import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation, DifficultyLevel } from '../math/types';
import { longestDayStreak } from '../../utils/localDates';
import { COPY, focusLabel } from './copy';
import { getLevelState, LevelState } from './difficulty';
import { accuracyOf, normalizeDifficulty, normalizeOperation, OperationEntry, sortNewestFirst, toEntries } from './entries';
import { isMastered, LevelProgress, levelProgress } from './mastery';
import { CLOSE_ACCURACY_POINTS, getOperationStats } from './stats';
import { CoachPlanInput, CoachWorkout } from './types';

// Statistics: how far the user has come, from the same history and levels as the coach.
// Progress is only ever compared within one operation at one level, so moving up a
// level (harder questions) never looks like getting worse.

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL_ORDER: DifficultyLevel[] = ['easy', 'medium', 'hard'];

// ---- Lifetime records ----

export interface LifetimeTotals {
  questions: number;
  workouts: number;
  longestStreak: number;
  /** Rounds with every answer right. */
  perfectRounds: number;
}

const isPerfect = (w: CoachWorkout) => {
  const questions = Number(w.total_questions) || 0;
  return questions > 0 && (Number(w.correct_answers) || 0) >= questions;
};

/** Counts whole workouts, so a mix is one workout and its questions count once. */
export function lifetimeTotals(workouts: CoachWorkout[]): LifetimeTotals {
  return {
    questions: workouts.reduce((sum, w) => sum + (Number(w.total_questions) || 0), 0),
    workouts: workouts.length,
    longestStreak: longestDayStreak(workouts.map((w) => w.completed_at)),
    perfectRounds: workouts.filter(isPerfect).length,
  };
}

export function isLifetimeTotals(value: unknown): value is LifetimeTotals {
  const v = value as LifetimeTotals | null;
  return (
    !!v &&
    [v.questions, v.workouts, v.longestStreak, v.perfectRounds].every((n) => typeof n === 'number' && n >= 0)
  );
}

/**
 * Offline: totals saved from the full history, plus workouts that aren't in it yet.
 * `all` is everything on the phone (cached + extra), for a streak that runs into them.
 */
export function addToLifetime(base: LifetimeTotals, extra: CoachWorkout[], all: CoachWorkout[]): LifetimeTotals {
  const more = lifetimeTotals(extra);
  return {
    questions: base.questions + more.questions,
    workouts: base.workouts + more.workouts,
    longestStreak: Math.max(base.longestStreak, longestDayStreak(all.map((w) => w.completed_at))),
    perfectRounds: base.perfectRounds + more.perfectRounds,
  };
}

// ---- Your levels ----

/** Fewer rounds than this at the current level shows "New level" instead of a number. */
export const MIN_ROUNDS_FOR_ACCURACY = 2;

export interface LevelRow {
  operation: CoreOperation;
  level: DifficultyLevel;
  mastered: boolean;
  /** Never practiced, at any level, alone or in a mix. */
  tried: boolean;
  /** Recent % correct at the current level (last 10, mix parts included); null when it's too new. */
  accuracy: number | null;
  progress: LevelProgress;
}

export function levelRows(state: LevelState, entries: OperationEntry[]): LevelRow[] {
  return CORE_OPERATIONS.map((op) => {
    const level = state.levels[op];
    const atLevel = entries.filter((e) => e.operation === op && e.difficulty === level);
    const stats = getOperationStats(op, atLevel);
    return {
      operation: op,
      level,
      mastered: isMastered(state, op),
      tried: entries.some((e) => e.operation === op),
      accuracy: stats.recent.length >= MIN_ROUNDS_FOR_ACCURACY ? stats.accuracy : null,
      progress: levelProgress(state, op),
    };
  });
}

// ---- Progress: one plain sentence ----

export const PROGRESS_WINDOW = 5;
// A level-up is the news for this long; until then the new level has too few rounds to compare.
export const LEVEL_UP_NEWS_DAYS = 14;
const FASTER_RATIO = 0.9;
const MORE_ACCURATE_POINTS = 5;

export type ProgressHighlight =
  | { kind: 'level_up'; operation: CoreOperation; level: DifficultyLevel }
  | {
      kind: 'faster';
      operation: CoreOperation;
      level: DifficultyLevel;
      /** Seconds per question: the last 5 rounds and the 5 before, same level. */
      now: number;
      before: number;
    }
  | { kind: 'more_accurate'; operation: CoreOperation; level: DifficultyLevel; now: number; before: number }
  | { kind: 'steady'; operation: CoreOperation; level: DifficultyLevel; accuracy: number }
  | { kind: 'not_enough' };

const sum = (rounds: OperationEntry[]) =>
  rounds.reduce(
    (t, r) => ({ questions: t.questions + r.questions, correct: t.correct + r.correct, timeMs: t.timeMs + r.timeMs }),
    { questions: 0, correct: 0, timeMs: 0 }
  );

const secondsPerQuestion = (t: ReturnType<typeof sum>) => (t.questions > 0 ? t.timeMs / t.questions / 1000 : 0);

/**
 * In order: a level-up in the last 14 days; else the biggest same-level gain (the last
 * 5 counted rounds against the 5 before); else "steady" on the latest operation with
 * enough rounds; else not enough data. Never reports getting slower or less accurate.
 */
export function progressHighlight(state: LevelState, now: Date = new Date()): ProgressHighlight {
  let levelUp: { operation: CoreOperation; level: DifficultyLevel; at: number } | null = null;
  let best: { highlight: ProgressHighlight; gain: number } | null = null;
  let steady: { highlight: ProgressHighlight; at: number } | null = null;

  for (const op of CORE_OPERATIONS) {
    const level = state.levels[op];
    const rounds = state.counted[op];

    // The newest counted round at another level is the one that moved the level.
    const moved = rounds.find((r) => r.difficulty !== level);
    if (
      moved &&
      LEVEL_ORDER.indexOf(moved.difficulty) < LEVEL_ORDER.indexOf(level) &&
      moved.completedAt >= now.getTime() - LEVEL_UP_NEWS_DAYS * DAY_MS &&
      (!levelUp || moved.completedAt > levelUp.at)
    ) {
      levelUp = { operation: op, level, at: moved.completedAt };
    }

    const sameLevel = rounds.filter((r) => r.difficulty === level);
    if (sameLevel.length < PROGRESS_WINDOW + 1) continue;
    const recent = sum(sameLevel.slice(0, PROGRESS_WINDOW));
    const previous = sum(sameLevel.slice(PROGRESS_WINDOW, PROGRESS_WINDOW * 2));
    const recentAcc = accuracyOf(recent.correct, recent.questions);
    const previousAcc = accuracyOf(previous.correct, previous.questions);
    const recentPace = secondsPerQuestion(recent);
    const previousPace = secondsPerQuestion(previous);

    if (previousPace > 0 && recentPace <= previousPace * FASTER_RATIO && recentAcc >= previousAcc - CLOSE_ACCURACY_POINTS) {
      const gain = (1 - recentPace / previousPace) * 100;
      if (!best || gain > best.gain) {
        best = { gain, highlight: { kind: 'faster', operation: op, level, now: recentPace, before: previousPace } };
      }
    }
    if (recentAcc >= previousAcc + MORE_ACCURATE_POINTS) {
      const gain = recentAcc - previousAcc;
      if (!best || gain > best.gain) {
        best = { gain, highlight: { kind: 'more_accurate', operation: op, level, now: recentAcc, before: previousAcc } };
      }
    }
    if (!steady || sameLevel[0].completedAt > steady.at) {
      steady = { at: sameLevel[0].completedAt, highlight: { kind: 'steady', operation: op, level, accuracy: recentAcc } };
    }
  }

  if (levelUp) return { kind: 'level_up', operation: levelUp.operation, level: levelUp.level };
  return best?.highlight ?? steady?.highlight ?? { kind: 'not_enough' };
}

/** The sentence and a short supporting line for the progress card. */
export function progressText(highlight: ProgressHighlight): { headline: string; detail: string | null } {
  switch (highlight.kind) {
    case 'level_up':
      return { headline: COPY.progressLevelUp(highlight.operation, highlight.level), detail: COPY.progressLevelUpDetail };
    case 'faster':
      return {
        headline: COPY.progressFaster(highlight.operation, highlight.level),
        detail: COPY.progressFasterDetail(highlight.now, highlight.before),
      };
    case 'more_accurate':
      return {
        headline: COPY.progressMoreAccurate(highlight.operation, highlight.level),
        detail: COPY.progressMoreAccurateDetail(highlight.now, highlight.before),
      };
    case 'steady':
      return {
        headline: COPY.progressSteady(highlight.operation, highlight.level),
        detail: COPY.progressSteadyDetail(highlight.accuracy),
      };
    default:
      return { headline: COPY.progressNotEnough, detail: null };
  }
}

/** "2 more strong rounds to reach Hard", "Mastered! Keep it sharp in mixes." */
export function levelProgressText(row: LevelRow): string {
  if (!row.tried) return COPY.notTriedYet;
  const p = row.progress;
  if (p.kind === 'mastered') return COPY.masteredLine;
  if (p.kind === 'next_level') return COPY.roundsToNextLevel(p.roundsLeft, p.next);
  return p.anotherDay ? COPY.masteryAnotherDay : COPY.roundsToMastery(p.roundsLeft);
}

// ---- One day on the calendar ----

/** "× Multiplying · Medium · 18/20", "Mix it up · 19/20", "Warm-up · 9/10". */
export function workoutDayLabel(w: CoachWorkout): string {
  const op = normalizeOperation(w.operation);
  const name =
    w.source === 'warmup'
      ? COPY.warmupLabel
      : op === 'mixed'
        ? COPY.mixHeading
        : focusLabel(op, normalizeDifficulty(w.difficulty));
  return `${name} · ${Number(w.correct_answers) || 0}/${Number(w.total_questions) || 0}`;
}

// ---- Everything the Statistics screen needs ----

export interface ProgressSummary {
  levelState: LevelState;
  levels: LevelRow[];
  highlight: ProgressHighlight;
}

export function getProgressSummary(plan: CoachPlanInput, workouts: CoachWorkout[], now: Date = new Date()): ProgressSummary {
  const history = sortNewestFirst(workouts);
  const levelState = getLevelState(history, plan);
  return {
    levelState,
    levels: levelRows(levelState, history.flatMap(toEntries)),
    highlight: progressHighlight(levelState, now),
  };
}
