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

export interface MonthGridDay {
  /** "YYYY-MM-DD". */
  key: string;
  /** Day of the month, 1–31. */
  date: number;
}

/**
 * A month as Monday-first weeks of seven; days of the next or previous month are null.
 * `month` is 0–11; anything else rolls over like Date does (-1 is last December).
 */
export function monthGrid(year: number, month: number): (MonthGridDay | null)[][] {
  const first = new Date(year, month, 1, 12);
  const monday = startOfLocalWeek(first);
  const weeks: (MonthGridDay | null)[][] = [];
  for (let offset = 0; ; offset += 7) {
    const week = Array.from({ length: 7 }, (_, i) => {
      // midday so DST shifts never skip or repeat a day
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset + i, 12);
      return d.getMonth() === first.getMonth() ? { key: localDayKey(d), date: d.getDate() } : null;
    });
    if (week.every((d) => d === null)) return weeks;
    weeks.push(week);
  }
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

/** The most consecutive local days with at least one workout, ever. */
export function longestDayStreak(timestamps: string[]): number {
  const days = [...new Set(timestamps.filter(Boolean).map((t) => localDayKey(t)))].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const day = new Date(y, m - 1, d, 12); // midday so DST shifts never skip or repeat a day
    const next: Date | null = previous ? new Date(previous) : null;
    next?.setDate(next.getDate() + 1);
    run = next && localDayKey(next) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}
