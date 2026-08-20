// src/types/settings.ts
export type UserGoal = 'speed' | 'accuracy' | 'mental_math' | 'consistency' | 'balanced';

export interface UserSettings {
  daily_question_goal: number;
  goals: UserGoal[];
  has_completed_onboarding: boolean;
  updated_at?: string;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  daily_question_goal: 20,
  goals: ['balanced'],
  has_completed_onboarding: false,
};