import { CoreOperation, DifficultyLevel } from '../math/types';
import { ComfortLevel, FrictionArea } from '../../types/profile';
import { OnboardingPrimaryGoal } from '../../utils/onboardingDraft';

/** An operation the coach can recommend: one of the four, or a mix of all four. */
export type CoachOperation = CoreOperation | 'mixed';

/** How a workout was started. Rows saved before the new coach have no source (null). */
export type WorkoutSource = 'warmup' | 'coach' | 'manual';

/** Per-operation result inside one workout (stored in workout_sessions.breakdown). */
export interface OperationResult {
  questions: number;
  correct: number;
  timeMs: number;
  difficulty: DifficultyLevel;
}

export type WorkoutBreakdown = Partial<Record<CoreOperation, OperationResult>>;

/** A finished workout as the coach sees it: a workout_sessions row or a queued offline workout. */
export interface CoachWorkout {
  id?: string;
  operation: string;
  difficulty: string;
  total_questions: number;
  correct_answers: number;
  total_time: number;
  completed_at: string;
  source?: WorkoutSource | null;
  breakdown?: WorkoutBreakdown | null;
}

/** The user's plan from onboarding / Profile. */
export interface CoachPlanInput {
  goal?: OnboardingPrimaryGoal | null;
  frictionAreas?: FrictionArea[] | null;
  comfortLevel?: ComfortLevel | null;
  dailyQuestionGoal?: number | null;
  sessionDurationMinutes?: number | null;
  /** When the Level was last changed in Profile; earlier workouts no longer move difficulty. */
  levelSetAt?: string | null;
}

export type OperationLevels = Record<CoreOperation, DifficultyLevel>;

export type CoachWorkoutKind = 'warmup' | 'daily' | 'mix';

export type HomeMessageKind =
  | 'warmup'
  | 'warmup_not_sure'
  | 'goal_done'
  | 'mix'
  | 'improving'
  | 'quick_check'
  | 'daily'
  | 'practice_only';

/** Everything a screen needs to start a workout. */
export interface WorkoutRequest {
  kind: CoachWorkoutKind;
  source: WorkoutSource;
  /** What is saved as workout_sessions.operation. */
  operation: CoachOperation;
  /** The operations questions are drawn from. */
  operations: CoreOperation[];
  difficultyByOperation: Partial<Record<CoreOperation, DifficultyLevel>>;
  questionCount: number;
}

export interface CoachPlan {
  /**
   * True when the history couldn't be read (offline, nothing cached). There is no pick,
   * levels come from the plan alone, and every round is manual.
   */
  historyUnknown: boolean;
  /** True until the first non-manual workout is done (saved or queued). */
  isFirstWorkout: boolean;
  workout: WorkoutRequest;
  /** Today's pick for the center bubble on Home. */
  focus: CoachOperation;
  /** Operations on Hard with 5 strong rounds in a row (see mastery.ts). */
  mastered: CoreOperation[];
  /** "× Multiplying · Medium", or "Mixing them up" with no level. */
  focusLabel: string;
  levels: OperationLevels;
  message: {
    kind: HomeMessageKind;
    heading: string;
    subheading: string;
    button: string;
  };
  /** One line about the user's goal, for Home only. */
  goalLine: string | null;
  /** Small optional hint, roughly once a week. */
  tryNew: { operation: CoreOperation; text: string } | null;
  questionsToday: number;
  goalDoneToday: boolean;
}
