import { CHIP_SPACING, ChipSpacing, MIN_PEEK, peekSpacing } from '../chipPeek';

const EDGE = 20;

/** How much of the chip crossing the edge shows and hides; null when none crosses it. */
function cut(contents: number[], { gap, padding }: ChipSpacing, viewport: number) {
  let x = EDGE;
  for (const content of contents) {
    const w = content + padding * 2;
    if (x + w > viewport) return { shown: viewport - x, hidden: w - (viewport - x) };
    x += w + gap;
  }
  return null;
}

const expectPeek = (contents: number[], viewport: number) => {
  const spacing = peekSpacing(contents, viewport, EDGE);
  const after = cut(contents, spacing, viewport)!;
  expect(after.shown).toBeGreaterThanOrEqual(MIN_PEEK);
  expect(after.hidden).toBeGreaterThanOrEqual(MIN_PEEK);
  return spacing;
};

// Chip widths without padding: "All", then four "+ Adding · Medium"-sized chips.
const CHIPS = [28, 118, 104, 108, 108];

describe('peekSpacing', () => {
  it('keeps the default when every chip fits', () => {
    expect(peekSpacing([28, 60, 60], 400, EDGE)).toEqual(CHIP_SPACING);
  });

  it('keeps the default before the chips are measured', () => {
    expect(peekSpacing([], 390, EDGE)).toEqual(CHIP_SPACING);
    expect(peekSpacing([28, 0, 100], 390, EDGE)).toEqual(CHIP_SPACING);
    expect(peekSpacing(CHIPS, 0, EDGE)).toEqual(CHIP_SPACING);
  });

  it('keeps the default when a chip is already clearly cut off', () => {
    expect(cut(CHIPS, CHIP_SPACING, 420)!.shown).toBeGreaterThanOrEqual(MIN_PEEK);
    expect(peekSpacing(CHIPS, 420, EDGE)).toEqual(CHIP_SPACING);
  });

  it('when the edge lands in a gap', () => {
    // Default: chip 2 ends at 20+60+8+150+8+136 = 382; an edge at 386 falls in the next gap.
    expect(cut(CHIPS, CHIP_SPACING, 386)!.shown).toBeLessThan(MIN_PEEK);
    expect(expectPeek(CHIPS, 386)).not.toEqual(CHIP_SPACING);
  });

  it('when a chip would end almost exactly at the edge', () => {
    expect(cut(CHIPS, CHIP_SPACING, 380)!.hidden).toBeLessThan(MIN_PEEK);
    expectPeek(CHIPS, 380);
  });

  it('peeks on every common phone width', () => {
    for (let viewport = 320; viewport <= 520; viewport++) expectPeek(CHIPS, viewport);
  });
});
