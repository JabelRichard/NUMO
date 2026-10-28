import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelDailyReminder } from '../notificationService';
import { clearLocalUserData } from '../localDataService';
import { loadCoachData } from '../coachService';
import { fetchAllWorkouts } from '../workoutService';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

let mockSessionUserId: string | null = null;
jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: mockSessionUserId ? { user: { id: mockSessionUserId } } : null },
      })),
    },
  },
}));

jest.mock('../notificationService', () => ({
  REMINDERS_ENABLED_KEY: '@numo_reminders_enabled',
  REMINDER_TIME_KEY: '@numo_reminder_time',
  cancelDailyReminder: jest.fn(async () => {}),
}));

jest.mock('../settingsService', () => ({
  ...jest.requireActual('../settingsService'),
  getUserSettings: jest.fn(async () => null),
}));

jest.mock('../profileService', () => ({
  ...jest.requireActual('../profileService'),
  getTrainingGoals: jest.fn(async () => null),
}));

jest.mock('../workoutService', () => ({
  ...jest.requireActual('../workoutService'),
  flushWorkoutOutbox: jest.fn(async () => 0),
  fetchAllWorkouts: jest.fn(async () => []),
}));

const ME = 'user-a';
const OTHER = 'user-b';

const perUserKeys = (userId: string) => [
  `numo_coach_cache_v1:${userId}`,
  `numo_level_prompt_dismissed_v1:${userId}`,
  `numo_graduation_prompt_dismissed_v1:${userId}`,
  `numo_last_workout_summary_v1:${userId}`,
];
const outboxKey = (userId: string) => `@numo_workout_outbox_v1:${userId}`;

const PHONE_WIDE_PERSONAL_KEYS = [
  '@numo_user_training_goals',
  '@numo_onboarding_completed',
  '@numo_onboarding_draft',
  '@numo_reminders_enabled',
  '@numo_reminder_time',
];
const DEVICE_PREFERENCE_KEYS = ['user_theme', '@numo_sound_enabled', '@numo_haptics_enabled'];

const queuedWorkout = {
  queueId: 'q1',
  attempts: [],
  mode: 'addition',
  difficulty: 'easy',
  completedAt: '2026-10-28T10:00:00.000Z',
  source: 'coach',
};

async function seed(entries: Record<string, string>) {
  await AsyncStorage.multiSet(Object.entries(entries));
}

async function storedKeys(): Promise<string[]> {
  return [...(await AsyncStorage.getAllKeys())].sort();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockSessionUserId = null;
});

describe('clearLocalUserData', () => {
  beforeEach(async () => {
    await seed({
      ...Object.fromEntries(perUserKeys(ME).map((k) => [k, 'mine'])),
      ...Object.fromEntries(PHONE_WIDE_PERSONAL_KEYS.map((k) => [k, 'mine'])),
      ...Object.fromEntries(DEVICE_PREFERENCE_KEYS.map((k) => [k, 'device'])),
    });
  });

  it('clears every per-user and phone-wide personal key, and keeps device preferences', async () => {
    await clearLocalUserData(ME);
    expect(await storedKeys()).toEqual([...DEVICE_PREFERENCE_KEYS].sort());
  });

  it('keeps the outbox while it still has workouts', async () => {
    await seed({ [outboxKey(ME)]: JSON.stringify([queuedWorkout]) });
    await clearLocalUserData(ME);
    expect(await AsyncStorage.getItem(outboxKey(ME))).toBe(JSON.stringify([queuedWorkout]));
    for (const key of [...perUserKeys(ME), ...PHONE_WIDE_PERSONAL_KEYS]) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
  });

  it('clears the outbox when it is empty', async () => {
    await seed({ [outboxKey(ME)]: '[]' });
    await clearLocalUserData(ME);
    expect(await AsyncStorage.getItem(outboxKey(ME))).toBeNull();
  });

  it('clears the outbox with its workouts after the account is deleted', async () => {
    await seed({ [outboxKey(ME)]: JSON.stringify([queuedWorkout]) });
    await clearLocalUserData(ME, { discardUnsynced: true });
    expect(await AsyncStorage.getItem(outboxKey(ME))).toBeNull();
    expect(await storedKeys()).toEqual([...DEVICE_PREFERENCE_KEYS].sort());
  });

  it("never touches another user's keys", async () => {
    const theirs = Object.fromEntries(
      [...perUserKeys(OTHER), outboxKey(OTHER)].map((k) => [k, 'theirs'])
    );
    await seed({ ...theirs, [outboxKey(OTHER)]: '[]' });
    await clearLocalUserData(ME, { discardUnsynced: true });
    for (const key of perUserKeys(OTHER)) {
      expect(await AsyncStorage.getItem(key)).toBe('theirs');
    }
    expect(await AsyncStorage.getItem(outboxKey(OTHER))).toBe('[]');
  });

  it('cancels the daily reminder and clears its keys', async () => {
    await clearLocalUserData(ME);
    expect(cancelDailyReminder).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('@numo_reminders_enabled')).toBeNull();
    expect(await AsyncStorage.getItem('@numo_reminder_time')).toBeNull();
  });

  it('still clears everything if cancelling the reminder fails', async () => {
    (cancelDailyReminder as jest.Mock).mockRejectedValueOnce(new Error('no permission'));
    await expect(clearLocalUserData(ME)).resolves.toBeUndefined();
    expect(await storedKeys()).toEqual([...DEVICE_PREFERENCE_KEYS].sort());
  });
});

describe('coach cache after sign-out', () => {
  const savedWorkout = {
    id: 'w1',
    operation: 'addition',
    difficulty: 'easy',
    total_questions: 10,
    correct_answers: 8,
    total_time: 30000,
    completed_at: '2026-10-27T10:00:00.000Z',
    source: 'coach',
    breakdown: null,
  };

  beforeEach(() => {
    (fetchAllWorkouts as jest.Mock).mockResolvedValue([savedWorkout]);
  });

  it('saves the cache while the user is signed in', async () => {
    mockSessionUserId = ME;
    await loadCoachData(ME);
    const cached = JSON.parse((await AsyncStorage.getItem(`numo_coach_cache_v1:${ME}`))!);
    expect(cached.workouts).toEqual([savedWorkout]);
  });

  it('ignores a cache save that finishes after sign-out', async () => {
    mockSessionUserId = null;
    await loadCoachData(ME);
    expect(await AsyncStorage.getItem(`numo_coach_cache_v1:${ME}`)).toBeNull();
  });

  it('ignores a cache save for someone who is no longer the signed-in user', async () => {
    mockSessionUserId = OTHER;
    await loadCoachData(ME);
    expect(await AsyncStorage.getItem(`numo_coach_cache_v1:${ME}`)).toBeNull();
  });
});
