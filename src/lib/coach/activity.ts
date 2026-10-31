import { CORE_OPERATIONS } from '../math/questionGenerator';
import { CoreOperation } from '../math/types';
import { startOfLocalWeek } from '../../utils/localDates';
import { OperationEntry, toEntries } from './entries';
import { CoachWorkout } from './types';

// Statistics: questions per day, week or month, for every operation or just one.
// Every question counts once. A mix round counts as its operations' parts, never
// again as "mixed" on top of them. Older mixes saved without parts count under
// "All" only, because there's no way to tell which operation each question was.

export type ActivityRange = 'week' | 'month' | 'year';
export type ActivityFilter = CoreOperation | 'all';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface ActivityBucket {
  /** Under the bar: "M", "6–12", "J". */
  label: string;
  /** For screen readers: "Monday", "October 6 to 12", "January". */
  name: string;
  /** Local midnight; `end` is the next bucket's start. */
  start: number;
  end: number;
  questions: number;
  /** Today is in it. */
  isCurrent: boolean;
  /** Starts after today. */
  isFuture: boolean;
}

export interface ActivityTotals {
  questions: number;
  correct: number;
  timeMs: number;
}

export interface ActivitySummary {
  range: ActivityRange;
  filter: ActivityFilter;
  start: number;
  end: number;
  /** Days of this week, weeks of this month, or months of this year. */
  buckets: ActivityBucket[];
  /** For the filter. */
  totals: ActivityTotals;
  /** Every operation in the range, whatever the filter. */
  byOperation: Record<CoreOperation, number>;
  /** Questions from older mixes saved without parts; in "All" totals only. */
  unsplitMixed: number;
}

const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

/** This week (Mon–Sun), this month in Monday-first weeks, or this year in months. */
export function activityBuckets(range: ActivityRange, now: Date = new Date()): Omit<ActivityBucket, 'questions'>[] {
  const nowMs = now.getTime();
  const bucket = (label: string, name: string, start: number, end: number) => ({
    label,
    name,
    start,
    end,
    isCurrent: start <= nowMs && nowMs < end,
    isFuture: start > nowMs,
  });

  if (range === 'week') {
    const monday = startOfLocalWeek(now);
    return WEEKDAY_NAMES.map((name, i) => {
      const [y, m, d] = [monday.getFullYear(), monday.getMonth(), monday.getDate() + i];
      return bucket(name[0], name, day(y, m, d), day(y, m, d + 1));
    });
  }

  const year = now.getFullYear();
  if (range === 'year') {
    return MONTH_NAMES.map((name, m) => bucket(name[0], name, day(year, m, 1), day(year, m + 1, 1)));
  }

  // Weeks of the month, cut at the month's first and last day.
  const month = now.getMonth();
  const monthEnd = day(year, month + 1, 1);
  const buckets: Omit<ActivityBucket, 'questions'>[] = [];
  let first = 1;
  while (day(year, month, first) < monthEnd) {
    const startDate = new Date(year, month, first);
    const daysToMonday = 7 - ((startDate.getDay() + 6) % 7);
    const end = Math.min(day(year, month, first + daysToMonday), monthEnd);
    const last = new Date(end - 1).getDate();
    const label = last === first ? `${first}` : `${first}–${last}`;
    const name = last === first ? `${MONTH_NAMES[month]} ${first}` : `${MONTH_NAMES[month]} ${first} to ${last}`;
    buckets.push(bucket(label, name, day(year, month, first), end));
    first = last + 1;
  }
  return buckets;
}

/**
 * The parts of a workout that count: one per operation it covered. A round saved
 * without parts counts whole, under its own operation (often "mixed" for older mixes).
 */
export function countedParts(workout: CoachWorkout): OperationEntry[] {
  const entries = toEntries(workout);
  const parts = entries.filter((e) => e.operation !== 'mixed');
  return parts.length > 0 ? parts : entries;
}

const emptyByOperation = () =>
  Object.fromEntries(CORE_OPERATIONS.map((op) => [op, 0])) as Record<CoreOperation, number>;

export function getActivity(
  workouts: CoachWorkout[],
  range: ActivityRange,
  filter: ActivityFilter,
  now: Date = new Date()
): ActivitySummary {
  const buckets: ActivityBucket[] = activityBuckets(range, now).map((b) => ({ ...b, questions: 0 }));
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const totals: ActivityTotals = { questions: 0, correct: 0, timeMs: 0 };
  const byOperation = emptyByOperation();
  let unsplitMixed = 0;

  for (const workout of workouts) {
    for (const part of countedParts(workout)) {
      if (part.completedAt < start || part.completedAt >= end) continue;
      if (part.operation === 'mixed') unsplitMixed += part.questions;
      else byOperation[part.operation] += part.questions;

      if (filter !== 'all' && part.operation !== filter) continue;
      totals.questions += part.questions;
      totals.correct += part.correct;
      totals.timeMs += part.timeMs;
      const target = buckets.find((b) => b.start <= part.completedAt && part.completedAt < b.end);
      if (target) target.questions += part.questions;
    }
  }

  return { range, filter, start, end, buckets, totals, byOperation, unsplitMixed };
}

/**
 * Offline, the phone keeps only the newest workouts. True when some saved workouts
 * aren't here and the oldest one that is starts after `rangeStart`, so the range
 * may be missing some.
 */
export function mayMissWorkouts(workouts: CoachWorkout[], lifetimeWorkouts: number, rangeStart: number): boolean {
  if (lifetimeWorkouts <= workouts.length) return false;
  const times = workouts.map((w) => new Date(w.completed_at).getTime()).filter((t) => t > 0);
  return times.length === 0 || Math.min(...times) > rangeStart;
}

/** "45 sec", "12 min", "1 hr 5 min". */
export function formatTimeSpent(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
