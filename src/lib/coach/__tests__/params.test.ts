import { fromWorkoutParams, mainDifficulty, toWorkoutParams, workoutTitle, WorkoutRequest } from '..';

const warmup: WorkoutRequest = {
  kind: 'warmup',
  source: 'warmup',
  operation: 'mixed',
  operations: ['multiplication', 'division'],
  difficultyByOperation: { multiplication: 'easy', division: 'easy' },
  questionCount: 10,
};

describe('workout route params', () => {
  it('round-trips a coach workout', () => {
    expect(fromWorkoutParams(toWorkoutParams(warmup))).toEqual(warmup);
  });

  it('keeps a level per operation in a mix', () => {
    const mix: WorkoutRequest = {
      kind: 'mix',
      source: 'coach',
      operation: 'mixed',
      operations: ['addition', 'subtraction', 'multiplication', 'division'],
      difficultyByOperation: { addition: 'hard', subtraction: 'medium', multiplication: 'medium', division: 'easy' },
      questionCount: 20,
    };
    const params = toWorkoutParams(mix);
    expect(params.difficulty).toBe('medium');
    expect(fromWorkoutParams(params)).toEqual(mix);
  });

  it('old-style links count as manual and fall back to mode and difficulty', () => {
    const request = fromWorkoutParams({ mode: 'adaptive_mix', difficulty: 'hard' });
    expect(request).toMatchObject({ source: 'manual', kind: 'mix', operation: 'mixed', questionCount: 0 });
    expect(request.operations).toHaveLength(4);
    expect(mainDifficulty(request)).toBe('hard');
  });

  it('titles the workout screen in plain words', () => {
    expect(workoutTitle(warmup, 10)).toBe('Warm-up · 10 questions');
    expect(
      workoutTitle(
        { ...warmup, kind: 'daily', source: 'coach', operation: 'multiplication', operations: ['multiplication'], difficultyByOperation: { multiplication: 'medium' } },
        20
      )
    ).toBe('× Multiplying · Medium');
    expect(workoutTitle({ ...warmup, kind: 'mix', source: 'coach' }, 20)).toBe('Mix it up');
    expect(workoutTitle({ ...warmup, kind: 'daily', source: 'coach' }, 20)).toBe('Mixing them up');
  });
});
