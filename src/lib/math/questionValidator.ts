import { MathQuestion, QuestionAttemptResult } from './types';

/**
 * Validates whether the user's numerical input matches the question answer
 */
export const validateAnswer = (
  question: MathQuestion,
  userInput: string | number
): boolean => {
  if (userInput === undefined || userInput === null) return false;

  const parsedInput =
    typeof userInput === 'string' ? parseInt(userInput.trim(), 10) : userInput;

  if (isNaN(parsedInput)) return false;

  return parsedInput === question.answer;
};

/**
 * Records attempt metadata including duration in milliseconds
 */
export const recordAttempt = (
  question: MathQuestion,
  userInput: string | number,
  timeTakenMs: number
): QuestionAttemptResult => {
  const parsedInput =
    typeof userInput === 'string' ? parseInt(userInput.trim(), 10) : userInput;
  const isCorrect = validateAnswer(question, parsedInput);

  return {
    question,
    userAnswer: isNaN(parsedInput) ? 0 : parsedInput,
    isCorrect,
    timeTakenMs,
    timestamp: Date.now(),
  };
};