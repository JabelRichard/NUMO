import { CoreOperation, DifficultyLevel } from '../../math/types';
import {
  addToLifetime,
  bestQuestionDay,
  CoachPlanInput,
  CoachWorkout,
  getLevelState,
  getProgressSummary,
  levelProgress,
  isLifetimeTotals,
  levelProgressText,
  LifetimeTotals,
  lifetimeTotals,
  progressHighlight,
  progressText,
  WorkoutBreakdown,
  workoutDayLabel,
} from '..';
import { localDayKey, longestDayStreak } from '../../../utils/localDates';

const NOW = new Date(2026, 9, 28, 18, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * DAY - hours * HOUR).toISOString();

const PLAN: CoachPlanInput = { comfortLevel: 'starting', frictionAreas: ['multiplication'] };

function round(
  operation: CoreOperation,
  accuracy: number,
  difficulty: DifficultyLevel,
  completedAt: string,
  secondsPerQuestion = 3,
  questions = 10
): CoachWorkout {
  const correct = Math.round((accuracy / 100) * questions);
  const timeMs = questions * secondsPerQuestion * 1000;
  return {
    operation,
    difficulty,
    total_questions: questions,
    correct_answers: correct,
    total_time: timeMs,
    completed_at: completedAt,
    source: 'coach',
    breakdown: { [operation]: { questions, correct, timeMs, difficulty } },
  };
}

function mix(parts: Partial<Record<CoreOperation, [number, number]>>, completedAt: string): CoachWorkout {
  const breakdown: WorkoutBreakdown = {};
  let questions = 0;
  let correct = 0;
  for (const [op, [c, q]] of Object.entries(parts) as [CoreOperation, [number, number]][]) {
    breakdown[op] = { questions: q, correct: c, timeMs: q * 3000, difficulty: 'easy' };
    questions += q;
    correct += c;
  }
  return {
    operation: 'mixed',
    difficulty: 'easy',
    total_questions: questions,
    correct_answers: correct,
    total_time: questions * 3000,
    completed_at: completedAt,
    source: 'coach',
    breakdown,
  };
}

describe('lifetime records', () => {
  it('counts each workout once (a mix is one workout), perfect rounds and the longest streak', () => {
    const workouts = [
      round('multiplication', 100, 'easy', ago(10)),
      round('multiplication', 80, 'easy', ago(9)),
      round('multiplication', 90, 'easy', ago(8)),
      mix({ addition: [5, 5], division: [5, 5] }, ago(2)),
    ];
    expect(lifetimeTotals(workouts)).toEqual({
      questions: 40,
      workouts: 4,
      longestStreak: 3,
      perfectRounds: 2,
      bestDayQuestions: 10,
      bestDayKey: localDayKey(ago(10)),
      mixedRounds: 1,
    });
  });

  it('offline: adds queued workouts to the totals saved from the full history', () => {
    const base = {
      questions: 5000,
      workouts: 400,
      longestStreak: 12,
      perfectRounds: 30,
      bestDayQuestions: 80,
      bestDayKey: '2026-03-01',
      mixedRounds: 14,
    };
    const cached = [round('addition', 90, 'easy', ago(1))];
    const queued = [round('addition', 100, 'easy', ago(0)), mix({ addition: [4, 5], division: [5, 5] }, ago(0, 1))];
    expect(addToLifetime(base, queued, [...cached, ...queued])).toEqual({
      questions: 5020,
      workouts: 402,
      longestStreak: 12,
      perfectRounds: 31,
      bestDayQuestions: 80,
      bestDayKey: '2026-03-01',
      mixedRounds: 15,
    });
  });

  it('mixed rounds: mixes only, not warm-ups or single-operation rounds', () => {
    const warmup = { ...mix({ addition: [5, 5], subtraction: [5, 5] }, ago(5)), source: 'warmup' as const };
    const legacyMix = { ...mix({}, ago(4)), total_questions: 20, breakdown: null, source: null };
    const workouts = [warmup, legacyMix, mix({ addition: [5, 5], division: [5, 5] }, ago(2)), round('addition', 90, 'easy', ago(1))];
    expect(lifetimeTotals(workouts).mixedRounds).toBe(2);
  });

  it('mixed rounds: an older cache without them counts the mixes on the phone', () => {
    const oldCache = { questions: 5000, workouts: 400, longestStreak: 12, perfectRounds: 30 } as LifetimeTotals;
    const cached = [mix({ addition: [5, 5], division: [5, 5] }, ago(2))];
    const queued = [mix({ addition: [5, 5], division: [5, 5] }, ago(0))];
    expect(addToLifetime(oldCache, queued, [...cached, ...queued]).mixedRounds).toBe(2);
  });

  it('longest streak uses local days and survives a gap', () => {
    const at = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString();
    expect(longestDayStreak([at(9, 1), at(9, 2, 0), at(9, 2, 23), at(9, 5), at(9, 6), at(9, 7), at(9, 8)])).toBe(4);
    expect(longestDayStreak([at(9, 31), at(10, 1)])).toBe(2);
    expect(longestDayStreak([])).toBe(0);
  });
});

