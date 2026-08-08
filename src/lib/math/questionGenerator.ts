import {
  DifficultyLevel,
  OperationType,
  CoreOperation,
  MathQuestion,
  GeneratorConfig,
} from './types';

// Helper: Bounded random integer generator [min, max]
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Operator display symbols
const OPERATOR_SYMBOLS: Record<CoreOperation, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
};

// Configurable Number Ranges by Difficulty
const DIFFICULTY_RANGES: Record<
  DifficultyLevel,
  Record<CoreOperation, { min1: number; max1: number; min2: number; max2: number }>
> = {
  easy: {
    addition: { min1: 5, max1: 30, min2: 5, max2: 30 },
    subtraction: { min1: 10, max1: 40, min2: 1, max2: 20 },
    multiplication: { min1: 2, max1: 10, min2: 2, max2: 10 },
    division: { min1: 2, max1: 10, min2: 2, max2: 10 }, // Used for quotient & divisor
  },
  medium: {
    addition: { min1: 25, max1: 99, min2: 15, max2: 85 },
    subtraction: { min1: 45, max1: 150, min2: 15, max2: 95 },
    multiplication: { min1: 4, max1: 15, min2: 3, max2: 12 },
    division: { min1: 3, max1: 15, min2: 3, max2: 12 },
  },
  hard: {
    addition: { min1: 100, max1: 500, min2: 75, max2: 450 },
    subtraction: { min1: 150, max1: 750, min2: 50, max2: 400 },
    multiplication: { min1: 7, max1: 25, min2: 6, max2: 20 },
    division: { min1: 5, max1: 25, min2: 4, max2: 20 },
  },
};

export class QuestionGenerator {
  private history: Set<string> = new Set();

  /**
   * Resets question history for a new session
   */
  public resetHistory(): void {
    this.history.clear();
  }

  /**
   * Generates a single unique math question based on parameters
   */
  public generateQuestion(
    op: OperationType,
    difficulty: DifficultyLevel = 'easy'
  ): MathQuestion {
    let resolvedOp: CoreOperation;

    if (op === 'mixed') {
      const coreOps: CoreOperation[] = [
        'addition',
        'subtraction',
        'multiplication',
        'division',
      ];
      resolvedOp = coreOps[getRandomInt(0, coreOps.length - 1)];
    } else {
      resolvedOp = op;
    }

    const ranges = DIFFICULTY_RANGES[difficulty][resolvedOp];
    let num1 = 0;
    let num2 = 0;
    let answer = 0;
    let signature = '';
    let maxAttempts = 25;

    while (maxAttempts > 0) {
      if (resolvedOp === 'addition') {
        num1 = getRandomInt(ranges.min1, ranges.max1);
        num2 = getRandomInt(ranges.min2, ranges.max2);
        answer = num1 + num2;
      } else if (resolvedOp === 'subtraction') {
        const valA = getRandomInt(ranges.min1, ranges.max1);
        const valB = getRandomInt(ranges.min2, ranges.max2);
        // Ensure result is strictly positive
        num1 = Math.max(valA, valB);
        num2 = Math.min(valA, valB);
        if (num1 === num2) num1 += getRandomInt(1, 10);
        answer = num1 - num2;
      } else if (resolvedOp === 'multiplication') {
        num1 = getRandomInt(ranges.min1, ranges.max1);
        num2 = getRandomInt(ranges.min2, ranges.max2);
        answer = num1 * num2;
      } else if (resolvedOp === 'division') {
        // Generate divisor and quotient to guarantee integer dividends without decimals
        const divisor = getRandomInt(ranges.min2, ranges.max2);
        const quotient = getRandomInt(ranges.min1, ranges.max1);
        const dividend = divisor * quotient;

        num1 = dividend;
        num2 = divisor;
        answer = quotient;
      }

      signature = `${resolvedOp}_${num1}_${num2}`;

      if (!this.history.has(signature)) {
        this.history.add(signature);
        break;
      }

      maxAttempts--;
    }

    const symbol = OPERATOR_SYMBOLS[resolvedOp];

    return {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      operation: resolvedOp,
      num1,
      num2,
      operatorSymbol: symbol,
      equation: `${num1} ${symbol} ${num2}`,
      answer,
      difficulty,
    };
  }

  /**
   * Generates a batch of unique questions for a training session
   */
  public generateSession(config: GeneratorConfig): MathQuestion[] {
    const { operation, difficulty = 'easy', questionCount = 20 } = config;
    this.resetHistory();

    const questions: MathQuestion[] = [];
    for (let i = 0; i < questionCount; i++) {
      questions.push(this.generateQuestion(operation, difficulty));
    }

    return questions;
  }
}

export const defaultQuestionGenerator = new QuestionGenerator();