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

const pickOne = <T>(items: readonly T[]): T => items[getRandomInt(0, items.length - 1)];

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const CORE_OPERATIONS: CoreOperation[] = ['addition', 'subtraction', 'multiplication', 'division'];

// Operator display symbols
const OPERATOR_SYMBOLS: Record<CoreOperation, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
};

// Easy times tables (×10 and ÷10 only appear here). Medium uses tables 2 to 9.
const EASY_TABLES = [2, 3, 4, 5, 10] as const;
// Hard numbers skip anything ending in 0: 11 or 12 times 6–12 (not 10), and 11–29 (not 20).
const HARD_TABLE_PARTNERS = [6, 7, 8, 9, 11, 12] as const;
const HARD_TWO_DIGIT = Array.from({ length: 19 }, (_, i) => 11 + i).filter((n) => n % 10 !== 0);

/**
 * A multiplication fact for each level, returned as [divisor, other].
 * Division reuses these facts (dividing the product by the first number),
 * so ÷ always mirrors × at the same level.
 * Neither number is ever 1, so ×1 and ÷1 never appear.
 */
function pickMultiplicationFact(difficulty: DifficultyLevel): [number, number] {
  if (difficulty === 'easy') {
    return [pickOne(EASY_TABLES), getRandomInt(2, 10)];
  }
  if (difficulty === 'medium') {
    return [getRandomInt(2, 9), getRandomInt(2, 9)];
  }
  // Hard: 11 or 12 times 6–12 (11 × 7, 84 ÷ 7, 132 ÷ 12),
  // or a 2-digit number times 3–9 (23 × 4, 92 ÷ 4).
  if (Math.random() < 0.5) {
    const table = getRandomInt(11, 12);
    const other = pickOne(HARD_TABLE_PARTNERS);
    return Math.random() < 0.5 ? [table, other] : [other, table];
  }
  return [getRandomInt(3, 9), pickOne(HARD_TWO_DIGIT)];
}

interface GeneratedNumbers {
  num1: number;
  num2: number;
  answer: number;
  // Questions with the same key count as repeats (3 × 4 and 4 × 3 share one).
  repeatKey: string;
}

function generateNumbers(op: CoreOperation, difficulty: DifficultyLevel): GeneratedNumbers {
  if (op === 'addition') {
    let num1: number;
    let num2: number;
    if (difficulty === 'easy') {
      num1 = getRandomInt(2, 20);
      num2 = getRandomInt(1, 9);
    } else if (difficulty === 'medium') {
      num1 = getRandomInt(10, 99);
      num2 = getRandomInt(10, 99);
    } else {
      num1 = getRandomInt(100, 500);
      num2 = getRandomInt(10, 99);
    }
    const [low, high] = num1 < num2 ? [num1, num2] : [num2, num1];
    return { num1, num2, answer: num1 + num2, repeatKey: `add_${low}_${high}` };
  }

  if (op === 'subtraction') {
    // The second number is always smaller, so answers are never negative or zero.
    let num1: number;
    let num2: number;
    if (difficulty === 'easy') {
      num1 = getRandomInt(2, 20);
      num2 = getRandomInt(1, Math.min(9, num1 - 1));
    } else if (difficulty === 'medium') {
      num1 = getRandomInt(20, 99);
      num2 = getRandomInt(2, num1 - 1);
    } else {
      num1 = getRandomInt(100, 500);
      num2 = getRandomInt(10, 99);
    }
    return { num1, num2, answer: num1 - num2, repeatKey: `sub_${num1}_${num2}` };
  }

  const [table, other] = pickMultiplicationFact(difficulty);
  const factKey = `${Math.min(table, other)}_${Math.max(table, other)}`;

  if (op === 'multiplication') {
    const [num1, num2] = Math.random() < 0.5 ? [table, other] : [other, table];
    return { num1, num2, answer: table * other, repeatKey: `mul_${factKey}` };
  }

  // Division: divide the product by the first number (28 ÷ 4 = 7, 92 ÷ 4 = 23).
  return { num1: table * other, num2: table, answer: other, repeatKey: `div_${factKey}` };
}

/** The operations a session draws from: an explicit list, all four for mixed, or one. */
function resolveOperations(config: GeneratorConfig): CoreOperation[] {
  const listed = (config.operations ?? []).filter((op) => CORE_OPERATIONS.includes(op));
  if (listed.length > 0) return Array.from(new Set(listed));
  return config.operation === 'mixed' ? CORE_OPERATIONS : [config.operation];
}

/**
 * Spreads the questions evenly across the operations, then shuffles the order.
 * 20 questions over 4 operations gives 5 of each; any remainder goes to random operations.
 */
export function planOperationOrder(operations: CoreOperation[], questionCount: number): CoreOperation[] {
  const rotation = shuffle(operations);
  const order: CoreOperation[] = [];
  for (let i = 0; i < questionCount; i++) {
    order.push(rotation[i % rotation.length]);
  }
  return shuffle(order);
}

export class QuestionGenerator {
  private history: Set<string> = new Set();

  public resetHistory(): void {
    this.history.clear();
  }

  public generateQuestion(
    op: OperationType,
    difficulty: DifficultyLevel = 'easy'
  ): MathQuestion {
    const resolvedOp: CoreOperation = op === 'mixed' ? pickOne(CORE_OPERATIONS) : op;
    return this.generateCoreQuestion(resolvedOp, difficulty);
  }

  private generateCoreQuestion(op: CoreOperation, difficulty: DifficultyLevel): MathQuestion {
    let numbers = generateNumbers(op, difficulty);

    // Retry a few times to avoid repeats; small fact sets can still run out.
    for (let attempt = 0; attempt < 25 && this.history.has(numbers.repeatKey); attempt++) {
      numbers = generateNumbers(op, difficulty);
    }
    this.history.add(numbers.repeatKey);

    const symbol = OPERATOR_SYMBOLS[op];

    return {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      operation: op,
      num1: numbers.num1,
      num2: numbers.num2,
      operatorSymbol: symbol,
      equation: `${numbers.num1} ${symbol} ${numbers.num2}`,
      answer: numbers.answer,
      difficulty,
    };
  }

  public generateSession(config: GeneratorConfig): MathQuestion[] {
    const { difficulty = 'easy', difficultyByOperation, questionCount = 20 } = config;
    this.resetHistory();

    const order = planOperationOrder(resolveOperations(config), questionCount);
    return order.map((op) =>
      this.generateCoreQuestion(op, difficultyByOperation?.[op] ?? difficulty)
    );
  }
}

export const defaultQuestionGenerator = new QuestionGenerator();
