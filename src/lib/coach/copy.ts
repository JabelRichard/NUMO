import { CoreOperation, DifficultyLevel } from '../math/types';
import { COMFORT_LEVELS, WEAK_SPOTS } from '../../constants/planOptions';
import { ComfortLevel } from '../../types/profile';
import { OnboardingPrimaryGoal, questionsForDuration } from '../../utils/onboardingDraft';
import { CoachOperation } from './types';

// Every coach message uses the same names as onboarding and Profile ("× Multiplying").

const spot = (op: CoachOperation) => WEAK_SPOTS.find((w) => w.id === op);

/** "+", "−", "×", "÷". */
export const operationSymbol = (op: CoreOperation): string => spot(op)?.symbol ?? '';

/** "Multiplying", "Mixing them up": the name without its symbol, for screen readers. */
export const operationTitle = (op: CoachOperation): string => spot(op)?.title ?? op;

/** Short names for the small cards on Home, where "Mixing them up" won't fit. */
const SHORT_NAMES: Record<CoachOperation, string> = {
  addition: 'Adding',
  subtraction: 'Subtract',
  multiplication: 'Multiply',
  division: 'Dividing',
  mixed: 'Mixed',
};

/** "× Multiplying", or "Mixing them up". */
export function operationName(op: CoachOperation): string {
  const s = spot(op);
  if (!s) return op;
  return s.symbol ? `${s.symbol} ${s.title}` : s.title;
}

export const LEVEL_NAMES: Record<DifficultyLevel, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/**
 * One real question per level, as [first number, second number]. Each one is a question
 * the generator can ask at that level (checked in questionGenerator.test.ts).
 */
export const LEVEL_EXAMPLES: Record<CoreOperation, Record<DifficultyLevel, [number, number]>> = {
  addition: { easy: [12, 7], medium: [34, 25], hard: [245, 38] },
  subtraction: { easy: [15, 6], medium: [72, 35], hard: [312, 47] },
  multiplication: { easy: [4, 7], medium: [8, 7], hard: [23, 4] },
  division: { easy: [28, 4], medium: [56, 8], hard: [92, 4] },
};

/** "4×7"; a mix shows two: "12+7 or 4×7". */
export function levelExample(op: CoachOperation, level: DifficultyLevel): string {
  if (op === 'mixed') return `${levelExample('addition', level)} or ${levelExample('multiplication', level)}`;
  const [first, second] = LEVEL_EXAMPLES[op][level];
  return `${first}${operationSymbol(op)}${second}`;
}

export const comfortName = (level: ComfortLevel) =>
  COMFORT_LEVELS.find((c) => c.id === level)?.title ?? level;

/** "× Multiplying · Medium"; a mix has no single level, so it shows the name only. */
export function focusLabel(op: CoachOperation, level?: DifficultyLevel): string {
  return op === 'mixed' || !level ? operationName(op) : `${operationName(op)} · ${LEVEL_NAMES[level]}`;
}

export const GOAL_LINES: Record<OnboardingPrimaryGoal, string> = {
  everyday: 'Great for quick shopping math.',
  school: 'Great practice for class and tests.',
  work: 'Sharp numbers for meetings and exams.',
  memory: 'Keeps your mind quick.',
};

const SECONDS_PER_QUESTION = 15;

/**
 * Minutes for a round. Uses the minutes the user picked when their daily goal still
 * matches them; otherwise estimates about 15 seconds per question.
 */
