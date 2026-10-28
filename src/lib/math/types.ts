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
  // Draw only from these operations (e.g. × and ÷). Overrides `operation` when not empty.
  operations?: CoreOperation[];
  difficulty?: DifficultyLevel;
  // A level per operation inside one session; falls back to `difficulty`.
  difficultyByOperation?: Partial<Record<CoreOperation, DifficultyLevel>>;
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