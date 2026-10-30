import { useWindowDimensions } from 'react-native';

// Screens cap their content at a phone width (420–480) and center it. On a tablet that
// leaves half the screen empty, so above this window width the cap grows.
// iPad portrait windows start around 744pt; the widest phones are under 450.
export const TABLET_BREAKPOINT = 700;
// First pass; to be tuned on a device.
export const TABLET_WIDTH_SCALE = 1.5;

/** `base` on a phone, unchanged; wider on a tablet. */
export function responsiveContentWidth(base: number, windowWidth: number): number {
  return windowWidth >= TABLET_BREAKPOINT ? Math.round(base * TABLET_WIDTH_SCALE) : base;
}

/**
 * The content cap for this screen. Live, so it follows iPad Split View and
 * Slide Over resizing, not just the width at launch.
 */
export function useResponsiveContentWidth(base: number): number {
  const { width } = useWindowDimensions();
  return responsiveContentWidth(base, width);
}
