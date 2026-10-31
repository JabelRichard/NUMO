import { CoreOperation, DifficultyLevel } from '../../math/types';
import {
  CoachPlanInput,
  CoachWorkout,
  getCoachPlan,
  getOperationLevels,
  getResultsFeedback,
  isTodaysPick,
  WorkoutBreakdown,
  WorkoutSource,
  workoutForOperation,
} from '..';

const NOW = new Date(2026, 9, 28, 18, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Timestamp `days` days (and `hours` hours) before NOW. */
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * DAY - hours * HOUR).toISOString();

/** A single-operation round. */
function round(
  operation: CoreOperation | 'mixed',
  accuracy: number,
  difficulty: DifficultyLevel,
  completedAt: string,
  source: WorkoutSource | null = 'coach',
  questions = 10,
  secondsPerQuestion = 3
): CoachWorkout {
  const correct = Math.round((accuracy / 100) * questions);
  return {
    operation,
    difficulty,
    total_questions: questions,
    correct_answers: correct,
    total_time: questions * secondsPerQuestion * 1000,
    completed_at: completedAt,
    source,
    breakdown:
      source === null || operation === 'mixed'
        ? null
        : { [operation]: { questions, correct, timeMs: questions * secondsPerQuestion * 1000, difficulty } },
  };
}

/** A round over several operations with its breakdown. */
function mixedRound(
  parts: Partial<Record<CoreOperation, { correct: number; questions: number; seconds?: number }>>,
  difficulty: DifficultyLevel,
  completedAt: string,
  source: WorkoutSource = 'coach'
): CoachWorkout {
  const breakdown: WorkoutBreakdown = {};
  let questions = 0;
  let correct = 0;
  let time = 0;
  for (const [op, p] of Object.entries(parts) as [CoreOperation, { correct: number; questions: number; seconds?: number }][]) {
    const timeMs = p.questions * (p.seconds ?? 3) * 1000;
    breakdown[op] = { questions: p.questions, correct: p.correct, timeMs, difficulty };
    questions += p.questions;
    correct += p.correct;
    time += timeMs;
  }
  const ops = Object.keys(parts);
  return {
    operation: ops.length === 1 ? ops[0] : 'mixed',
    difficulty,
    total_questions: questions,
    correct_answers: correct,
    total_time: time,
    completed_at: completedAt,
    source,
    breakdown,
  };
}

const weakSpotsPlan: CoachPlanInput = {
  goal: 'school',
  frictionAreas: ['multiplication', 'division'],
  comfortLevel: 'starting',
  dailyQuestionGoal: 20,
  sessionDurationMinutes: 5,
};

const notSurePlan: CoachPlanInput = {
  goal: 'everyday',
  frictionAreas: [],
  comfortLevel: 'getting_there',
  dailyQuestionGoal: 20,
  sessionDurationMinutes: 5,
};

describe('brand-new user with weak spots', () => {
  const plan = getCoachPlan(weakSpotsPlan, [], NOW);

  it('starts with a 10-question warm-up on the chosen operations at the Level', () => {
    expect(plan.isFirstWorkout).toBe(true);
    expect(plan.workout).toEqual({
      kind: 'warmup',
      source: 'warmup',
      operation: 'mixed',
      operations: ['multiplication', 'division'],
      difficultyByOperation: { multiplication: 'easy', division: 'easy' },
      questionCount: 10,
    });
  });

  it('says so in plain words', () => {
    expect(plan.message).toEqual({
      kind: 'warmup',
      heading: "Let's start with a warm-up",
      subheading: '10 easy questions on × and ÷, the ones you picked.',
      button: 'Start warm-up',
    });
    expect(plan.goalLine).toBe('Great practice for class and tests.');
    expect(plan.focusLabel).toBe('× and ÷ · Easy');
  });

  it('uses the Level for the warm-up difficulty', () => {
    const confident = getCoachPlan({ ...weakSpotsPlan, comfortLevel: 'confident' }, [], NOW);
    expect(confident.workout.difficultyByOperation).toEqual({ multiplication: 'hard', division: 'hard' });
    expect(confident.message.subheading).toBe('10 challenging questions on × and ÷, the ones you picked.');
  });

  it('a single weak spot gives a warm-up on that operation alone', () => {
    const single = getCoachPlan({ ...weakSpotsPlan, frictionAreas: ['subtraction'] }, [], NOW);
    expect(single.workout.operation).toBe('subtraction');
    expect(single.message.subheading).toBe('10 easy questions on − Subtracting, the one you picked.');
    expect(single.focusLabel).toBe('− Subtracting · Easy');
  });
});

