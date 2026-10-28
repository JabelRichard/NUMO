import { QuestionGenerator, CORE_OPERATIONS } from '../questionGenerator';
import { LEVEL_EXAMPLES, levelExample } from '../../coach/copy';
import { CoreOperation, DifficultyLevel, MathQuestion } from '../types';

const LEVELS: DifficultyLevel[] = ['easy', 'medium', 'hard'];
const SAMPLES = 3000;

function sample(op: CoreOperation, difficulty: DifficultyLevel): MathQuestion[] {
  const generator = new QuestionGenerator();
  const questions: MathQuestion[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    if (i % 20 === 0) generator.resetHistory();
    questions.push(generator.generateQuestion(op, difficulty));
  }
  return questions;
}

const between = (n: number, min: number, max: number) => n >= min && n <= max;

// Hard × / ÷ facts: 11 or 12 times 6–12 (not 10), or 11–29 (not 20) times 3–9.
const isElevenOrTwelveFact = (table: number, other: number) =>
  (table === 11 || table === 12) && between(other, 6, 12) && other !== 10;
const isHardTwoDigit = (n: number) => between(n, 11, 29) && n % 10 !== 0;
const isHardFact = (a: number, b: number) => isElevenOrTwelveFact(a, b) || (between(a, 3, 9) && isHardTwoDigit(b));

describe('question ranges', () => {
  it('addition', () => {
    for (const q of sample('addition', 'easy')) {
      expect(between(q.num1, 2, 20) && between(q.num2, 1, 9)).toBe(true);
    }
    for (const q of sample('addition', 'medium')) {
      expect(between(q.num1, 10, 99) && between(q.num2, 10, 99)).toBe(true);
    }
    for (const q of sample('addition', 'hard')) {
      expect(between(q.num1, 100, 500) && between(q.num2, 10, 99)).toBe(true);
    }
  });

  it('subtraction is never negative or zero', () => {
    for (const q of sample('subtraction', 'easy')) {
      expect(between(q.num1, 2, 20) && between(q.num2, 1, 9)).toBe(true);
    }
    for (const q of sample('subtraction', 'medium')) {
      expect(between(q.num1, 20, 99) && q.num2 < q.num1).toBe(true);
    }
    for (const q of sample('subtraction', 'hard')) {
      expect(between(q.num1, 100, 500) && between(q.num2, 10, 99)).toBe(true);
    }
    for (const level of LEVELS) {
      for (const q of sample('subtraction', level)) {
        expect(q.answer).toBeGreaterThanOrEqual(1);
        expect(q.answer).toBe(q.num1 - q.num2);
      }
    }
  });

  it('multiplication uses the right tables and never ×1', () => {
    for (const q of sample('multiplication', 'easy')) {
      const usesEasyTable = [2, 3, 4, 5, 10].some(
        (t) => (q.num1 === t && between(q.num2, 2, 10)) || (q.num2 === t && between(q.num1, 2, 10))
      );
      expect(usesEasyTable).toBe(true);
    }
    for (const q of sample('multiplication', 'medium')) {
      expect(between(q.num1, 2, 9) && between(q.num2, 2, 9)).toBe(true);
    }
    for (const q of sample('multiplication', 'hard')) {
      expect(isHardFact(q.num1, q.num2) || isHardFact(q.num2, q.num1)).toBe(true);
      expect(q.num1 % 10).not.toBe(0);
      expect(q.num2 % 10).not.toBe(0);
    }
    for (const level of LEVELS) {
      for (const q of sample('multiplication', level)) {
        expect(q.num1).toBeGreaterThan(1);
        expect(q.num2).toBeGreaterThan(1);
        expect(q.answer).toBe(q.num1 * q.num2);
      }
    }
  });

  it('division mirrors multiplication, always whole, never ÷1 or n÷n', () => {
    for (const level of LEVELS) {
      for (const q of sample('division', level)) {
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.num2 * q.answer).toBe(q.num1);
        expect(q.num2).toBeGreaterThan(1);
        expect(q.answer).toBeGreaterThan(1);
      }
    }
    for (const q of sample('division', 'easy')) {
      expect([2, 3, 4, 5, 10]).toContain(q.num2);
      expect(between(q.answer, 2, 10)).toBe(true);
    }
    for (const q of sample('division', 'medium')) {
      expect(between(q.num2, 2, 9) && between(q.answer, 2, 9)).toBe(true);
    }
    for (const q of sample('division', 'hard')) {
      // 84 ÷ 7 and 132 ÷ 12 (11/12 facts either way round), or 92 ÷ 4 (divide by the single digit).
      const elevenOrTwelve = isElevenOrTwelveFact(q.num2, q.answer) || isElevenOrTwelveFact(q.answer, q.num2);
      const bigQuotient = between(q.num2, 3, 9) && isHardTwoDigit(q.answer);
      expect(elevenOrTwelve || bigQuotient).toBe(true);
    }
  });
});

