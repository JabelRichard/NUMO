import { accuracyOf, OperationEntry } from './entries';
import { CoachOperation } from './types';

export const RECENT_WORKOUTS_PER_OPERATION = 10;
// Accuracy within this many points counts as "close"; then the least recently practised wins.
export const CLOSE_ACCURACY_POINTS = 5;

export interface OperationStats {
  operation: CoachOperation;
  /** Up to the last 10 entries, newest first. */
  recent: OperationEntry[];
  questions: number;
  accuracy: number;
  avgTimeMs: number;
  lastPracticedAt: number | null;
  /** Last 3 rounds' pace compared to the user's own average on this operation (1 = same, <1 = faster). */
  speedRatio: number;
  improving: boolean;
}

const totals = (entries: OperationEntry[]) =>
  entries.reduce(
    (sum, e) => ({ questions: sum.questions + e.questions, correct: sum.correct + e.correct, timeMs: sum.timeMs + e.timeMs }),
    { questions: 0, correct: 0, timeMs: 0 }
  );

/** Stats from the newest entries for one operation. `entries` must be newest first. */
export function getOperationStats(operation: CoachOperation, entries: OperationEntry[]): OperationStats {
  const recent = entries.filter((e) => e.operation === operation).slice(0, RECENT_WORKOUTS_PER_OPERATION);
  const all = totals(recent);
  const avgTimeMs = all.questions > 0 ? all.timeMs / all.questions : 0;

  let speedRatio = 1;
  let improving = false;
  if (recent.length >= 4 && avgTimeMs > 0) {
    const latest = totals(recent.slice(0, 3));
    const latestAvg = latest.questions > 0 ? latest.timeMs / latest.questions : avgTimeMs;
    speedRatio = latestAvg / avgTimeMs;
    improving =
      speedRatio < 0.9 &&
      accuracyOf(latest.correct, latest.questions) >= accuracyOf(all.correct, all.questions) - CLOSE_ACCURACY_POINTS;
  }

  return {
    operation,
    recent,
    questions: all.questions,
    accuracy: accuracyOf(all.correct, all.questions),
    avgTimeMs,
    lastPracticedAt: recent[0]?.completedAt ?? null,
    speedRatio,
    improving,
  };
}

/**
 * The operation to practise next among `candidates`:
 * 1. one with no recent data, in the order given;
 * 2. otherwise the lowest accuracy; when several are within 5 points,
 *    the least recently practised, then the one getting slower.
 */
export function pickWeakest(
  candidates: CoachOperation[],
  statsFor: (op: CoachOperation) => OperationStats
): CoachOperation {
  const stats = candidates.map(statsFor);
  const untried = stats.find((s) => s.questions === 0);
  if (untried) return untried.operation;

  const lowest = Math.min(...stats.map((s) => s.accuracy));
  const close = stats.filter((s) => s.accuracy - lowest <= CLOSE_ACCURACY_POINTS);
  close.sort(
    (a, b) =>
      (a.lastPracticedAt ?? 0) - (b.lastPracticedAt ?? 0) ||
      b.speedRatio - a.speedRatio ||
      a.accuracy - b.accuracy
  );
  return close[0].operation;
}