describe('brand-new "Not sure" user', () => {
  it('gets a mixed warm-up across all four operations', () => {
    const plan = getCoachPlan(notSurePlan, [], NOW);
    expect(plan.workout.operation).toBe('mixed');
    expect(plan.workout.operations).toEqual(['addition', 'subtraction', 'multiplication', 'division']);
    expect(plan.workout.questionCount).toBe(10);
    expect(plan.workout.difficultyByOperation.addition).toBe('medium');
    expect(plan.message.heading).toBe("Let's see what you're great at");
    expect(plan.message.subheading).toBe("10 quick mixed questions. We'll find what to practice.");
    expect(plan.focusLabel).toBe('Mixing them up');
  });

  it('"Mixing them up" alone also gets the mixed warm-up', () => {
    const plan = getCoachPlan({ ...notSurePlan, frictionAreas: ['mixed'] }, [], NOW);
    expect(plan.workout.operations).toHaveLength(4);
    expect(plan.message.kind).toBe('warmup_not_sure');
  });

  it('after the warm-up, asks before saving a focus', () => {
    const warmup = mixedRound(
      {
        addition: { correct: 3, questions: 3 },
        subtraction: { correct: 2, questions: 2 },
        multiplication: { correct: 3, questions: 3 },
        division: { correct: 0, questions: 2 },
      },
      'medium',
      ago(0, 1),
      'warmup'
    );
    const feedback = getResultsFeedback({ plan: notSurePlan, history: [], current: warmup, now: NOW });
    expect(feedback.learned).toBe('Nice start! ÷ Dividing was the trickiest.');
    expect(feedback.focusQuestion).toEqual({ operation: 'division', text: 'Want to focus on ÷ Dividing?' });
    // Until they say Yes, practice stays mixed.
    expect(feedback.next.focus).toBe('mixed');
    expect(feedback.next.message.subheading).toBe(
      'A bit of everything while we find what to practice. 20 questions, about 5 minutes.'
    );
  });

  it('after "Not now", asks again on every 5th workout only', () => {
    const history = [3, 2, 1].map((d) =>
      mixedRound({ addition: { correct: 5, questions: 5 }, division: { correct: 1, questions: 5 } }, 'medium', ago(d))
    );
    const fourth = mixedRound({ addition: { correct: 5, questions: 5 }, division: { correct: 1, questions: 5 } }, 'medium', ago(0, 2));
    expect(getResultsFeedback({ plan: notSurePlan, history, current: fourth, now: NOW }).focusQuestion).toBeNull();

    const fifth = mixedRound({ addition: { correct: 5, questions: 5 }, division: { correct: 1, questions: 5 } }, 'medium', ago(0, 1));
    const feedback = getResultsFeedback({ plan: notSurePlan, history: [fourth, ...history], current: fifth, now: NOW });
    expect(feedback.focusQuestion?.operation).toBe('division');
  });
});

