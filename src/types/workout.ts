export type WorkoutMode = 'normal' | 'demo';

export type FeedbackState = 'idle' | 'correct' | 'incorrect';

export interface MathQuestion {
  id: string;
  equation: string;
  answer: number;
}

export interface QuestionResult {
  questionId: string;
  equation: string;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  timeSpentMs: number;
}

export interface WorkoutResultData {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  totalTimeMs: number;
  avgTimePerQuestionMs: number;
  results: QuestionResult[];
  completedAt: string;
  isDemo?: boolean;
}