describe('best day', () => {
  const at = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString();
  const on = (questions: number, completedAt: string) => round('addition', 100, 'easy', completedAt, 3, questions);

  it("adds up every workout on a local day, a mix's questions counted once", () => {
    const workouts = [
      on(10, at(9, 1, 0)),
      on(10, at(9, 1, 23)),
      mix({ addition: [5, 5], division: [5, 5] }, at(9, 1, 12)),
      on(25, at(9, 2)),
    ];
    expect(bestQuestionDay(workouts)).toEqual({ bestDayQuestions: 30, bestDayKey: '2026-10-01' });
  });

  it('a tie keeps the earlier day, when the record was set', () => {
    expect(bestQuestionDay([on(20, at(9, 5)), on(20, at(9, 3))]).bestDayKey).toBe('2026-10-03');
  });

  it('no questions yet: no best day', () => {
    expect(bestQuestionDay([])).toEqual({ bestDayQuestions: 0, bestDayKey: null });
  });

  it('offline: a day split between cached and queued workouts counts as one day', () => {
    const base = { ...lifetimeTotals([on(25, at(8, 1))]), questions: 5000, workouts: 400 };
    const cached = [on(15, at(9, 28, 9))];
    const queued = [on(15, at(9, 28, 20))];
    // Alone, each half (15) loses to the saved 25; together they're 30.
    expect(addToLifetime(base, queued, [...cached, ...queued])).toMatchObject({
      bestDayQuestions: 30,
      bestDayKey: '2026-10-28',
    });
  });

  it('a cache saved before the best day existed still counts, and fills it in from the phone', () => {
    const oldCache = { questions: 5000, workouts: 400, longestStreak: 12, perfectRounds: 30 };
    expect(isLifetimeTotals(oldCache)).toBe(true);
    const cached = [on(15, at(9, 27))];
    expect(addToLifetime(oldCache as LifetimeTotals, [], cached)).toMatchObject({
      questions: 5000,
      bestDayQuestions: 15,
      bestDayKey: '2026-10-27',
    });
  });
});

describe('rounds to the next level', () => {
  it('counts down the strong rounds in a row at the current level', () => {
    const workouts = [round('multiplication', 90, 'easy', ago(3)), round('multiplication', 90, 'easy', ago(2))];
    const state = getLevelState(workouts, PLAN);
    expect(state.strongInARow.multiplication).toBe(2);
    expect(levelProgress(state, 'multiplication')).toEqual({ kind: 'next_level', next: 'medium', roundsLeft: 1 });
  });

  it('a weak round resets the count', () => {
    const workouts = [
      round('multiplication', 90, 'easy', ago(3)),
      round('multiplication', 90, 'easy', ago(2)),
      round('multiplication', 70, 'easy', ago(1)),
    ];
    expect(levelProgress(getLevelState(workouts, PLAN), 'multiplication')).toMatchObject({ roundsLeft: 3 });
  });

  it('starts over after moving up', () => {
    const workouts = [0, 1, 2].map((i) => round('multiplication', 90, 'easy', ago(5 - i)));
    const state = getLevelState(workouts, PLAN);
    expect(state.levels.multiplication).toBe('medium');
    expect(levelProgress(state, 'multiplication')).toEqual({ kind: 'next_level', next: 'hard', roundsLeft: 3 });
  });

  it('on Hard: counts down to mastered, and asks for another day when all 5 were on one day', () => {
    const plan: CoachPlanInput = { comfortLevel: 'confident', frictionAreas: ['multiplication'] };
    const twoStrong = [round('multiplication', 90, 'hard', ago(1)), round('multiplication', 90, 'hard', ago(0, 2))];
    expect(levelProgress(getLevelState(twoStrong, plan), 'multiplication')).toEqual({
      kind: 'mastery',
      roundsLeft: 3,
      anotherDay: false,
    });

    const oneDay = [5, 4, 3, 2, 1].map((h) => round('multiplication', 90, 'hard', ago(1, h)));
    expect(levelProgress(getLevelState(oneDay, plan), 'multiplication')).toEqual({
      kind: 'mastery',
      roundsLeft: 1,
      anotherDay: true,
    });

    const twoDays = [...oneDay, round('multiplication', 90, 'hard', ago(0))];
    const state = getLevelState(twoDays, plan);
    expect(levelProgress(state, 'multiplication')).toEqual({ kind: 'mastered' });
  });
});

