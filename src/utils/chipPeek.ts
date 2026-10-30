// A row of chips that scrolls sideways reads as "there's more" only when the last
// visible chip is cut off at the edge. If the edge lands in a gap, or right at a
// chip's end, the row looks finished. This picks the spacing so it doesn't.

export interface ChipSpacing {
  /** Between chips. */
  gap: number;
  /** Inside each chip, left and right. */
  padding: number;
}

export const CHIP_SPACING: ChipSpacing = { gap: 8, padding: 16 };
const GAPS = [6, 14];
const PADDINGS = [12, 20];
// At least this much of the cut chip shows, and at least this much is hidden.
export const MIN_PEEK = 24;

// Every spacing to try, closest to the default first, so the row changes as little as possible.
const CANDIDATES: ChipSpacing[] = [];
for (let gap = GAPS[0]; gap <= GAPS[1]; gap++) {
  for (let padding = PADDINGS[0]; padding <= PADDINGS[1]; padding++) CANDIDATES.push({ gap, padding });
}
const cost = (s: ChipSpacing) => Math.abs(s.gap - CHIP_SPACING.gap) + Math.abs(s.padding - CHIP_SPACING.padding);
CANDIDATES.sort((a, b) => cost(a) - cost(b) || b.gap - a.gap || b.padding - a.padding);

/** True when the chip crossing the trailing edge is clearly cut off. */
function cutsChip(contents: number[], spacing: ChipSpacing, viewport: number, edge: number): boolean {
  let x = edge;
  for (const content of contents) {
    const width = content + spacing.padding * 2;
    if (x + width > viewport) {
      const shown = viewport - x;
      return shown >= MIN_PEEK && width - shown >= MIN_PEEK;
    }
    x += width + spacing.gap;
  }
  return false;
}

/**
 * Spacing that leaves a chip partly hidden at the trailing edge, as close to the
 * default as it can. The default when every chip fits (nothing to scroll to),
 * before the chips are measured, or when no spacing in range works.
 *
 * `contents`: each chip's width without its padding. `edge`: space before the
 * first chip and after the last. `viewport`: the visible width of the row.
 */
export function peekSpacing(contents: number[], viewport: number, edge: number): ChipSpacing {
  if (viewport <= 0 || contents.length === 0 || contents.some((w) => !(w > 0))) return CHIP_SPACING;
  const { gap, padding } = CHIP_SPACING;
  const total = edge * 2 + contents.reduce((sum, w) => sum + w + padding * 2, 0) + gap * (contents.length - 1);
  if (total <= viewport) return CHIP_SPACING;
  return CANDIDATES.find((s) => cutsChip(contents, s, viewport, edge)) ?? CHIP_SPACING;
}
