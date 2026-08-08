export type OperationType =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'mixed';

export type CoreOperation = 'addition' | 'subtraction' | 'multiplication' | 'division';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type FeedbackState = 'idle' | 'correct' | 'incorrect';

export interface MathQuestion {
  id: string;
  operation: CoreOperation;
  num1: number;
  num2: number;
  operatorSymbol: string;
  equation: string;
  answer: number;
  difficulty: DifficultyLevel;
}

export interface QuestionAttemptResult {
  question: MathQuestion;
  userAnswer: number;
  isCorrect: boolean;
  timeTakenMs: number;
  timestamp: number;
}

export interface GeneratorConfig {
  operation: OperationType;
  difficulty?: DifficultyLevel;
  questionCount?: number;
}

export interface WorkoutSessionSummary {
  mode: OperationType;
  difficulty: DifficultyLevel;
  totalQuestions: number;
  correctAnswersCount: number;
  accuracyPercentage: number;
  totalTimeSpentMs: number;
  averageTimePerQuestionMs: number;
  attempts: QuestionAttemptResult[];
}