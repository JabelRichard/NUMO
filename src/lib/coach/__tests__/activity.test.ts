import { activityBuckets, CoachWorkout, formatTimeSpent, getActivity, mayMissWorkouts } from '..';

// Friday, October 30 2026, evening.
const NOW = new Date(2026, 9, 30, 18, 0, 0);
const at = (month: number, date: number, hour = 12) => new Date(2026, month, date, hour).toISOString();

const single = (operation: string, questions: number, correct: number, completedAt: string): CoachWorkout => ({
  operation,
  difficulty: 'easy',
  total_questions: questions,
  correct_answers: correct,
  total_time: questions * 3000,
  completed_at: completedAt,
  source: 'coach',
  breakdown: { [operation]: { questions, correct, timeMs: questions * 3000, difficulty: 'easy' } },
});

const mix = (completedAt: string): CoachWorkout => ({
  operation: 'mixed',
  difficulty: 'easy',
  total_questions: 10,
  correct_answers: 8,
  total_time: 30000,
  completed_at: completedAt,
  source: 'coach',
  breakdown: {
    addition: { questions: 6, correct: 5, timeMs: 18000, difficulty: 'easy' },
    division: { questions: 4, correct: 3, timeMs: 12000, difficulty: 'medium' },
  },
});

/** An older mix, saved before per-operation parts existed. */
const legacyMix = (completedAt: string): CoachWorkout => ({
  operation: 'mixed',
  difficulty: 'easy',
  total_questions: 20,
  correct_answers: 15,
  total_time: 60000,
  completed_at: completedAt,
  source: null,
  breakdown: null,
});

describe('activityBuckets', () => {
  it('week: Monday to Sunday, today current, the rest of the week in the future', () => {
    const buckets = activityBuckets('week', NOW);
    expect(buckets.map((b) => b.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(new Date(buckets[0].start).getDate()).toBe(26);
    expect(buckets.findIndex((b) => b.isCurrent)).toBe(4);
    expect(buckets.filter((b) => b.isFuture)).toHaveLength(2);
  });

  it('month: Monday-first weeks cut at the month edges', () => {
    // October 2026 starts on a Thursday.
    expect(activityBuckets('month', NOW).map((b) => b.label)).toEqual(['1–4', '5–11', '12–18', '19–25', '26–31']);
  });

  it('year: twelve months, this one current', () => {
    const buckets = activityBuckets('year', NOW);
    expect(buckets).toHaveLength(12);
    expect(buckets.findIndex((b) => b.isCurrent)).toBe(9);
  });
});

describe('getActivity', () => {
  const workouts = [single('addition', 10, 9, at(9, 27)), mix(at(9, 29)), legacyMix(at(9, 30, 9)), single('division', 5, 5, at(9, 5))];

  it('All counts a mix as its parts, once, and older mixes whole', () => {
    const week = getActivity(workouts, 'week', 'all', NOW);
    expect(week.totals.questions).toBe(10 + 10 + 20);
    expect(week.buckets.map((b) => b.questions)).toEqual([0, 10, 0, 10, 20, 0, 0]);
    expect(week.byOperation).toEqual({ addition: 16, subtraction: 0, multiplication: 0, division: 4 });
    expect(week.unsplitMixed).toBe(20);
  });

  it('one operation counts only its parts, never older mixes', () => {
    const week = getActivity(workouts, 'week', 'division', NOW);
    expect(week.totals).toEqual({ questions: 4, correct: 3, timeMs: 12000 });
    expect(week.buckets.map((b) => b.questions)).toEqual([0, 0, 0, 4, 0, 0, 0]);
  });

  it('a wider range picks up older workouts', () => {
    const month = getActivity(workouts, 'month', 'division', NOW);
    expect(month.totals.questions).toBe(9);
    expect(month.buckets[1].questions).toBe(5);
  });

  it('ignores workouts outside the range', () => {
    const lastYear = single('addition', 10, 10, new Date(2025, 11, 31, 12).toISOString());
    expect(getActivity([lastYear], 'year', 'all', NOW).totals.questions).toBe(0);
  });
});

describe('mayMissWorkouts', () => {
  const cached = [single('addition', 10, 10, at(9, 20))];

  it('only when workouts are missing and the oldest one here is inside the range', () => {
    expect(mayMissWorkouts(cached, 1, new Date(2026, 9, 1).getTime())).toBe(false);
    expect(mayMissWorkouts(cached, 400, new Date(2026, 9, 1).getTime())).toBe(true);
    expect(mayMissWorkouts(cached, 400, new Date(2026, 9, 26).getTime())).toBe(false);
  });
});

it('formatTimeSpent', () => {
  expect(formatTimeSpent(45_000)).toBe('45 sec');
  expect(formatTimeSpent(12 * 60_000)).toBe('12 min');
  expect(formatTimeSpent(65 * 60_000)).toBe('1 hr 5 min');
  expect(formatTimeSpent(120 * 60_000)).toBe('2 hr');
});
