import {
  DEFAULT_TRAINING_GOALS,
  FrictionArea,
  UserTrainingGoals,
} from '../types/profile';
import { UserGoal, UserSettings } from '../types/settings';

export const ONBOARDING_DRAFT_KEY = '@numo_onboarding_draft';
export const ONBOARDING_COMPLETED_KEY = '@numo_onboarding_completed';

export type OnboardingPrimaryGoal = 'everyday' | 'memory' | 'career' | 'speed';

export const FREQUENCY_DAY_OPTIONS = [
  { days: 3, label: '3 days' },
  { days: 5, label: '5 days' },
  { days: 7, label: 'Every day' },
] as const;

export const DURATION_MINUTE_OPTIONS = [2, 5, 10] as const;
export const QUESTION_GOAL_OPTIONS = [5, 10, 20, 30, 50] as const;

export interface OnboardingDraft {
  settings: UserSettings;
  trainingGoals: UserTrainingGoals;
  friction_area: FrictionArea;
}

export function toUserGoals(primaryGoal: OnboardingPrimaryGoal | null): UserGoal[] {
  return [primaryGoal ?? 'speed'];
}

export function frequencyLabel(days: number | null): string {
  if (!days) return '5 days';
  if (days >= 7) return 'Every day';
  return `${days} days`;
}

export function buildOnboardingDraft(input: {
  primaryGoal: OnboardingPrimaryGoal | null;
  frictionArea: FrictionArea | null;
  dailyQuestions: number | null;
  weeklyFrequencyDays: number | null;
  sessionDurationMinutes: number | null;
}): OnboardingDraft {
  const dailyQuestions =
    input.dailyQuestions ?? DEFAULT_TRAINING_GOALS.dailyQuestions;
  const weeklyFrequencyDays =
    input.weeklyFrequencyDays ?? DEFAULT_TRAINING_GOALS.weeklyFrequencyDays;
  const sessionDurationMinutes = input.sessionDurationMinutes ?? 2;
  const frictionArea = input.frictionArea ?? 'mixed';
  const primaryGoal = input.primaryGoal ?? 'speed';

  return {
    settings: {
      daily_question_goal: dailyQuestions,
      goals: toUserGoals(primaryGoal),
      has_completed_onboarding: true,
    },
    trainingGoals: {
      dailyQuestions,
      sessionDurationMinutes,
      weeklyFrequencyDays,
      frictionArea,
      primaryGoal,
    },
    friction_area: frictionArea,
  };
}
