import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelDailyReminder, REMINDER_TIME_KEY, REMINDERS_ENABLED_KEY } from './notificationService';
import { COACH_CACHE_KEY_PREFIX, GRADUATION_PROMPT_KEY_PREFIX, LEVEL_PROMPT_KEY_PREFIX } from './coachService';
import { TRAINING_GOALS_KEY } from './profileService';
import { flushWorkoutOutbox, getQueuedWorkoutCount, OUTBOX_KEY_PREFIX } from './workoutService';
import { ONBOARDING_COMPLETED_KEY, ONBOARDING_DRAFT_KEY } from '../utils/onboardingDraft';

// Everything this phone keeps about the signed-in person, so it can be wiped at
// sign-out: families share phones, and one person's data must never show for another.
// The daily reminder is the person's too, so it is cancelled. Device preferences
// (theme, sound, haptics) are not personal and stay.

/** Saved per user as prefix + user id. */
const USER_KEY_PREFIXES = [
  COACH_CACHE_KEY_PREFIX,
  LEVEL_PROMPT_KEY_PREFIX,
  GRADUATION_PROMPT_KEY_PREFIX,
  'numo_last_workout_summary_v1:', // no longer written; left on phones by older versions
];

/** Saved once per phone, but they hold the last person's plan, onboarding state and reminder. */
const SHARED_PERSONAL_KEYS = [
  TRAINING_GOALS_KEY,
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_DRAFT_KEY,
  REMINDERS_ENABLED_KEY,
  REMINDER_TIME_KEY,
];

/**
 * Tries to sync queued workouts before signing out.
 * Returns how many are still waiting (0 = safe to clear everything).
 */
export async function syncBeforeSignOut(userId: string): Promise<number> {
  try {
    await flushWorkoutOutbox(userId);
  } catch {
    // Counted below.
  }
  try {
    return await getQueuedWorkoutCount(userId);
  } catch {
    return 0;
  }
}

/**
 * Removes this user's data from the phone. Unsynced workouts are kept (they only
 * ever load for this user id and sync when they sign in again) unless
 * `discardUnsynced` is set, e.g. after the account was deleted.
 */
export async function clearLocalUserData(userId: string, { discardUnsynced = false } = {}): Promise<void> {
  const keys = [...USER_KEY_PREFIXES.map((prefix) => prefix + userId), ...SHARED_PERSONAL_KEYS];

  let hasUnsynced = false;
  if (!discardUnsynced) {
    try {
      hasUnsynced = (await getQueuedWorkoutCount(userId)) > 0;
    } catch {
      hasUnsynced = true; // Can't tell: keep them.
    }
  }
  if (!hasUnsynced) keys.push(OUTBOX_KEY_PREFIX + userId);

  try {
    await AsyncStorage.multiRemove(keys);
  } catch (e) {
    console.warn('Failed to clear local user data:', e);
  }

  // Not turned back on at the next sign-in; the next person chooses for themselves.
  try {
    await cancelDailyReminder();
  } catch (e) {
    console.warn('Failed to cancel the daily reminder:', e);
  }
}
