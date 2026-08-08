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

export type FeedbackState = 'idle' | 'correct' | 'incorrect';