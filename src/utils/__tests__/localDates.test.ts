import { monthGrid } from '../localDates';

const dates = (week: ({ date: number } | null)[]) => week.map((d) => d?.date ?? null);

describe('monthGrid', () => {
  it('starts weeks on Monday and pads with null', () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const weeks = monthGrid(2026, 9);
    expect(weeks).toHaveLength(5);
    expect(dates(weeks[0])).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(dates(weeks[4])).toEqual([26, 27, 28, 29, 30, 31, null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('gives each day its local key', () => {
    const days = monthGrid(2026, 9).flat().filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ key: '2026-10-01', date: 1 });
    expect(days[30]).toEqual({ key: '2026-10-31', date: 31 });
  });

  it('needs no padding when the month starts on Monday', () => {
    // June 2026 starts on a Monday.
    expect(dates(monthGrid(2026, 5)[0])).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('fits February in four weeks when it can', () => {
    // February 2027: 28 days, starting on a Monday.
    expect(monthGrid(2027, 1)).toHaveLength(4);
  });

  it('uses six weeks for a long month starting late', () => {
    // August 2026 starts on a Saturday and has 31 days.
    const weeks = monthGrid(2026, 7);
    expect(weeks).toHaveLength(6);
    expect(dates(weeks[5])).toEqual([31, null, null, null, null, null, null]);
  });

  it('counts leap days', () => {
    expect(monthGrid(2028, 1).flat().filter(Boolean)).toHaveLength(29);
  });

  it('rolls an out-of-range month over into the next or previous year', () => {
    expect(monthGrid(2026, -1).flat().find(Boolean)?.key).toBe('2025-12-01');
    expect(monthGrid(2026, 12).flat().find(Boolean)?.key).toBe('2027-01-01');
  });
});