export function estimateMinutes(questionCount: number, sessionDurationMinutes?: number | null): number {
  if (sessionDurationMinutes && questionsForDuration(sessionDurationMinutes) === questionCount) {
    return sessionDurationMinutes;
  }
  return Math.max(1, Math.round((questionCount * SECONDS_PER_QUESTION) / 60));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "20 questions, about 5 minutes." */
export function roundLength(questionCount: number, sessionDurationMinutes?: number | null): string {
  const minutes = estimateMinutes(questionCount, sessionDurationMinutes);
  return `${plural(questionCount, 'question')}, about ${plural(minutes, 'minute')}.`;
}

/** "× and ÷", "+, × and ÷". */
export function symbolList(ops: CoreOperation[]): string {
  const symbols = ops.map(operationSymbol);
  if (symbols.length <= 1) return symbols.join('');
  return `${symbols.slice(0, -1).join(', ')} and ${symbols[symbols.length - 1]}`;
}

const WARMUP_LEVEL_WORD: Record<DifficultyLevel, string> = {
  easy: 'easy ',
  medium: '',
  hard: 'challenging ',
};

export const COPY = {
  warmupHeading: "Let's start with a warm-up",
  warmupSubheading: (count: number, ops: CoreOperation[], level: DifficultyLevel) =>
    ops.length === 1
      ? `${count} ${WARMUP_LEVEL_WORD[level]}questions on ${operationName(ops[0])}, the one you picked.`
      : `${count} ${WARMUP_LEVEL_WORD[level]}questions on ${symbolList(ops)}, the ones you picked.`,
  warmupNotSureHeading: "Let's see what you're great at",
  warmupNotSureSubheading: (count: number) =>
    `${count} quick mixed questions. We'll find what to practice.`,
  warmupButton: 'Start warm-up',
  /** Title on the workout screen. */
  warmupTitle: (count: number) => `Warm-up · ${plural(count, 'question')}`,

  dailyHeading: (op: CoachOperation) => `Today: ${operationName(op)}`,
  dailyPickedSubheading: (length: string) => `You picked this one. ${length}`,
  dailyNotSureSubheading: (length: string) => `A bit of everything while we find what to practice. ${length}`,
  improvingHeading: "You're getting faster!",
  improvingSubheading: (op: CoachOperation, length: string) =>
    `${operationName(op)} is improving. Let's keep going. ${length}`,
  quickCheckHeading: (op: CoachOperation) => `Quick check: ${operationName(op)}`,
  quickCheckSubheading: (length: string) => `You mastered this one. Let's make sure it still feels easy. ${length}`,
  mixHeading: 'Mix it up',
  mixSubheading: (length: string) => `A bit of everything to keep it all fresh. ${length}`,
  goalDoneHeading: 'Goal done for today!',
  goalDoneSubheading: 'Come back tomorrow, or do a bonus round.',
  /** History couldn't be loaded (offline, nothing saved on this phone yet). */
  practiceOnlyHeading: 'Pick something to practice',
  practiceOnlySubheading: (length: string) => `Practice rounds won't change your levels. ${length}`,
  practiceOnlyPickSubheading: (length: string) => `Practice round. It won't change your level. ${length}`,
  startButton: 'Start workout',
  bonusButton: 'Bonus round',

  tryNew: (op: CoreOperation) => `Try something new: ${operationName(op)}`,

  /** Home, after tapping another bubble: a one-time choice. */
  pickHeading: (op: CoachOperation) => `Your pick: ${operationName(op)}`,
  pickSubheading: (length: string) => `Just this once, then back to your plan. ${length}`,
  pickWarmupSubheading: (length: string) => `This will be your warm-up. ${length}`,

  /** Home header, by the phone's local hour. */
  greeting: (hour: number) =>
    hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,',
  openProfile: 'Open your profile',
  /** Home streak card. */
  dayStreak: (days: number) => `${days}-day streak`,
  ofGoalToday: (goal: number) => `of ${goal} today`,
  questionsTodayLabel: (done: number, goal: number) => `${done} of ${goal} questions done today`,
  daysThisWeek: (done: number, target: number) => `${done} of ${plural(target, 'day')} this week`,
  weekDayLabel: (day: string, practiced: boolean, isToday: boolean) =>
    `${day}${isToday ? ', today' : ''}: ${practiced ? 'practised' : 'not practised'}`,
  /** Home hero card. */
  goalDoneChip: 'Goal done for today',
  /** Home only; the heading then says "Today: …" instead of improvingHeading. */
  improvingChip: "You're getting faster",
  heroQuestions: (count: number) => plural(count, 'question'),
  heroMinutes: (minutes: number) => `~${minutes} min`,
  heroLabel: (button: string, op: CoachOperation, count: number) =>
    `${button}: ${operationTitle(op)}, ${plural(count, 'question')}`,
  /** Home "pick your own" row. */
  pickYourOwn: 'Or pick your own',
  pickShortName: (op: CoachOperation) => SHORT_NAMES[op],
  tryNewShort: (op: CoreOperation) => `Try ${operationName(op)}`,
  masteredTag: 'Mastered',
  mixedLevelsTag: 'Your levels',
  pickLabel: (op: CoachOperation, tag: string) => `${operationTitle(op)}, ${tag}. Pick it for one workout`,
  backToPlan: "Back to today's plan",

  resultsWarmupSubtitle: "Here's what your warm-up showed.",
  resultsSubtitle: 'Picked from your plan and your last few workouts.',
  warmupDone: 'Nice start! Your warm-up is done.',
  trickiest: (op: CoreOperation) => `Nice start! ${operationName(op)} was the trickiest.`,
  practiceNext: "We'll practice that next.",
  levelUp: (op: CoreOperation, to: DifficultyLevel) =>
    `Great job! ${operationSymbol(op)} moves up to ${LEVEL_NAMES[to]} next time`,
  levelDown: (op: CoreOperation, to: DifficultyLevel) =>
    `Let's practice ${operationSymbol(op)} on ${LEVEL_NAMES[to]} for a bit.`,
  focusQuestion: (op: CoreOperation) => `Want to focus on ${operationName(op)}?`,
  levelSuggestion: (level: ComfortLevel) => `You're doing great! Want to change your level to ${comfortName(level)}?`,
  /** Celebration on the workout that mastered it. */
  mastered: (op: CoreOperation) => `You've mastered ${operationName(op)}!`,
  /** Calm reminder above the graduation question when it was mastered on an earlier workout. */
  masteredBefore: (op: CoreOperation) => `You've mastered ${operationName(op)}.`,
  graduation: (next: CoreOperation) => `Want to add ${operationName(next)} to your plan?`,
  allMastered: (isConfident: boolean) =>
    isConfident
      ? "You've mastered everything! Keep mixing to stay sharp."
      : "You've mastered everything! Try a higher level, or keep mixing.",

  /** Statistics. Progress only ever compares rounds on one operation at one level. */
  warmupLabel: 'Warm-up',
  progressLevelUp: (op: CoreOperation, level: DifficultyLevel) =>
    `You moved up to ${LEVEL_NAMES[level]} on ${operationName(op)}!`,
  progressLevelUpDetail: 'The questions are harder now, so taking a bit longer is normal.',
  progressFaster: (op: CoreOperation, level: DifficultyLevel) =>
    `You're getting faster at ${operationName(op)} on ${LEVEL_NAMES[level]}.`,
  progressFasterDetail: (now: number, before: number) =>
    `About ${seconds(now)} per question in your last 5 rounds, down from ${seconds(before)}.`,
  progressMoreAccurate: (op: CoreOperation, level: DifficultyLevel) =>
    `You're getting more right on ${operationName(op)} on ${LEVEL_NAMES[level]}.`,
  progressMoreAccurateDetail: (now: number, before: number) =>
    `${Math.round(now)}% correct in your last 5 rounds, up from ${Math.round(before)}%.`,
  progressSteady: (op: CoreOperation, level: DifficultyLevel) =>
    `You're steady on ${operationName(op)} on ${LEVEL_NAMES[level]}. Keep it up!`,
  progressSteadyDetail: (accuracy: number) => `${Math.round(accuracy)}% correct in your last 5 rounds.`,
  progressNotEnough: 'Do a few more workouts to see your progress here.',
  notTriedYet: 'Not tried yet',
  newLevel: 'New level · keep going!',
  masteredLine: 'Mastered! Keep it sharp in mixes.',
  roundsToNextLevel: (rounds: number, next: DifficultyLevel) =>
    `${plural(rounds, 'more strong round')} to reach ${LEVEL_NAMES[next]}`,
  roundsToMastery: (rounds: number) => `${plural(rounds, 'more strong round')} on Hard to master it`,
  masteryAnotherDay: '1 more strong round on another day to master it',
};

/** "3.2 seconds", "1 second". */
function seconds(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'second' : 'seconds'}`;
}
