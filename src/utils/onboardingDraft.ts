import {
  ComfortLevel,
  DEFAULT_TRAINING_GOALS,
  FrictionArea,
  UserTrainingGoals,
} from '../types/profile';
import { UserGoal, UserSettings } from '../types/settings';

export const ONBOARDING_DRAFT_KEY = '@numo_onboarding_draft';
export const ONBOARDING_COMPLETED_KEY = '@numo_onboarding_completed';

export type OnboardingPrimaryGoal = 'everyday' | 'school' | 'memory' | 'work';

export const FREQUENCY_DAY_OPTIONS = [
  { days: 3, label: '3 days' },
  { days: 5, label: '5 days' },
  { days: 7, label: 'Every day' },
] as const;

export const DURATION_MINUTE_OPTIONS = [2, 5, 10] as const;
export const QUESTION_GOAL_OPTIONS = [5, 10, 20, 30, 50] as const;

export const RECOMMENDED_DURATION_MINUTES = 2;
export const RECOMMENDED_FREQUENCY_DAYS = 5;

// Daily question count for each session length. Snapped to QUESTION_GOAL_OPTIONS
// so the Profile goal picker still shows a selection.
const QUESTIONS_PER_DURATION: Record<number, number> = {
  2: 10,
  5: 20,
  10: 50,
};

export function questionsForDuration(minutes: number): number {
  return QUESTIONS_PER_DURATION[minutes] ?? DEFAULT_TRAINING_GOALS.dailyQuestions;
}

/**
 * Maps legacy onboarding ids onto the current ones:
 * 'career' became 'work', 'consistency' became 'memory', and the general ones
 * ('speed', 'accuracy', 'mental_math', 'balanced') fall back to 'everyday'.
 */
export function normalizePrimaryGoal(goal: UserGoal | string | null | undefined): OnboardingPrimaryGoal | undefined {
  switch (goal) {
    case 'everyday':
    case 'school':
    case 'memory':
    case 'work':
      return goal;
    case 'career':
      return 'work';
    case 'consistency':
      return 'memory';
    case 'speed':
    case 'accuracy':
    case 'mental_math':
    case 'balanced':
      return 'everyday';
    default:
      return undefined;
  }
}

export interface OnboardingDraft {
  settings: UserSettings;
  trainingGoals: UserTrainingGoals;
  friction_area: FrictionArea;
}

export function toUserGoals(primaryGoal: OnboardingPrimaryGoal | null): UserGoal[] {
  return [primaryGoal ?? 'everyday'];
}

export function frequencyLabel(days: number | null): string {
  if (!days) return '5 days';
  if (days >= 7) return 'Every day';
  return `${days} days`;
}

export function buildOnboardingDraft(input: {
  primaryGoal: OnboardingPrimaryGoal | null;
  frictionAreas: FrictionArea[] | null;
  comfortLevel: ComfortLevel | null;
  weeklyFrequencyDays: number | null;
  sessionDurationMinutes: number | null;
}): OnboardingDraft {
  const sessionDurationMinutes = input.sessionDurationMinutes ?? RECOMMENDED_DURATION_MINUTES;
  const dailyQuestions = questionsForDuration(sessionDurationMinutes);
  const weeklyFrequencyDays =
    input.weeklyFrequencyDays ?? DEFAULT_TRAINING_GOALS.weeklyFrequencyDays;
  const frictionAreas = input.frictionAreas ?? [];
  // Legacy single field: first pick, or 'mixed' when unsure.
  const frictionArea = frictionAreas[0] ?? 'mixed';
  const primaryGoal = input.primaryGoal ?? 'everyday';
  const comfortLevel = input.comfortLevel ?? 'starting';

  return {
    settings: {
      daily_question_goal: dailyQuestions,
      goals: toUserGoals(primaryGoal),
      has_completed_onboarding: true,
      comfort_level: comfortLevel,
      friction_areas: frictionAreas,
      friction_area: frictionArea,
    },
    trainingGoals: {
      dailyQuestions,
      sessionDurationMinutes,
      weeklyFrequencyDays,
      frictionArea,
      frictionAreas,
      comfortLevel,
      primaryGoal,
    },
    friction_area: frictionArea,
  };
}
