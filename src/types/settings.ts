// src/types/settings.ts
import type { ComfortLevel, FrictionArea } from './profile';

export type UserGoal =
  | 'everyday'
  | 'school'
  | 'memory'
  | 'work'
  // Legacy onboarding ids, still found in saved data. Read through normalizePrimaryGoal().
  | 'career'
  | 'speed'
  | 'accuracy'
  | 'mental_math'
  | 'consistency'
  | 'balanced';

export interface UserSettings {
  daily_question_goal: number;
  session_duration_minutes?: number | null;
  weekly_frequency_days?: number | null; // 1–7
  goals: UserGoal[];
  has_completed_onboarding: boolean;
  comfort_level?: ComfortLevel | null;
  friction_areas?: FrictionArea[] | null; // Empty array = "Not sure, test me"
  friction_area?: FrictionArea | null;    // Legacy single pick, still written for old readers
  level_set_at?: string | null;           // When the Level last changed; the coach restarts from it
  updated_at?: string;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  daily_question_goal: 10,
  goals: ['everyday'],
  has_completed_onboarding: false,
};