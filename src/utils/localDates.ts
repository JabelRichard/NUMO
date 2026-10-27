// Day math on the phone's local calendar. toISOString() gives the UTC day,
// which puts a workout done just after local midnight on the wrong day.

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" for the local calendar day of a Date or ISO timestamp. */
export function localDayKey(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday 00:00 local time of the week containing `now`. */
export function startOfLocalWeek(now: Date = new Date()): Date {
  const start = new Date(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  start.setDate(now.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Consecutive local days with at least one workout, ending today or yesterday.
 * 0 if there was no workout on either of those days.
 */
export function countDayStreak(timestamps: string[], now: Date = new Date()): number {
  const days = new Set(timestamps.filter(Boolean).map((t) => localDayKey(t)));

  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0); // midday so DST shifts never skip or repeat a day
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