describe('sessions', () => {
  it('treats 3 × 4 and 4 × 3 as the same question', () => {
    const generator = new QuestionGenerator();
    // Easy × has 35 distinct facts, so 20 questions should never repeat one.
    const questions = generator.generateSession({ operation: 'multiplication', difficulty: 'easy', questionCount: 20 });
    const facts = questions.map((q) => `${Math.min(q.num1, q.num2)}x${Math.max(q.num1, q.num2)}`);
    expect(new Set(facts).size).toBe(facts.length);
  });

  it('treats 12 ÷ 3 and 12 ÷ 4 as the same fact', () => {
    const generator = new QuestionGenerator();
    const questions = generator.generateSession({ operation: 'division', difficulty: 'medium', questionCount: 20 });
    const facts = questions.map((q) => `${Math.min(q.num2, q.answer)}x${Math.max(q.num2, q.answer)}`);
    expect(new Set(facts).size).toBe(facts.length);
  });

  it('spreads mixed rounds evenly across all four operations', () => {
    const generator = new QuestionGenerator();
    for (let i = 0; i < 200; i++) {
      const questions = generator.generateSession({ operation: 'mixed', difficulty: 'easy', questionCount: 20 });
      for (const op of CORE_OPERATIONS) {
        expect(questions.filter((q) => q.operation === op)).toHaveLength(5);
      }
    }
  });

  it('a 10-question mix covers every operation', () => {
    const generator = new QuestionGenerator();
    for (let i = 0; i < 200; i++) {
      const questions = generator.generateSession({ operation: 'mixed', questionCount: 10 });
      const counts = CORE_OPERATIONS.map((op) => questions.filter((q) => q.operation === op).length);
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
      expect(Math.max(...counts)).toBeLessThanOrEqual(3);
    }
  });

  it('can draw from only the chosen operations, each at its own level', () => {
    const generator = new QuestionGenerator();
    const questions = generator.generateSession({
      operation: 'mixed',
      operations: ['multiplication', 'division'],
      difficultyByOperation: { multiplication: 'hard', division: 'easy' },
      questionCount: 10,
    });
    expect(questions.filter((q) => q.operation === 'multiplication')).toHaveLength(5);
    expect(questions.filter((q) => q.operation === 'division')).toHaveLength(5);
    for (const q of questions) {
      expect(q.difficulty).toBe(q.operation === 'multiplication' ? 'hard' : 'easy');
    }
  });

  it('a single operation stays a single operation', () => {
    const generator = new QuestionGenerator();
    const questions = generator.generateSession({ operation: 'subtraction', difficulty: 'medium', questionCount: 12 });
    expect(questions.every((q) => q.operation === 'subtraction' && q.difficulty === 'medium')).toBe(true);
  });
});

describe('Practice sheet examples', () => {
  const min = (ns: number[]) => Math.min(...ns);
  const max = (ns: number[]) => Math.max(...ns);

  it.each(CORE_OPERATIONS.flatMap((op) => LEVELS.map((level) => [op, level] as const)))(
    '%s %s is a question the generator can ask',
    (op, level) => {
      const [first, second] = LEVEL_EXAMPLES[op][level];
      const questions = [...sample(op, level), ...sample(op, level), ...sample(op, level)];

      if (op === 'multiplication' || op === 'division') {
        // Small fact sets: the exact question shows up (× in either order).
        const seen = questions.some(
          (q) =>
            (q.num1 === first && q.num2 === second) ||
            (op === 'multiplication' && q.num1 === second && q.num2 === first)
        );
        expect(seen).toBe(true);
      } else {
        // Too many sums to hit one exactly: each number is inside the level's range.
        const firsts = questions.map((q) => q.num1);
        const seconds = questions.map((q) => q.num2);
        expect(between(first, min(firsts), max(firsts))).toBe(true);
        expect(between(second, min(seconds), max(seconds))).toBe(true);
        if (op === 'subtraction') expect(second).toBeLessThan(first);
      }
    }
  );

  it('formats like the sheet shows them', () => {
    expect(levelExample('multiplication', 'easy')).toBe('4×7');
    expect(levelExample('division', 'hard')).toBe('92÷4');
    expect(levelExample('subtraction', 'medium')).toBe('72−35');
    expect(levelExample('mixed', 'medium')).toBe('34+25 or 8×7');
  });
});