describe('warm-up done', () => {
  const warmup = mixedRound(
    { multiplication: { correct: 5, questions: 5 }, division: { correct: 2, questions: 5 } },
    'easy',
    ago(0, 3),
    'warmup'
  );

  it('Results says what was trickiest and that it comes next', () => {
    const feedback = getResultsFeedback({ plan: weakSpotsPlan, history: [], current: warmup, now: NOW });
    expect(feedback.subtitle).toBe("Here's what your warm-up showed.");
    expect(feedback.learned).toBe("Nice start! ÷ Dividing was the trickiest. We'll practice that next.");
    expect(feedback.next.focus).toBe('division');
  });

  it('never offers the warm-up again', () => {
    const plan = getCoachPlan(weakSpotsPlan, [warmup], NOW);
    expect(plan.isFirstWorkout).toBe(false);
    expect(plan.message.kind).toBe('daily');
    expect(plan.message.heading).toBe('Today: ÷ Dividing');
    expect(plan.message.subheading).toBe('You picked this one. 20 questions, about 5 minutes.');
    expect(plan.workout).toMatchObject({ kind: 'daily', source: 'coach', operation: 'division', questionCount: 20 });
    expect(plan.focusLabel).toBe('÷ Dividing · Easy');
  });

  it('a queued offline warm-up counts too (the caller passes it in with the saved rows)', () => {
    const queued = { ...warmup, id: undefined };
    expect(getCoachPlan(weakSpotsPlan, [queued], NOW).isFirstWorkout).toBe(false);
  });

  it('a single-operation warm-up has nothing to compare', () => {
    const solo = round('multiplication', 80, 'easy', ago(0, 1), 'warmup');
    const feedback = getResultsFeedback({ plan: weakSpotsPlan, history: [], current: solo, now: NOW });
    expect(feedback.learned).toBe('Nice start! Your warm-up is done.');
  });

  it('a manually started first workout is the warm-up', () => {
    const plan = getCoachPlan(weakSpotsPlan, [], NOW);
    const request = workoutForOperation(plan, weakSpotsPlan, 'addition', 'hard');
    expect(request).toMatchObject({ kind: 'warmup', source: 'warmup', questionCount: 10 });
  });
});

describe('every 4th workout mixes it up', () => {
  const warmup = mixedRound(
    { multiplication: { correct: 4, questions: 5 }, division: { correct: 3, questions: 5 } },
    'easy',
    ago(3),
    'warmup'
  );
  const second = round('division', 70, 'easy', ago(2));
  const third = round('multiplication', 70, 'easy', ago(1));

  it('the 4th coach workout is a mix of all operations', () => {
    const plan = getCoachPlan(weakSpotsPlan, [warmup, second, third], NOW);
    expect(plan.message).toMatchObject({
      kind: 'mix',
      heading: 'Mix it up',
      subheading: 'A bit of everything to keep it all fresh. 20 questions, about 5 minutes.',
    });
    expect(plan.workout).toMatchObject({ kind: 'mix', operation: 'mixed', questionCount: 20 });
    expect(plan.workout.operations).toHaveLength(4);
  });

  it('manual rounds are not counted', () => {
    const manual = round('addition', 90, 'hard', ago(0, 5), 'manual');
    expect(getCoachPlan(weakSpotsPlan, [warmup, second, third, manual], NOW).message.kind).toBe('mix');
    expect(getCoachPlan(weakSpotsPlan, [warmup, second, manual], NOW).message.kind).toBe('daily');
  });

  it('the 5th is back to the weak spots', () => {
    const mix = mixedRound({ addition: { correct: 5, questions: 5 }, multiplication: { correct: 5, questions: 5 } }, 'easy', ago(0, 4));
    expect(getCoachPlan(weakSpotsPlan, [warmup, second, third, mix], NOW).message.kind).toBe('daily');
  });

  it('users who chose "Mixing them up" get mixed in their normal rotation', () => {
    const plan: CoachPlanInput = { ...weakSpotsPlan, frictionAreas: ['multiplication', 'mixed'] };
    const history = [
      round('multiplication', 95, 'easy', ago(2), 'warmup'),
      round('multiplication', 95, 'easy', ago(1)),
    ];
    const result = getCoachPlan(plan, history, NOW);
    expect(result.focus).toBe('mixed');
    expect(result.message.heading).toBe('Today: Mixing them up');
    expect(result.message.subheading).toBe('You picked this one. 20 questions, about 5 minutes.');
  });
});

