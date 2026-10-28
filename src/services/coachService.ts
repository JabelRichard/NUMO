import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { getUserSettings } from './settingsService';
import { getTrainingGoals, saveTrainingGoals } from './profileService';
import { fetchAllWorkouts, flushWorkoutOutbox, getQueuedWorkouts } from './workoutService';
import { addToPlan, CoachPlanInput, CoachWorkout } from '../lib/coach';
import { CoreOperation } from '../lib/math/types';
import { ComfortLevel } from '../types/profile';
import { normalizePrimaryGoal } from '../utils/onboardingDraft';
import { withTimeout } from '../utils/withTimeout';

// Loads what the coach needs, the same way for Home, Results, Training and Statistics.

export const LEVEL_PROMPT_KEY_PREFIX = 'numo_level_prompt_dismissed_v1:';
export const GRADUATION_PROMPT_KEY_PREFIX = 'numo_graduation_prompt_dismissed_v1:';
export const COACH_CACHE_KEY_PREFIX = 'numo_coach_cache_v1:';
// Plenty for levels, mastery and stats, and keeps the cached copy small.
const COACH_CACHE_MAX_WORKOUTS = 300;
// After this long, stop waiting for the network and use the copy saved on the phone.
export const COACH_LOAD_TIMEOUT_MS = 10000;

export interface CoachData {
  plan: CoachPlanInput;
  /** Saved workouts plus workouts still waiting in the offline outbox. */
  workouts: CoachWorkout[];
}

type SavedSettings = Awaited<ReturnType<typeof getUserSettings>>;
type PhoneGoals = Awaited<ReturnType<typeof getTrainingGoals>>;

/** The user's plan: Supabase first, then the copy on this phone. */
export async function loadCoachPlanInput(userId: string): Promise<CoachPlanInput> {
  const [settings, local] = await Promise.all([
    getUserSettings(userId).catch(() => null),
    getTrainingGoals().catch(() => null),
  ]);
  return toPlanInput(settings, local);
}

function toPlanInput(settings: SavedSettings | null, local: PhoneGoals | null): CoachPlanInput {
  return {
    goal: normalizePrimaryGoal(settings?.goals?.[0]) ?? normalizePrimaryGoal(local?.primaryGoal) ?? null,
    frictionAreas: settings?.friction_areas ?? local?.frictionAreas ?? null,
    comfortLevel: settings?.comfort_level ?? local?.comfortLevel ?? null,
    dailyQuestionGoal: settings?.daily_question_goal ?? local?.dailyQuestions ?? null,
    sessionDurationMinutes: settings?.session_duration_minutes ?? local?.sessionDurationMinutes ?? null,
    levelSetAt: settings?.level_set_at ?? null,
  };
}

/**
 * Plan + history. Tries to sync queued workouts first, then adds any still queued.
 * Throws if the saved workouts can't be read; callers then use loadCachedCoachData.
 */
export async function loadCoachData(userId: string): Promise<CoachData> {
  await flushWorkoutOutbox(userId);
  const [plan, saved, queued] = await Promise.all([
    loadCoachPlanInput(userId),
    fetchAllWorkouts(userId),
    getQueuedWorkouts(userId).catch(() => [] as CoachWorkout[]),
  ]);
  await saveCoachCache(userId, plan, saved);
  return { plan, workouts: [...saved, ...queued] };
}

/** Only the fields the coach reads, so the cached copy stays small. */
const toCached = (w: CoachWorkout): CoachWorkout => ({
  id: w.id,
  operation: w.operation,
  difficulty: w.difficulty,
  total_questions: w.total_questions,
  correct_answers: w.correct_answers,
  total_time: w.total_time,
  completed_at: w.completed_at,
  source: w.source ?? null,
  breakdown: w.breakdown ?? null,
});

/** Remembers the last plan and saved workouts read online, for when the phone is offline. */
async function saveCoachCache(userId: string, plan: CoachPlanInput, saved: CoachWorkout[]): Promise<void> {
  try {
    // A load that finishes after sign-out must not write this user's data back.
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id !== userId) return;
    const workouts = saved.slice(-COACH_CACHE_MAX_WORKOUTS).map(toCached);
    await AsyncStorage.setItem(COACH_CACHE_KEY_PREFIX + userId, JSON.stringify({ plan, workouts }));
  } catch (e) {
    console.warn('Failed to cache coach data:', e);
  }
}

const timeOf = (w: CoachWorkout) => new Date(w.completed_at).getTime();

