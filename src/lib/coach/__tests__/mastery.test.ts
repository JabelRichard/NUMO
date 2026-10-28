import { CoreOperation, DifficultyLevel } from '../../math/types';
import {
  addToPlan,
  CoachPlanInput,
  CoachWorkout,
  getCoachPlan,
  getLevelState,
  getResultsFeedback,
  WorkoutBreakdown,
  WorkoutSource,
} from '..';

const NOW = new Date(2026, 9, 28, 18, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * DAY - hours * HOUR).toISOString();

function round(
  operation: CoreOperation,
  accuracy: number,
  difficulty: DifficultyLevel,
  completedAt: string,
  source: WorkoutSource = 'coach',
  questions = 10
): CoachWorkout {
  const correct = Math.round((accuracy / 100) * questions);
  const timeMs = questions * 3000;
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

/** A mix with a few questions on each operation given (too few to move levels). */
function mix(parts: Partial<Record<CoreOperation, number>>, completedAt: string): CoachWorkout {
  const breakdown: WorkoutBreakdown = {};
  let questions = 0;
  let correct = 0;
  for (const [op, accuracy] of Object.entries(parts) as [CoreOperation, number][]) {
    const c = Math.round((accuracy / 100) * 4);
    breakdown[op] = { questions: 4, correct: c, timeMs: 12000, difficulty: 'easy' };
    questions += 4;
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

/** Four strong Hard rounds on four different days; the fifth is the workout just finished. */
const fourStrongHard = (op: CoreOperation) => [4, 3, 2, 1].map((d) => round(op, 90, 'hard', ago(d)));

const addingPlan: CoachPlanInput = {
  goal: 'everyday',
  frictionAreas: ['addition'],
  comfortLevel: 'confident',
  dailyQuestionGoal: 20,
  sessionDurationMinutes: 5,
};

describe('graduation', () => {
  const history = fourStrongHard('addition');
  const current = round('addition', 90, 'hard', ago(0, 1));

  it('asks to add the next operation once one in the plan is mastered', () => {
    const feedback = getResultsFeedback({ plan: addingPlan, history, current, now: NOW });
    expect(feedback.graduation).toEqual({
      mastered: 'addition',
      operation: 'subtraction',
      text: 'Want to add − Subtracting to your plan?',
    });
    expect(feedback.newlyMastered).toEqual(['addition']);
    expect(feedback.next.mastered).toEqual(['addition']);
  });

  it('is not mastered after only 4 strong Hard rounds', () => {
    const feedback = getResultsFeedback({
      plan: addingPlan,
      history: history.slice(1),
      current,
      now: NOW,
    });
    expect(feedback.graduation).toBeNull();
  });

  it('needs at least 2 different days', () => {
    const sameDay = [1, 2, 3, 4].map((h) => round('addition', 95, 'hard', ago(0, h + 1)));
    expect(getResultsFeedback({ plan: addingPlan, history: sameDay, current, now: NOW }).graduation).toBeNull();
  });

  it('needs every one of the last 5 rounds to be strong', () => {
    const oneWeak = [...history.slice(0, 3), round('addition', 70, 'hard', ago(1))];
    expect(getResultsFeedback({ plan: addingPlan, history: oneWeak, current, now: NOW }).graduation).toBeNull();
  });

  it('does not count manual Training rounds', () => {
    const withManual = [...history.slice(0, 3), round('addition', 100, 'hard', ago(1), 'manual')];
    expect(getResultsFeedback({ plan: addingPlan, history: withManual, current, now: NOW }).graduation).toBeNull();
  });

  it('needs to be on Hard', () => {
    const plan = { ...addingPlan, comfortLevel: 'getting_there' as const };
    const mediumRounds = [4, 3, 2, 1].map((d) => round('addition', 95, 'medium', ago(d)));
    const feedback = getResultsFeedback({ plan, history: mediumRounds, current: round('addition', 95, 'medium', ago(0, 1)), now: NOW });
    expect(feedback.next.levels.addition).toBe('hard');
    expect(feedback.graduation).toBeNull();
  });

  it('suggests the weakest operation not in the plan, from mixes', () => {
    const mixes = [mix({ subtraction: 100, multiplication: 25, division: 75 }, ago(5))];
    const feedback = getResultsFeedback({ plan: addingPlan, history: [...mixes, ...history], current, now: NOW });
    expect(feedback.graduation?.operation).toBe('multiplication');
    expect(feedback.graduation?.text).toBe('Want to add × Multiplying to your plan?');
  });

  it('with no data, follows the order + → − → × → ÷', () => {
    const plan = { ...addingPlan, frictionAreas: ['multiplication' as const] };
    const feedback = getResultsFeedback({
      plan,
      history: fourStrongHard('multiplication'),
      current: round('multiplication', 90, 'hard', ago(0, 1)),
      now: NOW,
    });
    expect(feedback.graduation?.operation).toBe('addition');
  });

  it('never suggests an operation already in the plan', () => {
    const plan = { ...addingPlan, frictionAreas: ['addition', 'subtraction', 'multiplication'] as CoachPlanInput['frictionAreas'] };
    expect(getResultsFeedback({ plan, history, current, now: NOW }).graduation?.operation).toBe('division');

    const everything = { ...addingPlan, frictionAreas: ['addition', 'subtraction', 'multiplication', 'division'] as CoachPlanInput['frictionAreas'] };
    expect(getResultsFeedback({ plan: everything, history, current, now: NOW }).graduation).toBeNull();
  });

  it('"Not now" waits 7 days', () => {
    const ask = (dismissedDaysAgo: number) =>
      getResultsFeedback({ plan: addingPlan, history, current, now: NOW, graduationPromptDismissedAt: ago(dismissedDaysAgo) }).graduation;
    expect(ask(0)).toBeNull();
    expect(ask(6)).toBeNull();
    expect(ask(7)).not.toBeNull();
  });
});

describe('after "Yes"', () => {
  const plan: CoachPlanInput = { ...addingPlan, frictionAreas: addToPlan(addingPlan.frictionAreas, 'subtraction') };
  const mastered = [...fourStrongHard('addition'), round('addition', 90, 'hard', ago(0, 2))];

  it('adds the new operation and keeps the mastered one', () => {
    expect(plan.frictionAreas).toEqual(['subtraction', 'addition']);
    expect(addToPlan(['addition', 'mixed'], 'division')).toEqual(['division', 'addition', 'mixed']);
    expect(addToPlan(['division', 'addition'], 'division')).toEqual(['division', 'addition']);
  });

  it('the coach focuses on the new operation, even when it scores higher', () => {
    expect(getCoachPlan(plan, mastered, NOW).focus).toBe('subtraction');
    const strongSubtraction = round('subtraction', 100, 'hard', ago(0, 1));
    expect(getCoachPlan(plan, [...mastered, strongSubtraction], NOW).focus).toBe('subtraction');
  });

  it('the mastered one still appears on mix-it-up days', () => {
    // 7 coach workouts done, so the 8th is a mix.
    const history = [...mastered, round('subtraction', 80, 'hard', ago(0, 1)), round('subtraction', 80, 'hard', ago(0, 0.5))];
    const coach = getCoachPlan(plan, history, NOW);
    expect(coach.workout.kind).toBe('mix');
    expect(coach.workout.operations).toContain('addition');
  });

  it('keeps the mastered one as the pick when nothing else is in the plan', () => {
    expect(getCoachPlan(addingPlan, mastered, NOW).focus).toBe('addition');
  });
});

describe('everything mastered', () => {
  const plan: CoachPlanInput = { ...addingPlan, frictionAreas: ['addition', 'subtraction', 'multiplication', 'division'] };
  const ops: CoreOperation[] = ['addition', 'subtraction', 'multiplication', 'division'];
  const history = [
    ...ops.slice(0, 3).flatMap((op, i) => [5, 4, 3, 2, 1].map((d) => round(op, 95, 'hard', ago(d, i + 1)))),
    ...fourStrongHard('division'),
  ];
  const current = round('division', 95, 'hard', ago(0, 1));

  it('celebrates once and asks nothing', () => {
    const feedback = getResultsFeedback({ plan, history, current, now: NOW });
    expect(feedback.allMastered).toBe("You've mastered everything! 🏆 Keep mixing to stay sharp.");
    expect(feedback.graduation).toBeNull();
    expect(feedback.levelSuggestion).toBeNull();

    const nextTime = getResultsFeedback({ plan, history: [...history, current], current: round('addition', 95, 'hard', ago(0, 0.5)), now: NOW });
    expect(nextTime.allMastered).toBeNull();
  });

  it('points to a higher level when the user is not Confident yet', () => {
    // Levels restart at Hard when the Level is Confident, so use a plan already on Hard
    // through history: "Getting there" plus 3 strong Medium rounds per operation first.
    const gettingThere = { ...plan, comfortLevel: 'getting_there' as const };
    const climb = ops.flatMap((op, i) => [12, 11, 10].map((d) => round(op, 95, 'medium', ago(d, i + 1))));
    const feedback = getResultsFeedback({ plan: gettingThere, history: [...climb, ...history], current, now: NOW });
    expect(feedback.allMastered).toBe("You've mastered everything! 🏆 Try a higher level, or keep mixing.");
    expect(feedback.levelSuggestion?.level).toBe('confident');
  });
});

describe('one question per Results screen', () => {
  // "Getting there": climbs to Hard on +, then masters it. The Level question also applies.
  const plan: CoachPlanInput = { ...addingPlan, comfortLevel: 'getting_there' };
  const history = [...[10, 9, 8].map((d) => round('addition', 95, 'medium', ago(d))), ...fourStrongHard('addition')];
  const current = round('addition', 90, 'hard', ago(0, 1));

  it('shows graduation first and holds the Level question', () => {
    const feedback = getResultsFeedback({ plan, history, current, now: NOW });
    expect(feedback.graduation).not.toBeNull();
    expect(feedback.levelSuggestion).toBeNull();
    expect(feedback.focusQuestion).toBeNull();
  });

  it('asks the Level question next time, after graduation was answered', () => {
    const feedback = getResultsFeedback({ plan, history, current, now: NOW, graduationPromptDismissedAt: ago(1) });
    expect(feedback.graduation).toBeNull();
    expect(feedback.levelSuggestion?.level).toBe('confident');
  });
});

/** A mix where each operation has [correct, questions], all at one level. */
function mixAt(
  parts: Partial<Record<CoreOperation, [number, number]>>,
  difficulty: DifficultyLevel,
  completedAt: string
): CoachWorkout {
  const breakdown: WorkoutBreakdown = {};
  let questions = 0;
  let correct = 0;
  for (const [op, [c, q]] of Object.entries(parts) as [CoreOperation, [number, number]][]) {
    breakdown[op] = { questions: q, correct: c, timeMs: q * 3000, difficulty };
    questions += q;
    correct += c;
  }
  return {
    operation: 'mixed',
    difficulty,
    total_questions: questions,
    correct_answers: correct,
    total_time: questions * 3000,
    completed_at: completedAt,
    source: 'coach',
    breakdown,
  };
}

const sumQuestions = (rounds: { questions: number }[]) => rounds.reduce((sum, r) => sum + r.questions, 0);

describe('mix rounds pool questions until there are 5', () => {
  it('goal 10: two mixes of 3 + questions make one round', () => {
    const plan: CoachPlanInput = { ...addingPlan, comfortLevel: 'starting', dailyQuestionGoal: 10 };
    // A 10-question mix: 3, 3, 2, 2.
    const mixes = Array.from({ length: 6 }, (_, i) =>
      mixAt({ addition: [3, 3], subtraction: [3, 3], multiplication: [2, 2], division: [2, 2] }, 'easy', ago(12 - i * 2))
    );

    const afterOne = getLevelState(mixes.slice(0, 1), plan);
    expect(afterOne.counted.addition).toHaveLength(0);

    const afterFive = getLevelState(mixes.slice(0, 5), plan);
    expect(afterFive.counted.addition.map((r) => r.questions)).toEqual([6, 6]);
    expect(afterFive.levels.addition).toBe('easy');

    // Three strong pooled rounds: + moves up.
    const afterSix = getLevelState(mixes, plan);
    expect(afterSix.counted.addition).toHaveLength(3);
    expect(afterSix.levels.addition).toBe('medium');
    // ÷ has 2 per mix: 2 + 2 + 2 = one round of 6, then another.
    expect(afterSix.counted.division.map((r) => r.questions)).toEqual([6, 6]);
  });

  it('goal 5: 2 + questions per mix pool across 3 mixes, each question used once', () => {
    const plan: CoachPlanInput = { ...addingPlan, comfortLevel: 'starting', dailyQuestionGoal: 5 };
    // A 5-question mix: 2, 1, 1, 1.
    const mixes = Array.from({ length: 9 }, (_, i) =>
      mixAt({ addition: [2, 2], subtraction: [1, 1], multiplication: [1, 1], division: [1, 1] }, 'easy', ago(20 - i * 2))
    );

    // 5 mixes = 10 + questions: one round of 6, and 4 still waiting.
    const afterFive = getLevelState(mixes.slice(0, 5), plan);
    expect(afterFive.counted.addition.map((r) => r.questions)).toEqual([6]);
    expect(afterFive.counted.subtraction.map((r) => r.questions)).toEqual([5]);

    const afterNine = getLevelState(mixes, plan);
    expect(afterNine.counted.addition.map((r) => r.questions)).toEqual([6, 6, 6]);
    expect(sumQuestions(afterNine.counted.addition)).toBe(18);
    expect(afterNine.levels.addition).toBe('medium');
  });

  it('single-operation rounds still count alone', () => {
    const plan: CoachPlanInput = { ...addingPlan, comfortLevel: 'starting', dailyQuestionGoal: 5 };
    const rounds = [3, 2, 1].map((d) => round('addition', 100, 'easy', ago(d), 'coach', 5));
    expect(getLevelState(rounds, plan).levels.addition).toBe('medium');
  });

  it('a mastered operation drops after weak pooled mix results', () => {
    const plan: CoachPlanInput = { ...addingPlan, frictionAreas: ['subtraction', 'addition'], dailyQuestionGoal: 10 };
    const mastered = [20, 19, 18, 17, 16].map((d) => round('addition', 95, 'hard', ago(d)));
    const weakMixes = Array.from({ length: 6 }, (_, i) =>
      mixAt({ addition: [0, 3], subtraction: [3, 3], multiplication: [2, 2], division: [2, 2] }, 'hard', ago(12 - i * 2))
    );

    expect(getCoachPlan(plan, mastered, NOW).mastered).toContain('addition');

    // One weak pooled round: no longer mastered, so it's back in daily picks. Still on Hard.
    const afterTwo = getCoachPlan(plan, [...mastered, ...weakMixes.slice(0, 2)], NOW);
    expect(afterTwo.mastered).not.toContain('addition');
    expect(afterTwo.levels.addition).toBe('hard');

    // Three weak pooled rounds: + drops to Medium.
    const afterSix = getCoachPlan(plan, [...mastered, ...weakMixes], NOW);
    expect(afterSix.levels.addition).toBe('medium');
  });
});

describe('quick check for a mastered operation', () => {
  const plan: CoachPlanInput = { ...addingPlan, frictionAreas: ['subtraction', 'addition'] };
  const masteredDaysAgo = (lastDay: number) =>
    [4, 3, 2, 1, 0].map((d) => round('addition', 95, 'hard', ago(lastDay + d)));
  const subtraction = (days: number[]) => days.map((d) => round('subtraction', 80, 'hard', ago(d)));

  it('picks it once it has had no counted round for 14 days', () => {
    // 8 coach workouts done, so the 9th is not a mix day.
    const coach = getCoachPlan(plan, [...masteredDaysAgo(15), ...subtraction([3, 2, 1])], NOW);
    expect(coach.focus).toBe('addition');
    expect(coach.message).toMatchObject({
      kind: 'quick_check',
      heading: 'Quick check: + Adding',
      subheading: "You mastered this one. Let's make sure it still feels easy. 20 questions, about 5 minutes.",
    });
    expect(coach.workout.operations).toEqual(['addition']);
    expect(coach.workout.difficultyByOperation).toEqual({ addition: 'hard' });
    expect(coach.workout.source).toBe('coach');
  });

  it('waits until 14 days have passed', () => {
    expect(getCoachPlan(plan, [...masteredDaysAgo(13), ...subtraction([3, 2, 1])], NOW).focus).toBe('subtraction');
  });

  it('happens once: after the check, back to the plan', () => {
    const checked = round('addition', 95, 'hard', ago(0, 1));
    const coach = getCoachPlan(plan, [...masteredDaysAgo(15), ...subtraction([3, 2]), checked], NOW);
    expect(coach.focus).toBe('subtraction');
  });

  it('a few + questions in a mix (not yet a full round) do not count as a check', () => {
    const smallMix = mixAt({ addition: [3, 3], subtraction: [3, 3], multiplication: [2, 2], division: [2, 2] }, 'hard', ago(0, 1));
    const coach = getCoachPlan(plan, [...masteredDaysAgo(15), ...subtraction([3, 2]), smallMix], NOW);
    expect(coach.focus).toBe('addition');
  });

  it('a mix-it-up day comes first', () => {
    // 7 coach workouts done, so the 8th is a mix.
    expect(getCoachPlan(plan, [...masteredDaysAgo(15), ...subtraction([2, 1])], NOW).message.kind).toBe('mix');
  });
});
