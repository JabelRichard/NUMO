import { CoreOperation, DifficultyLevel } from '../../math/types';
import {
  CoachWorkout,
  compareWithLast,
  findLastComparable,
  getResultsFeedback,
  getVerdict,
  sameAgainWorkout,
  usualMsPerQuestion,
  WorkoutBreakdown,
  WorkoutSource,
} from '..';

const NOW = new Date(2026, 9, 28, 18, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * DAY - hours * HOUR).toISOString();

function round(
  operation: CoreOperation,
  correct: number,
  difficulty: DifficultyLevel,
  completedAt: string,
  { questions = 10, msPerQuestion = 3000, source = 'coach' as WorkoutSource } = {}
): CoachWorkout {
  const timeMs = questions * msPerQuestion;
  return {
    operation,
    difficulty,
    total_questions: questions,
    correct_answers: correct,
    total_time: timeMs,
    completed_at: completedAt,
    source,
    breakdown: { [operation]: { questions, correct, timeMs, difficulty } },
  };
}

function mix(levels: Partial<Record<CoreOperation, DifficultyLevel>>, completedAt: string, msPerQuestion = 3000): CoachWorkout {
  const breakdown: WorkoutBreakdown = {};
  for (const [op, difficulty] of Object.entries(levels) as [CoreOperation, DifficultyLevel][]) {
    breakdown[op] = { questions: 4, correct: 3, timeMs: 4 * msPerQuestion, difficulty };
  }
  const questions = Object.keys(levels).length * 4;
  return {
    operation: 'mixed',
    difficulty: 'easy',
    total_questions: questions,
    correct_answers: Object.keys(levels).length * 3,
    total_time: questions * msPerQuestion,
    completed_at: completedAt,
    source: 'coach',
    breakdown,
  };
}

describe('findLastComparable', () => {
  it('finds the newest round of the same operation and level', () => {
    const older = round('division', 6, 'hard', ago(3));
    const newer = round('division', 7, 'hard', ago(1));
    const otherLevel = round('division', 9, 'medium', ago(0, 5));
    const otherOp = round('addition', 9, 'hard', ago(0, 4));
    const current = round('division', 8, 'hard', ago(0, 1));
    expect(findLastComparable([older, otherLevel, newer, otherOp], current)).toBe(newer);
  });

  it('matches a mix only with the same operations at the same levels', () => {
    const current = mix({ addition: 'hard', multiplication: 'medium' }, ago(0, 1));
    const differentLevel = mix({ addition: 'hard', multiplication: 'easy' }, ago(1));
    const extraOp = mix({ addition: 'hard', multiplication: 'medium', division: 'easy' }, ago(2));
    const same = mix({ addition: 'hard', multiplication: 'medium' }, ago(3));
    expect(findLastComparable([differentLevel, extraOp], current)).toBeNull();
    expect(findLastComparable([differentLevel, extraOp, same], current)).toBe(same);
  });

  it('never matches an old mixed row without a breakdown', () => {
    const legacy = { ...mix({ addition: 'easy' }, ago(1)), breakdown: null };
    expect(findLastComparable([legacy], mix({ addition: 'easy' }, ago(0, 1)))).toBeNull();
  });
});

describe('compareWithLast', () => {
  const current = (correct: number, opts = {}) => round('division', correct, 'hard', ago(0, 1), opts);
  const last = (correct: number, opts = {}) => round('division', correct, 'hard', ago(1), opts);

  it('names the operation and level the first time', () => {
    expect(compareWithLast(current(7), null)).toEqual({
      tone: 'first',
      text: "First time on ÷ Dividing · Hard. Next time you'll see your progress.",
    });
    expect(compareWithLast(mix({ addition: 'easy', division: 'easy' }, ago(0)), null).text).toBe(
      "First time mixing at these levels. Next time you'll see your progress."
    );
  });

  it('counts more correct answers when the rounds are the same length', () => {
    expect(compareWithLast(current(9), last(7))).toEqual({ tone: 'better', text: '↑ 2 more correct than last time' });
    expect(compareWithLast(current(6), last(7))).toEqual({ tone: 'lower', text: 'A bit lower than last time' });
  });

  it('compares percentages when the rounds have different lengths', () => {
    expect(compareWithLast(current(16, { questions: 20 }), last(7))).toEqual({
      tone: 'better',
      text: 'Up from 70% to 80% correct',
    });
    expect(compareWithLast(current(14, { questions: 20 }), last(8))).toEqual({
      tone: 'lower',
      text: 'Down from 80% to 70% correct',
    });
  });

  it('uses speed only when the score is the same', () => {
    expect(compareWithLast(current(7, { msPerQuestion: 2500 }), last(7)).text).toBe('Faster than last time');
    expect(compareWithLast(current(7, { msPerQuestion: 2950 }), last(7)).text).toBe('About the same as last time');
    expect(compareWithLast(current(7, { msPerQuestion: 4000 }), last(7)).tone).toBe('same');
  });

  it('skips speed when timing is missing', () => {
    expect(compareWithLast({ ...current(7), total_time: 0 }, last(7)).text).toBe('About the same as last time');
  });
});