/**
 * Offline: the last plan and workouts read online, plus workouts still queued on this
 * phone. A queued workout that has since been saved appears once. Null when nothing
 * has been cached for this user yet.
 */
export async function loadCachedCoachData(userId: string): Promise<CoachData | null> {
  let cached: CoachData | null = null;
  try {
    const raw = await AsyncStorage.getItem(COACH_CACHE_KEY_PREFIX + userId);
    cached = raw ? (JSON.parse(raw) as CoachData) : null;
  } catch {
    return null;
  }
  if (!cached || !Array.isArray(cached.workouts)) return null;

  const queued = await getQueuedWorkouts(userId).catch(() => [] as CoachWorkout[]);
  const savedTimes = new Set(cached.workouts.map(timeOf));
  const savedIds = new Set(cached.workouts.map((w) => w.id).filter(Boolean));
  const unsaved = queued.filter((w) => !(w.id && savedIds.has(w.id)) && !savedTimes.has(timeOf(w)));
  return { plan: cached.plan ?? {}, workouts: [...cached.workouts, ...unsaved] };
}

/**
 * Offline with nothing cached yet: the plan saved on this phone, plus workouts queued
 * here. Never throws.
 */
export async function loadPhoneCoachData(userId: string): Promise<CoachData> {
  const [local, queued] = await Promise.all([
    getTrainingGoals().catch(() => null),
    getQueuedWorkouts(userId).catch(() => [] as CoachWorkout[]),
  ]);
  return { plan: toPlanInput(null, local), workouts: queued };
}

/**
 * Where coach data came from: online, the copy cached on this phone, or only the plan
 * saved on this phone (the history is unknown, so screens pass `historyUnknown`).
 */
export type CoachDataSource = 'live' | 'cache' | 'phone';

export interface LoadedCoachData {
  data: CoachData;
  from: CoachDataSource;
}

/**
 * Home and Practice: live data (waiting at most 10 seconds), else the cached copy plus
 * queued workouts, else the phone's plan plus queued workouts. Never an empty plan,
 * and never throws.
 */
export async function loadCoachDataWithFallback(userId: string, online: boolean): Promise<LoadedCoachData> {
  if (online) {
    try {
      return { data: await withTimeout(loadCoachData(userId), COACH_LOAD_TIMEOUT_MS), from: 'live' };
    } catch (e) {
      console.warn('Could not load coach data, using the copy on this phone:', e);
    }
  }
  const cached = await loadCachedCoachData(userId);
  if (cached) return { data: cached, from: 'cache' };
  return { data: await loadPhoneCoachData(userId), from: 'phone' };
}

/** "Want to focus on ÷ Dividing?" → Yes. */
export async function saveFocusChoice(userId: string, operation: CoreOperation): Promise<void> {
  await saveTrainingGoals({ frictionAreas: [operation], frictionArea: operation }, userId);
}

/** "Want to change your level to Confident?" → Yes. Also restarts the coach's levels. */
export async function acceptLevelSuggestion(userId: string, level: ComfortLevel): Promise<void> {
  await saveTrainingGoals({ comfortLevel: level }, userId);
}

export async function getLevelPromptDismissedAt(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LEVEL_PROMPT_KEY_PREFIX + userId);
  } catch {
    return null;
  }
}

/** "Not now" on the level suggestion: don't ask again for at least a week. */
export async function dismissLevelPrompt(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LEVEL_PROMPT_KEY_PREFIX + userId, new Date().toISOString());
  } catch (e) {
    console.warn('Failed to remember level prompt answer:', e);
  }
}

/** "Want to add × Multiplying to your plan?" → Yes. Keeps the mastered one too. Returns the new plan list. */
export async function addOperationToPlan(
  userId: string,
  plan: CoachPlanInput,
  operation: CoreOperation
): Promise<NonNullable<CoachPlanInput['frictionAreas']>> {
  const frictionAreas = addToPlan(plan.frictionAreas, operation);
  await saveTrainingGoals({ frictionAreas, frictionArea: operation }, userId);
  return frictionAreas;
}

export async function getGraduationPromptDismissedAt(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(GRADUATION_PROMPT_KEY_PREFIX + userId);
  } catch {
    return null;
  }
}

/** "Not now" on the graduation question: don't ask again for 7 days. */
export async function dismissGraduationPrompt(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GRADUATION_PROMPT_KEY_PREFIX + userId, new Date().toISOString());
  } catch (e) {
    console.warn('Failed to remember graduation answer:', e);
  }
}
