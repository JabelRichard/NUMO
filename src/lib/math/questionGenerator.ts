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

// Configurable Number Ranges by Difficulty for Medium and Hard
const DIFFICULTY_RANGES: Record<
  'medium' | 'hard',
  Record<CoreOperation, { min1: number; max1: number; min2: number; max2: number }>
> = {
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

  public resetHistory(): void {
    this.history.clear();
  }

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

    let num1 = 0;
    let num2 = 0;
    let answer = 0;
    let signature = '';
    let maxAttempts = 25;

    while (maxAttempts > 0) {
      if (difficulty === 'easy') {
        if (resolvedOp === 'addition') {
          // 50% chance: 1-digit + 1-digit (e.g. 1+2)
          // 50% chance: 2-digit + 1-digit (e.g. 12+3)
          const isTwoDigit = Math.random() < 0.5;
          num1 = isTwoDigit ? getRandomInt(10, 99) : getRandomInt(1, 9);
          num2 = getRandomInt(1, 9);
          answer = num1 + num2;
        } else if (resolvedOp === 'subtraction') {
          // 50% chance: 1-digit - 1-digit (e.g. 8-3)
          // 50% chance: 2-digit - 1-digit (e.g. 15-4)
          const isTwoDigit = Math.random() < 0.5;
          num1 = isTwoDigit ? getRandomInt(10, 50) : getRandomInt(2, 9);
          num2 = getRandomInt(1, Math.min(num1 - 1, 9)); // Keep result positive and single-digit subtrahend
          answer = num1 - num2;
        } else if (resolvedOp === 'multiplication') {
          // Single-digit multiplication (e.g. 3 x 4, up to 9 x 9)
          num1 = getRandomInt(1, 9);
          num2 = getRandomInt(1, 9);
          answer = num1 * num2;
        } else if (resolvedOp === 'division') {
          // Clean single-digit quotient & divisor (e.g. 12 ÷ 3 = 4)
          const divisor = getRandomInt(2, 9);
          const quotient = getRandomInt(1, 9);
          num1 = divisor * quotient;
          num2 = divisor;
          answer = quotient;
        }
      } else {
        // Medium and Hard ranges
        const ranges = DIFFICULTY_RANGES[difficulty][resolvedOp];

        if (resolvedOp === 'addition') {
          num1 = getRandomInt(ranges.min1, ranges.max1);
          num2 = getRandomInt(ranges.min2, ranges.max2);
          answer = num1 + num2;
        } else if (resolvedOp === 'subtraction') {
          const valA = getRandomInt(ranges.min1, ranges.max1);
          const valB = getRandomInt(ranges.min2, ranges.max2);
          num1 = Math.max(valA, valB);
          num2 = Math.min(valA, valB);
          if (num1 === num2) num1 += getRandomInt(1, 10);
          answer = num1 - num2;
        } else if (resolvedOp === 'multiplication') {
          num1 = getRandomInt(ranges.min1, ranges.max1);
          num2 = getRandomInt(ranges.min2, ranges.max2);
          answer = num1 * num2;
        } else if (resolvedOp === 'division') {
          const divisor = getRandomInt(ranges.min2, ranges.max2);
          const quotient = getRandomInt(ranges.min1, ranges.max1);
          num1 = divisor * quotient;
          num2 = divisor;
          answer = quotient;
        }
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