describe('usualMsPerQuestion', () => {
  it("averages the user's own pace for that operation and level", () => {
    const history = [
      round('multiplication', 8, 'medium', ago(2), { msPerQuestion: 2000 }),
      round('multiplication', 8, 'medium', ago(1), { msPerQuestion: 4000 }),
      round('multiplication', 8, 'easy', ago(1, 2), { msPerQuestion: 1000 }),
    ];
    expect(usualMsPerQuestion(history, round('multiplication', 8, 'medium', ago(0)))).toBe(3000);
  });

  it('needs at least 2 timed rounds', () => {
    const history = [
      round('multiplication', 8, 'medium', ago(2), { msPerQuestion: 2000 }),
      { ...round('multiplication', 8, 'medium', ago(1)), total_time: 0, breakdown: { multiplication: { questions: 10, correct: 8, timeMs: 0, difficulty: 'medium' as const } } },
    ];
    expect(usualMsPerQuestion(history, round('multiplication', 8, 'medium', ago(0)))).toBeNull();
  });

  it('weighs each operation of a mix by its questions', () => {
    const history = [
      round('addition', 8, 'easy', ago(3), { msPerQuestion: 2000 }),
      round('addition', 8, 'easy', ago(2), { msPerQuestion: 2000 }),
      round('division', 8, 'hard', ago(3), { msPerQuestion: 6000 }),
      round('division', 8, 'hard', ago(2), { msPerQuestion: 6000 }),
    ];
    expect(usualMsPerQuestion(history, mix({ addition: 'easy', division: 'hard' }, ago(0)))).toBe(4000);
    expect(usualMsPerQuestion(history, mix({ addition: 'easy', subtraction: 'easy' }, ago(0)))).toBeNull();
  });
});

describe('getVerdict', () => {
  it('judges on accuracy only without a usual pace', () => {
    expect(getVerdict(95, 1500, null).title).toBe('Excellent accuracy');
    expect(getVerdict(85, null, 3000).title).toBe('Mostly right');
    expect(getVerdict(60, null, null).title).toBe('Good practice');
  });

  it("compares speed with the user's own pace", () => {
    expect(getVerdict(95, 3100, 3000).title).toBe('Fast and correct');
    expect(getVerdict(85, 2800, 3000).title).toBe('Quick and mostly right');
    expect(getVerdict(90, 4000, 3000).title).toBe('Right answers, steady pace');
    expect(getVerdict(60, 2500, 3000).title).toBe('Fast, but check your answers');
    expect(getVerdict(60, 3000, 3000).title).toBe('Good practice');
  });
});

describe('sameAgainWorkout', () => {
  it('repeats the same operation and level', () => {
    expect(sameAgainWorkout(round('division', 7, 'hard', ago(0)))).toMatchObject({
      kind: 'daily',
      source: 'coach',
      operation: 'division',
      operations: ['division'],
      difficultyByOperation: { division: 'hard' },
      questionCount: 10,
    });
  });

  it('repeats a mix with each level, and a warm-up as a normal round', () => {
    const warmup = { ...mix({ addition: 'easy', division: 'medium' }, ago(0)), source: 'warmup' as const };
    expect(sameAgainWorkout(warmup)).toMatchObject({
      kind: 'mix',
      source: 'coach',
      operation: 'mixed',
      operations: ['addition', 'division'],
      difficultyByOperation: { addition: 'easy', division: 'medium' },
      questionCount: 8,
    });
  });
});

describe('goalJustDone', () => {
  const plan = { frictionAreas: ['division' as CoreOperation], dailyQuestionGoal: 20 };
  const warmup = round('division', 8, 'easy', ago(2), { source: 'warmup' });

  it('is true only on the round that reaches the goal', () => {
    const first = round('division', 8, 'easy', ago(0, 3));
    const second = round('division', 8, 'easy', ago(0, 2));
    const bonus = round('division', 8, 'easy', ago(0, 1));
    expect(getResultsFeedback({ plan, history: [warmup], current: first, now: NOW }).goalJustDone).toBe(false);
    const reached = getResultsFeedback({ plan, history: [first, warmup], current: second, now: NOW });
    expect(reached.goalJustDone).toBe(true);
    expect(reached.next.goalDoneToday).toBe(true);
    const after = getResultsFeedback({ plan, history: [second, first, warmup], current: bonus, now: NOW });
    expect(after.goalJustDone).toBe(false);
    expect(after.next.goalDoneToday).toBe(true);
  });
});
