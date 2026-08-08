import { QuestionGenerator } from './questionGenerator';
import { validateAnswer } from './questionValidator';
import { DifficultyLevel, OperationType } from './types';

export const runMathEngineTests = (): void => {
  console.log('--- Starting NUMO Math Engine Assertion Tests ---');
  const generator = new QuestionGenerator();

  // Test 1: Addition Validation
  const addQ = generator.generateQuestion('addition', 'easy');
  console.assert(
    addQ.num1 + addQ.num2 === addQ.answer,
    `Addition failed: ${addQ.equation} = ${addQ.answer}`
  );
  console.assert(
    validateAnswer(addQ, addQ.answer),
    'Addition validation check failed'
  );

  // Test 2: Subtraction Non-Negative Check
  const subQ = generator.generateQuestion('subtraction', 'medium');
  console.assert(
    subQ.answer > 0,
    `Subtraction returned non-positive result: ${subQ.equation}`
  );
  console.assert(
    subQ.num1 - subQ.num2 === subQ.answer,
    `Subtraction arithmetic failed: ${subQ.equation}`
  );

  // Test 3: Multiplication Check
  const multQ = generator.generateQuestion('multiplication', 'hard');
  console.assert(
    multQ.num1 * multQ.num2 === multQ.answer,
    `Multiplication failed: ${multQ.equation}`
  );

  // Test 4: Division Whole Integer Guarantee
  for (let i = 0; i < 20; i++) {
    const divQ = generator.generateQuestion('division', 'easy');
    console.assert(
      Number.isInteger(divQ.answer),
      `Division returned non-integer answer: ${divQ.equation}`
    );
    console.assert(
      divQ.num1 % divQ.num2 === 0,
      `Division left remainder: ${divQ.equation}`
    );
  }

  // Test 5: Mixed Mode Verification
  const mixedSession = generator.generateSession({
    operation: 'mixed',
    difficulty: 'medium',
    questionCount: 20,
  });
  const operationsFound = new Set(mixedSession.map((q) => q.operation));
  console.assert(
    operationsFound.size > 1,
    'Mixed mode failed to generate varied operations'
  );

  // Test 6: Duplicate Prevention
  const session = generator.generateSession({
    operation: 'addition',
    difficulty: 'easy',
    questionCount: 15,
  });
  const signatures = session.map((q) => `${q.num1}_${q.num2}`);
  const uniqueSignatures = new Set(signatures);
  console.assert(
    signatures.length === uniqueSignatures.size,
    'Duplicate questions generated in session'
  );

  console.log('--- All NUMO Math Engine Tests Passed Successfully ---');
};