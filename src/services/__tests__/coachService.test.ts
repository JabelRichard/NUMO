import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCoachDataWithFallback, loadPhoneCoachData } from '../coachService';
import { getUserSettings } from '../settingsService';
import { getTrainingGoals } from '../profileService';
import { fetchAllWorkouts, getQueuedWorkouts } from '../workoutService';
import { CoachWorkout } from '../../lib/coach';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: { user: { id: 'user-a' } } } })),
    },
  },
}));

jest.mock('../settingsService', () => ({
  getUserSettings: jest.fn(async () => null),
}));

jest.mock('../profileService', () => ({
  getTrainingGoals: jest.fn(async () => null),
  saveTrainingGoals: jest.fn(async () => {}),
}));

jest.mock('../workoutService', () => ({
  flushWorkoutOutbox: jest.fn(async () => 0),
  fetchAllWorkouts: jest.fn(async () => []),
  getQueuedWorkouts: jest.fn(async () => []),
}));

const ME = 'user-a';

const phoneGoals = {
  dailyQuestions: 20,
  sessionDurationMinutes: 5,
  weeklyFrequencyDays: 5,
  frictionAreas: ['multiplication' as const],
  comfortLevel: 'confident' as const,
  primaryGoal: 'school' as const,
};

const workout = (completedAt: string, source: CoachWorkout['source'] = 'coach'): CoachWorkout => ({
  operation: 'multiplication',
  difficulty: 'hard',
  total_questions: 10,
  correct_answers: 9,
  total_time: 30000,
  completed_at: completedAt,
  source,
  breakdown: null,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('loadPhoneCoachData', () => {
  it("uses the plan saved on this phone and the workouts queued here, without the network", async () => {
    (getTrainingGoals as jest.Mock).mockResolvedValueOnce(phoneGoals);
    const queued = [workout('2026-10-28T10:00:00.000Z', 'manual')];
    (getQueuedWorkouts as jest.Mock).mockResolvedValueOnce(queued);

    const data = await loadPhoneCoachData(ME);

    expect(getTrainingGoals).toHaveBeenCalledWith();
    expect(getUserSettings).not.toHaveBeenCalled();
    expect(data).toEqual({
      plan: {
        goal: 'school',
        frictionAreas: ['multiplication'],
        comfortLevel: 'confident',
        dailyQuestionGoal: 20,
        sessionDurationMinutes: 5,
        levelSetAt: null,
      },
      workouts: queued,
    });
  });

  it('never throws: an unreadable phone gives an empty plan and no workouts', async () => {
    (getTrainingGoals as jest.Mock).mockRejectedValueOnce(new Error('storage'));
    (getQueuedWorkouts as jest.Mock).mockRejectedValueOnce(new Error('storage'));
    const data = await loadPhoneCoachData(ME);
    expect(data.workouts).toEqual([]);
    expect(data.plan.comfortLevel).toBeNull();
  });
});

describe('loadCoachDataWithFallback', () => {
  const saved = [workout('2026-10-27T10:00:00.000Z')];

  it('online: live data, and it is cached for later', async () => {
    (fetchAllWorkouts as jest.Mock).mockResolvedValueOnce(saved);
    const loaded = await loadCoachDataWithFallback(ME, true);
    expect(loaded.from).toBe('live');
    expect(loaded.data.workouts).toHaveLength(1);
    expect(await AsyncStorage.getItem(`numo_coach_cache_v1:${ME}`)).not.toBeNull();
  });

  it('online but the load fails: the cached copy plus queued workouts', async () => {
    (fetchAllWorkouts as jest.Mock).mockResolvedValueOnce(saved);
    await loadCoachDataWithFallback(ME, true);

    (fetchAllWorkouts as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const queued = workout('2026-10-28T10:00:00.000Z');
    (getQueuedWorkouts as jest.Mock).mockResolvedValue([queued]);
    const loaded = await loadCoachDataWithFallback(ME, true);
    expect(loaded.from).toBe('cache');
    expect(loaded.data.workouts).toHaveLength(2);
    (getQueuedWorkouts as jest.Mock).mockResolvedValue([]);
  });

  it('offline: skips the network and uses the cache', async () => {
    await AsyncStorage.setItem(`numo_coach_cache_v1:${ME}`, JSON.stringify({ plan: {}, workouts: saved }));
    const loaded = await loadCoachDataWithFallback(ME, false);
    expect(fetchAllWorkouts).not.toHaveBeenCalled();
    expect(loaded.from).toBe('cache');
  });

  it('a cache with zero workouts is a known new user, not unknown history', async () => {
    await AsyncStorage.setItem(`numo_coach_cache_v1:${ME}`, JSON.stringify({ plan: {}, workouts: [] }));
    const loaded = await loadCoachDataWithFallback(ME, false);
    expect(loaded.from).toBe('cache');
    expect(loaded.data.workouts).toEqual([]);
  });

  it('offline with nothing cached: the phone plan, marked as unknown history', async () => {
    (getTrainingGoals as jest.Mock).mockResolvedValueOnce(phoneGoals);
    const loaded = await loadCoachDataWithFallback(ME, false);
    expect(loaded.from).toBe('phone');
    expect(loaded.data.plan.comfortLevel).toBe('confident');
  });
});