describe('choosing the weakest operation', () => {
  it('ranks by accuracy, not raw speed, so slow ÷ is not always picked', () => {
    const history = [
      round('division', 95, 'easy', ago(1), 'coach', 10, 9), // slow but accurate
      round('multiplication', 70, 'easy', ago(2), 'coach', 10, 2), // fast but shaky
    ];
    expect(getCoachPlan(weakSpotsPlan, history, NOW).focus).toBe('multiplication');
  });

  it('when accuracy is close, picks the one practised least recently', () => {
    const history = [round('division', 80, 'easy', ago(1)), round('multiplication', 82, 'easy', ago(2))];
    expect(getCoachPlan(weakSpotsPlan, history, NOW).focus).toBe('multiplication');
  });

  it('a chosen operation with no recent data comes next', () => {
    const history = [round('multiplication', 60, 'easy', ago(1), 'warmup')];
    expect(getCoachPlan(weakSpotsPlan, history, NOW).focus).toBe('division');
  });

  it('only uses the last 10 rounds per operation', () => {
    const oldBad = Array.from({ length: 10 }, (_, i) => round('multiplication', 20, 'easy', ago(40 + i), 'manual'));
    const recentGood = Array.from({ length: 10 }, (_, i) => round('multiplication', 95, 'easy', ago(1 + i), 'manual'));
    const division = round('division', 80, 'easy', ago(1));
    expect(getCoachPlan(weakSpotsPlan, [...oldBad, ...recentGood, division], NOW).focus).toBe('division');
  });

  it('never picks an operation the user did not choose', () => {
    const history = [round('addition', 10, 'easy', ago(1), 'warmup'), round('multiplication', 90, 'easy', ago(2)), round('division', 90, 'easy', ago(3))];
    const plan = getCoachPlan(weakSpotsPlan, history, NOW);
    expect(plan.focus).not.toBe('addition');
  });
});

describe('difficulty per operation', () => {
  const plan: CoachPlanInput = { ...weakSpotsPlan, comfortLevel: 'getting_there' };

  it('starts from the Level', () => {
    expect(getOperationLevels([], plan)).toEqual({
      addition: 'medium',
      subtraction: 'medium',
      multiplication: 'medium',
      division: 'medium',
    });
  });

  it('moves up one step after 3 strong rounds in a row', () => {
    const history = [round('multiplication', 90, 'medium', ago(3)), round('multiplication', 85, 'medium', ago(2))];
    const third = round('multiplication', 100, 'medium', ago(1));
    expect(getOperationLevels(history, plan).multiplication).toBe('medium');

    const feedback = getResultsFeedback({ plan, history, current: third, now: NOW });
    expect(feedback.levelChanges).toEqual([
      expect.objectContaining({ operation: 'multiplication', from: 'medium', to: 'hard', text: 'Great job! × moves up to Hard next time' }),
    ]);
    expect(feedback.next.levels.multiplication).toBe('hard');
    expect(feedback.next.levels.division).toBe('medium');
  });

  it('moves down one step after 3 weak rounds in a row', () => {
    const history = [round('division', 50, 'medium', ago(3)), round('division', 40, 'medium', ago(2))];
    const third = round('division', 30, 'medium', ago(1));
    const feedback = getResultsFeedback({ plan, history, current: third, now: NOW });
    expect(feedback.levelChanges.map((c) => c.text)).toEqual(["Let's practice ÷ on Easy for a bit."]);
  });

  it('a single bad round changes nothing', () => {
    const history = [round('multiplication', 90, 'medium', ago(3)), round('multiplication', 90, 'medium', ago(2))];
    const bad = round('multiplication', 20, 'medium', ago(1));
    const feedback = getResultsFeedback({ plan, history, current: bad, now: NOW });
    expect(feedback.levelChanges).toEqual([]);
    // The bad round breaks the strong streak, so one more strong round is not enough.
    const next = round('multiplication', 95, 'medium', ago(0, 1));
    expect(getOperationLevels([next, bad, ...history], plan).multiplication).toBe('medium');
  });

  it('never moves more than one step, even after 6 strong rounds', () => {
    const history = Array.from({ length: 6 }, (_, i) => round('multiplication', 100, 'easy', ago(6 - i)));
    expect(getOperationLevels(history, { ...plan, comfortLevel: 'starting' }).multiplication).toBe('medium');
  });

  it('manual Training rounds never move the level', () => {
    const manual = [3, 2, 1].map((d) => round('multiplication', 100, 'medium', ago(d), 'manual'));
    expect(getOperationLevels(manual, plan).multiplication).toBe('medium');
  });

  it('a Training round is manual only when its level differs from the coach', () => {
    const coachPlan = getCoachPlan(plan, [round('multiplication', 80, 'medium', ago(1), 'warmup')], NOW);
    expect(workoutForOperation(coachPlan, plan, 'multiplication', 'hard').source).toBe('manual');
    expect(workoutForOperation(coachPlan, plan, 'multiplication', 'medium').source).toBe('coach');
    expect(workoutForOperation(coachPlan, plan, 'division').source).toBe('coach');
  });

  it('two questions inside a mix do not count toward a level', () => {
    const mixes = [3, 2, 1].map((d) =>
      mixedRound({ multiplication: { correct: 2, questions: 2 }, addition: { correct: 8, questions: 8 } }, 'medium', ago(d))
    );
    const levels = getOperationLevels(mixes, plan);
    expect(levels.multiplication).toBe('medium');
    expect(levels.addition).toBe('hard');
  });

  it('a mix uses each operation at its own level', () => {
    // Warm-up + 2 strong rounds = 3 strong at Medium, and the next workout is the 4th.
    const history = [
      round('multiplication', 90, 'medium', ago(3), 'warmup'),
      ...[2, 1].map((d) => round('multiplication', 90, 'medium', ago(d))),
    ];
    const result = getCoachPlan(plan, history, NOW);
    expect(result.message.kind).toBe('mix');
    expect(result.workout.difficultyByOperation).toEqual({
      addition: 'medium',
      subtraction: 'medium',
      multiplication: 'hard',
      division: 'medium',
    });
    expect(result.focusLabel).toBe('Mixing them up');
  });

  it('changing the Level restarts every operation from the new Level', () => {
    const history = [3, 2, 1].map((d) => round('multiplication', 100, 'medium', ago(d)));
    expect(getOperationLevels(history, plan).multiplication).toBe('hard');
    const reset = { ...plan, levelSetAt: ago(0, 12) };
    expect(getOperationLevels(history, reset).multiplication).toBe('medium');
  });
});

