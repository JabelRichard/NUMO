import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  flushWorkoutOutbox,
  getQueuedWorkoutCount,
  queueWorkoutForSync,
  SAVE_TIMEOUT_MS,
  saveOrQueueWorkout,
} from '../workoutService';
import { QuestionAttemptResult } from '../../lib/math/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// A tiny in-memory workout_sessions table behind the calls workoutService makes.
let mockRows: Record<string, any>[] = [];
let mockOnline = true;
// When set, inserts wait until mockFinishSlowInsert() is called (a slow connection).
let mockSlowInsert = false;
let mockFinishSlowInsert: (() => void) | null = null;

jest.mock('../../config/supabase', () => {
  const offline = { data: null, error: { message: 'Network request failed' } };
  const from = () => {
    const filters: Record<string, unknown> = {};
    let payload: Record<string, any> = {};
    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      limit: async () =>
        mockOnline
          ? {
              data: mockRows.filter(
                (r) => r.user_id === filters.user_id && r.completed_at === filters.completed_at
              ),
              error: null,
            }
          : offline,
      insert: (row: Record<string, any>) => {
        payload = row;
        return query;
      },
      single: async () => {
        if (!mockOnline) return offline;
        const save = () => {
          const row = { ...payload, id: `row-${mockRows.length + 1}` };
          mockRows.push(row);
          return { data: row, error: null };
        };
        if (!mockSlowInsert) return save();
        return new Promise((resolve) => {
          mockFinishSlowInsert = () => resolve(save());
        });
      },
    };
    return query;
  };
  return { supabase: { from, auth: { getSession: async () => ({ data: { session: null } }) } } };
});

const ME = 'user-a';

const attempts: QuestionAttemptResult[] = [
  {
    question: {
      id: 'q1',
      operation: 'addition',
      num1: 2,
      num2: 3,
      operatorSymbol: '+',
      equation: '2 + 3',
      answer: 5,
      difficulty: 'easy',
    },
    userAnswer: 5,
    isCorrect: true,
    timeTakenMs: 1500,
    timestamp: 0,
  },
];

const queue = (completedAt: string) =>
  queueWorkoutForSync(ME, attempts, 'addition', 'easy', completedAt, 'coach');

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRows = [];
  mockOnline = true;
  mockSlowInsert = false;
  mockFinishSlowInsert = null;
});

describe('flushWorkoutOutbox', () => {
  it('uploads queued workouts with their finish time and empties the queue', async () => {
    await queue('2026-10-30T10:00:00.000Z');
    await queue('2026-10-30T11:00:00.000Z');

    expect(await flushWorkoutOutbox(ME)).toBe(2);
    expect(mockRows.map((r) => r.completed_at)).toEqual(['2026-10-30T10:00:00.000Z', '2026-10-30T11:00:00.000Z']);
    expect(await getQueuedWorkoutCount(ME)).toBe(0);
  });

  it('does not upload a workout the server already has', async () => {
    // The first save arrived, but the phone never heard back and queued it anyway.
    mockRows.push({ id: 'row-1', user_id: ME, completed_at: '2026-10-30T10:00:00.000Z' });
    await queue('2026-10-30T10:00:00.000Z');

    expect(await flushWorkoutOutbox(ME)).toBe(1);
    expect(mockRows).toHaveLength(1);
    expect(await getQueuedWorkoutCount(ME)).toBe(0);
  });

  it('keeps everything queued while offline', async () => {
    await queue('2026-10-30T10:00:00.000Z');
    mockOnline = false;

    expect(await flushWorkoutOutbox(ME)).toBe(0);
    expect(await getQueuedWorkoutCount(ME)).toBe(1);

    mockOnline = true;
    expect(await flushWorkoutOutbox(ME)).toBe(1);
    expect(mockRows).toHaveLength(1);
  });

  it('runs once when called again during a run (no double upload)', async () => {
    await queue('2026-10-30T10:00:00.000Z');

    const [first, second] = await Promise.all([flushWorkoutOutbox(ME), flushWorkoutOutbox(ME)]);
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(mockRows).toHaveLength(1);
  });
});

describe('saveOrQueueWorkout', () => {
  const finishedAt = '2026-10-31T09:00:00.000Z';

  it('saves straight away when online', async () => {
    const result = await saveOrQueueWorkout(ME, attempts, 'addition', 'easy', finishedAt, 'coach', true);
    expect(result).toEqual({ status: 'saved', id: 'row-1' });
    expect(await getQueuedWorkoutCount(ME)).toBe(0);
  });

  it('queues without trying the network when offline', async () => {
    const result = await saveOrQueueWorkout(ME, attempts, 'addition', 'easy', finishedAt, 'coach', false);
    expect(result).toEqual({ status: 'queued' });
    expect(mockRows).toHaveLength(0);
    expect(await getQueuedWorkoutCount(ME)).toBe(1);
  });

  it('queues when the save fails', async () => {
    mockOnline = false;
    const result = await saveOrQueueWorkout(ME, attempts, 'addition', 'easy', finishedAt, 'coach', true);
    expect(result.status).toBe('queued');
    expect(await getQueuedWorkoutCount(ME)).toBe(1);
  });

  it('queues a slow save, and uploads it only once after it lands', async () => {
    jest.useFakeTimers();
    try {
      mockSlowInsert = true;
      const pending = saveOrQueueWorkout(ME, attempts, 'addition', 'easy', finishedAt, 'coach', true);
      await jest.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS);
      expect(await pending).toEqual({ status: 'queued' });

      // The slow save reaches the server after the phone gave up on it.
      mockSlowInsert = false;
      mockFinishSlowInsert?.();
      await Promise.resolve();
      expect(mockRows).toHaveLength(1);

      expect(await flushWorkoutOutbox(ME)).toBe(1);
      expect(mockRows).toHaveLength(1);
      expect(await getQueuedWorkoutCount(ME)).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