describe('your levels', () => {
  it('accuracy only counts the current level, including mix parts', () => {
    const workouts = [
      ...[0, 1, 2].map((i) => round('multiplication', 100, 'easy', ago(6 - i))),
      round('multiplication', 60, 'medium', ago(1)),
      round('multiplication', 80, 'medium', ago(0, 3)),
    ];
    const row = getProgressSummary(PLAN, workouts, NOW).levels.find((r) => r.operation === 'multiplication')!;
    expect(row.level).toBe('medium');
    expect(row.accuracy).toBe(70);
    expect(levelProgressText(row)).toBe('3 more strong rounds to reach Hard');
  });

  it('a new level with fewer than 2 rounds shows no number', () => {
    const workouts = [
      ...[0, 1, 2].map((i) => round('multiplication', 100, 'easy', ago(6 - i))),
      round('multiplication', 60, 'medium', ago(1)),
    ];
    const row = getProgressSummary(PLAN, workouts, NOW).levels.find((r) => r.operation === 'multiplication')!;
    expect(row.accuracy).toBeNull();
  });

  it('mix parts count as practice; never practiced shows "Not tried yet"', () => {
    const summary = getProgressSummary(PLAN, [mix({ addition: [3, 4], division: [4, 4] }, ago(1))], NOW);
    const row = (op: CoreOperation) => summary.levels.find((r) => r.operation === op)!;
    expect(row('addition').tried).toBe(true);
    expect(row('division').tried).toBe(true);
    expect(row('subtraction').tried).toBe(false);
    expect(levelProgressText(row('subtraction'))).toBe('Not tried yet');
  });

  it('older mixes without a breakdown count only as "mixed"', () => {
    const old: CoachWorkout = { ...mix({ addition: [5, 5] }, ago(1)), breakdown: null };
    const summary = getProgressSummary(PLAN, [old], NOW);
    expect(summary.levels.every((r) => !r.tried)).toBe(true);
  });
});

describe('progress sentence', () => {
  it('not enough rounds yet', () => {
    const state = getLevelState([round('multiplication', 70, 'easy', ago(1))], PLAN);
    expect(progressHighlight(state, NOW)).toEqual({ kind: 'not_enough' });
    expect(progressText({ kind: 'not_enough' }).headline).toBe('Do a few more workouts to see your progress here.');
  });

  it('just moved up: says so, never "slower", even though the new level takes longer', () => {
    const workouts = [
      // Quick on Easy, then slower on Medium (harder questions).
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => round('multiplication', i < 4 ? 70 : 90, 'easy', ago(20 - i), 2)),
      ...[0, 1, 2, 3, 4, 5].map((i) => round('multiplication', 70, 'medium', ago(6 - i), 6)),
    ];
    const state = getLevelState(workouts, PLAN);
    expect(state.levels.multiplication).toBe('medium');
    const highlight = progressHighlight(state, NOW);
    expect(highlight).toEqual({ kind: 'level_up', operation: 'multiplication', level: 'medium' });
    expect(progressText(highlight).headline).toBe('You moved up to Medium on × Multiplying! 🎉');
  });

  it('compares the last 5 rounds with the 5 before, at the same level only', () => {
    const workouts = [
      ...[0, 1, 2, 3, 4].map((i) => round('multiplication', 70, 'easy', ago(30 - i), 5)),
      ...[0, 1, 2, 3, 4].map((i) => round('multiplication', 70, 'easy', ago(10 - i), 3)),
    ];
    const highlight = progressHighlight(getLevelState(workouts, PLAN), NOW);
    expect(highlight).toMatchObject({ kind: 'faster', operation: 'multiplication', level: 'easy', now: 3, before: 5 });
    expect(progressText(highlight)).toEqual({
      headline: "You're getting faster at × Multiplying on Easy.",
      detail: 'About 3 seconds per question in your last 5 rounds, down from 5 seconds.',
    });
  });

  it('more right on the same level', () => {
    const workouts = [
      ...[0, 1, 2, 3, 4].map((i) => round('division', 60, 'easy', ago(30 - i))),
      ...[0, 1, 2, 3, 4].map((i) => round('division', 80, 'easy', ago(10 - i))),
    ];
    expect(progressHighlight(getLevelState(workouts, PLAN), NOW)).toMatchObject({
      kind: 'more_accurate',
      operation: 'division',
      now: 80,
      before: 60,
    });
  });

  it('getting slower is reported as steady, not as a drop', () => {
    const workouts = [
      ...[0, 1, 2, 3, 4].map((i) => round('addition', 70, 'easy', ago(30 - i), 3)),
      ...[0, 1, 2, 3, 4].map((i) => round('addition', 70, 'easy', ago(10 - i), 5)),
    ];
    expect(progressHighlight(getLevelState(workouts, PLAN), NOW)).toMatchObject({ kind: 'steady', operation: 'addition' });
  });

  it('a level-up more than 14 days ago is no longer the news', () => {
    const workouts = [0, 1, 2].map((i) => round('multiplication', 90, 'easy', ago(30 - i)));
    expect(progressHighlight(getLevelState(workouts, PLAN), NOW)).toEqual({ kind: 'not_enough' });
  });
});

describe('calendar day list', () => {
  it('names each workout like the rest of the app', () => {
    expect(workoutDayLabel(round('multiplication', 90, 'medium', ago(0)))).toBe('× Multiplying · Medium · 9/10');
    expect(workoutDayLabel(mix({ addition: [9, 10], division: [10, 10] }, ago(0)))).toBe('Mix it up · 19/20');
    expect(workoutDayLabel({ ...mix({ addition: [9, 10] }, ago(0)), source: 'warmup' })).toBe('Warm-up · 9/10');
  });
});