describe('veteran user with old data', () => {
  const legacy = [
    round('mixed', 80, 'medium', ago(30), null),
    round('addition', 90, 'hard', ago(20), null),
    round('addition', 90, 'hard', ago(19), null),
    round('subtraction', 70, 'medium', ago(18), null),
    round('multiplication', 60, 'medium', ago(10), null),
  ];

  it('never sees a placement tour, and gets their weak spot', () => {
    const plan = getCoachPlan({ ...weakSpotsPlan, comfortLevel: null, frictionAreas: ['division'] }, legacy, NOW);
    expect(plan.isFirstWorkout).toBe(false);
    expect(['daily', 'mix', 'goal_done', 'improving']).toContain(plan.message.kind);
    expect(JSON.stringify(plan)).not.toMatch(/tour|baseline|Coach's Choice/i);
  });

  it('without a Level, each operation starts at its most recent old level', () => {
    const levels = getOperationLevels(legacy, { comfortLevel: null });
    expect(levels).toEqual({ addition: 'hard', subtraction: 'medium', multiplication: 'medium', division: 'easy' });
  });

  it('without weak spots, practices mixed and asks about a focus every 5th workout', () => {
    const plan: CoachPlanInput = { frictionAreas: null, comfortLevel: null, dailyQuestionGoal: 10 };
    expect(getCoachPlan(plan, legacy, NOW).focus).toBe('mixed');
    const current = round('division', 30, 'easy', ago(0, 1));
    // 5 old + this one = 6th workout: no question.
    expect(getResultsFeedback({ plan, history: legacy, current, now: NOW }).focusQuestion).toBeNull();
    const fifth = getResultsFeedback({ plan, history: legacy.slice(1), current, now: NOW });
    expect(fifth.focusQuestion?.operation).toBe('division');
  });

  it('old goal values map to the new Focus lines', () => {
    expect(getCoachPlan({ goal: 'consistency' as any }, legacy, NOW).goalLine).toBe('Keeps your mind quick.');
    expect(getCoachPlan({ goal: 'mental_math' as any }, legacy, NOW).goalLine).toBe('Great for quick shopping math.');
  });
});

describe('user with no comfort_level', () => {
  it('gets an easy warm-up', () => {
    const plan = getCoachPlan({ frictionAreas: ['addition', 'division'], comfortLevel: null }, [], NOW);
    expect(plan.workout.difficultyByOperation).toEqual({ addition: 'easy', division: 'easy' });
    expect(plan.workout.questionCount).toBe(10);
  });

  it('falls back to a daily goal of 10', () => {
    const plan = getCoachPlan({ frictionAreas: ['addition'] }, [round('addition', 80, 'easy', ago(1), 'warmup')], NOW);
    expect(plan.workout.questionCount).toBe(10);
    expect(plan.message.subheading).toBe('You picked this one. 10 questions, about 3 minutes.');
  });
});

describe('Home messages', () => {
  const warmup = round('multiplication', 80, 'easy', ago(1), 'warmup');

  it('daily goal done comes first', () => {
    const today = round('division', 80, 'easy', ago(0, 1), 'coach', 20);
    const plan = getCoachPlan(weakSpotsPlan, [today, warmup], NOW);
    expect(plan.goalDoneToday).toBe(true);
    expect(plan.message).toMatchObject({
      kind: 'goal_done',
      heading: 'Goal done for today!',
      subheading: 'Come back tomorrow, or do a bonus round.',
      button: 'Bonus round',
    });
  });

  it('says when an operation is improving', () => {
    const plan: CoachPlanInput = { ...weakSpotsPlan, frictionAreas: ['multiplication'] };
    const history = [
      ...[1, 2, 3].map((d) => round('multiplication', 90, 'easy', ago(d), 'manual', 10, 2)),
      ...[4, 5, 6, 7].map((d) => round('multiplication', 90, 'easy', ago(d), 'manual', 10, 5)),
      round('multiplication', 90, 'easy', ago(8), 'warmup', 10, 5),
    ];
    const result = getCoachPlan(plan, history, NOW);
    expect(result.message.heading).toBe("You're getting faster!");
    expect(result.message.subheading).toBe("× Multiplying is improving. Let's keep going. 20 questions, about 5 minutes.");
  });

  it('estimates minutes when the daily goal no longer matches the minutes picked', () => {
    const plan = getCoachPlan({ ...weakSpotsPlan, dailyQuestionGoal: 30 }, [warmup], NOW);
    expect(plan.message.subheading).toBe('You picked this one. 30 questions, about 8 minutes.');
  });

  it('suggests something new once a week, never as the main pick', () => {
    const start = round('multiplication', 80, 'easy', ago(7), 'warmup');
    const plan = getCoachPlan(weakSpotsPlan, [start], NOW);
    expect(plan.tryNew).toEqual({ operation: 'addition', text: 'Try something new: + Adding' });
    expect(['multiplication', 'division']).toContain(plan.focus);

    expect(getCoachPlan(weakSpotsPlan, [round('multiplication', 80, 'easy', ago(6), 'warmup')], NOW).tryNew).toBeNull();
    const triedRecently = [start, round('addition', 80, 'easy', ago(2), 'manual')];
    expect(getCoachPlan(weakSpotsPlan, triedRecently, NOW).tryNew?.operation).toBe('subtraction');
  });
});

describe('level suggestion', () => {
  const plan: CoachPlanInput = { ...weakSpotsPlan, comfortLevel: 'getting_there' };
  const hardRounds = (op: CoreOperation, startDay: number) =>
    [0, 1, 2].map((i) => round(op, 75, 'hard', ago(startDay - i)));
  const history = [
    ...[12, 11, 10].map((d) => round('multiplication', 95, 'medium', ago(d))),
    ...[9, 8, 7].map((d) => round('division', 95, 'medium', ago(d))),
    ...hardRounds('multiplication', 6),
    ...hardRounds('division', 3).slice(0, 2),
  ];
  const current = round('division', 75, 'hard', ago(0, 1));

  it('asks once every chosen operation has been on Hard for a while', () => {
    const feedback = getResultsFeedback({ plan, history, current, now: NOW });
    expect(feedback.levelSuggestion).toEqual({
      level: 'confident',
      text: "You're doing great! Want to change your level to Confident?",
    });
  });

  it('waits a week after "Not now"', () => {
    expect(getResultsFeedback({ plan, history, current, now: NOW, levelPromptDismissedAt: ago(3) }).levelSuggestion).toBeNull();
    expect(getResultsFeedback({ plan, history, current, now: NOW, levelPromptDismissedAt: ago(8) }).levelSuggestion).not.toBeNull();
  });

  it('does not ask users who are already Confident', () => {
    expect(getResultsFeedback({ plan: { ...plan, comfortLevel: 'confident' }, history, current, now: NOW }).levelSuggestion).toBeNull();
  });
});

describe('Results wording', () => {
  it('replaces the old "today\'s performance" line with a true one', () => {
    const history = [round('multiplication', 80, 'easy', ago(2), 'warmup')];
    const feedback = getResultsFeedback({ plan: weakSpotsPlan, history, current: round('division', 80, 'easy', ago(0, 1)), now: NOW });
    expect(feedback.subtitle).toBe('Picked from your plan and your last few workouts.');
    expect(feedback.learned).toBeNull();
  });
});

describe("Practice screen: today's pick", () => {
  const ROWS = ['addition', 'subtraction', 'multiplication', 'division', 'mixed'] as const;
  const picks = (plan: ReturnType<typeof getCoachPlan>) => ROWS.filter((op) => isTodaysPick(plan, op));

  const warmup = mixedRound(
    { multiplication: { correct: 5, questions: 5 }, division: { correct: 2, questions: 5 } },
    'easy',
    ago(3),
    'warmup'
  );

  it('the × and ÷ warm-up has no single row', () => {
    expect(picks(getCoachPlan(weakSpotsPlan, [], NOW))).toEqual([]);
  });

  it('a "Not sure" warm-up is Mixing them up', () => {
    expect(picks(getCoachPlan(notSurePlan, [], NOW))).toEqual(['mixed']);
  });

  it('a warm-up on one operation is that row', () => {
    expect(picks(getCoachPlan({ ...weakSpotsPlan, frictionAreas: ['subtraction'] }, [], NOW))).toEqual(['subtraction']);
  });

  it('a daily pick is the row Home shows, and that row starts the same workout', () => {
    const plan = getCoachPlan(weakSpotsPlan, [warmup], NOW);
    expect(picks(plan)).toEqual(['division']);
    expect(workoutForOperation(plan, weakSpotsPlan, 'division')).toEqual(plan.workout);
  });

  it('a mix day is Mixing them up, and that row starts the same workout', () => {
    const history = [warmup, round('division', 70, 'easy', ago(2)), round('multiplication', 70, 'easy', ago(1))];
    const plan = getCoachPlan(weakSpotsPlan, history, NOW);
    expect(plan.message.kind).toBe('mix');
    expect(picks(plan)).toEqual(['mixed']);
    expect(workoutForOperation(plan, weakSpotsPlan, 'mixed')).toEqual(plan.workout);
  });

  it('goal done keeps the same pick as Home (the bonus round)', () => {
    const today = [
      mixedRound({ multiplication: { correct: 5, questions: 5 }, division: { correct: 2, questions: 5 } }, 'easy', ago(0, 3), 'warmup'),
      round('division', 70, 'easy', ago(0, 2), 'coach', 10),
    ];
    const plan = getCoachPlan(weakSpotsPlan, today, NOW);
    expect(plan.message.kind).toBe('goal_done');
    expect(picks(plan)).toEqual([plan.focus]);
  });
});

describe('Practice screen: practice rounds', () => {
  const warmup = mixedRound(
    { multiplication: { correct: 5, questions: 5 }, division: { correct: 2, questions: 5 } },
    'easy',
    ago(3),
    'warmup'
  );
  const plan = getCoachPlan(weakSpotsPlan, [warmup], NOW);

  it('another level is a manual round', () => {
    expect(workoutForOperation(plan, weakSpotsPlan, 'multiplication', 'hard').source).toBe('manual');
    expect(workoutForOperation(plan, weakSpotsPlan, 'mixed', 'hard').source).toBe('manual');
  });

  it('the coach level, or "Your levels" on a mix, counts as usual', () => {
    expect(workoutForOperation(plan, weakSpotsPlan, 'multiplication', plan.levels.multiplication).source).toBe('coach');
    expect(workoutForOperation(plan, weakSpotsPlan, 'mixed').source).toBe('coach');
    // Every operation is already Easy, so "Easy" on a mix is the same round.
    expect(workoutForOperation(plan, weakSpotsPlan, 'mixed', 'easy').source).toBe('coach');
  });

  it('a manual round never moves the level', () => {
    const manual = [1, 2, 3].map((h) => round('multiplication', 100, 'easy', ago(0, h), 'manual'));
    expect(getOperationLevels([warmup, ...manual], weakSpotsPlan).multiplication).toBe('easy');
  });
});

describe('history unknown (offline, nothing cached)', () => {
  const confidentPlan: CoachPlanInput = { ...weakSpotsPlan, comfortLevel: 'confident' };
  const plan = getCoachPlan(confidentPlan, [], NOW, { historyUnknown: true });

  it('is not treated as a new user: no warm-up, no pick', () => {
    expect(plan.historyUnknown).toBe(true);
    expect(plan.isFirstWorkout).toBe(false);
    expect(plan.message).toMatchObject({ kind: 'practice_only', heading: 'Pick something to practice' });
    expect(plan.tryNew).toBeNull();
    expect(plan.goalDoneToday).toBe(false);
  });

  it("shows the plan's starting levels and nothing mastered", () => {
    expect(plan.levels).toEqual({ addition: 'hard', subtraction: 'hard', multiplication: 'hard', division: 'hard' });
    expect(plan.mastered).toEqual([]);
  });

  it('every round is manual, at any level, so it never moves levels or counts as the warm-up', () => {
    expect(plan.workout.source).toBe('manual');
    expect(workoutForOperation(plan, confidentPlan, 'multiplication').source).toBe('manual');
    expect(workoutForOperation(plan, confidentPlan, 'multiplication', 'easy').source).toBe('manual');
    expect(workoutForOperation(plan, confidentPlan, 'mixed')).toMatchObject({ kind: 'mix', source: 'manual', questionCount: 20 });
  });

  it('queued rounds do not change the levels shown', () => {
    const queued = [1, 2, 3].map((h) => round('multiplication', 20, 'hard', ago(0, h)));
    expect(getCoachPlan(confidentPlan, queued, NOW, { historyUnknown: true }).levels.multiplication).toBe('hard');
  });

  it('known zero workouts is still the warm-up', () => {
    expect(getCoachPlan(confidentPlan, [], NOW).isFirstWorkout).toBe(true);
  });
});

describe('manual rounds never use up the warm-up', () => {
  const manual = round('multiplication', 90, 'easy', ago(0, 2), 'manual');

  it('the warm-up is still offered after offline practice rounds', () => {
    const plan = getCoachPlan(weakSpotsPlan, [manual], NOW);
    expect(plan.isFirstWorkout).toBe(true);
    expect(plan.workout).toMatchObject({ kind: 'warmup', source: 'warmup' });
  });

  it('Results does not call a manual round the warm-up', () => {
    const feedback = getResultsFeedback({ plan: weakSpotsPlan, history: [], current: manual, now: NOW });
    expect(feedback.learned).toBeNull();
  });

  it('the real warm-up after manual rounds still gets warm-up feedback', () => {
    const warmup = round('multiplication', 80, 'easy', ago(0, 1), 'warmup');
    const feedback = getResultsFeedback({ plan: weakSpotsPlan, history: [manual], current: warmup, now: NOW });
    expect(feedback.learned).toBe('Nice start! Your warm-up is done.');
  });
});
