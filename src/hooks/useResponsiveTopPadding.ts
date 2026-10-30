import { useWindowDimensions } from 'react-native';
import { TABLET_BREAKPOINT } from './useResponsiveContentWidth';

// Screens add a few points under the safe-area top inset. On an iPhone that inset is the
// notch or Dynamic Island (about 47–62pt); on an iPad it's only the status bar (about 20–24pt),
// so the content starts much closer to the top. Above the tablet breakpoint, add some room.
// First pass; to be tuned on a device.
export const TABLET_EXTRA_TOP = 24;

/** `base` on a phone, unchanged; `base` plus some breathing room on a tablet. */
export function responsiveTopPadding(base: number, windowWidth: number): number {
  return windowWidth >= TABLET_BREAKPOINT ? base + TABLET_EXTRA_TOP : base;
}

/** The screen's top padding under the safe area. Live, like useResponsiveContentWidth. */
export function useResponsiveTopPadding(base: number): number {
  const { width } = useWindowDimensions();
  return responsiveTopPadding(base, width);
}
