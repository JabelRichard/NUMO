// src/types/settings.ts
export type UserGoal =
  | 'everyday'
  | 'memory'
  | 'career'
  | 'speed'
  | 'accuracy'
  | 'mental_math'
  | 'consistency'
  | 'balanced';

export interface UserSettings {
  daily_question_goal: number;
  goals: UserGoal[];
  has_completed_onboarding: boolean;
  updated_at?: string;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  daily_question_goal: 10,
  goals: ['speed'],
  has_completed_onboarding: false,
};