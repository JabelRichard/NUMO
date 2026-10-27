import { OperationType } from '../lib/math/types';
import { UserGoal } from './settings';

export type FrictionArea =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'mixed';

/**
 * Normalized training commitment values (stored as numbers, not strings)
 */
export interface UserTrainingGoals {
  dailyQuestions: number;       // e.g., 5, 10, 20, 30, 50
  sessionDurationMinutes: number; // e.g., 2, 5, 10
  weeklyFrequencyDays: number;   // e.g., 3, 5, 7
  frictionArea?: FrictionArea;
  primaryGoal?: UserGoal;
}

export const DEFAULT_TRAINING_GOALS: UserTrainingGoals = {
  dailyQuestions: 10,
  sessionDurationMinutes: 2,
  weeklyFrequencyDays: 5,
};

/**
 * Normalized representation of an individual workout session for activity history
 */
export interface CompletedWorkoutItem {
  id: string;
  operation: OperationType;
  difficulty: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;            // 0 - 100 percentage
  totalTimeMs: number;
  completedAt: string;          // ISO timestamp
}

export type ActivityTimeframe = '7D' | '30D' | '3M';

/**
 * Summary breakdown calculated for a specific timeframe in the bottom sheet
 */
export interface ActivityPeriodSummary {
  timeframe: ActivityTimeframe;
  questionsSolved: number;
  sessionsCompleted: number;
  averageAccuracy: number;      // 0 - 100 percentage
  recentSessions: CompletedWorkoutItem[];
}

/**
 * High-level athlete overview for the Profile Screen surface
 */
export interface ProfileActivityOverview {
  lifetimeQuestions: number;
  lifetimeSessions: number;
  latestWorkout: CompletedWorkoutItem | null;
}