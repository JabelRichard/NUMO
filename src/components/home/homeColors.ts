import { CoachOperation } from '../../lib/coach';

// Home's own colors, on top of the shared palette.
export const HOME_COLORS = {
  background: '#F1ECE9',
  ink: '#0A0F0B',
  textSecondary: '#4A4F4B',
  textMuted: '#5B605C',
  green: '#BCE3AA',
  lilac: '#F2CAEC',
  masteredText: '#2F6B1E',
  flame: '#C2410C',
  emptyDay: '#F1ECE9',
};

/** The icon circle on each "pick your own" card: [light, dark]. */
export const PICK_TINTS: Record<CoachOperation, [string, string]> = {
  addition: ['#E4F3DC', 'rgba(188, 227, 170, 0.18)'],
  subtraction: ['#F8E2F4', 'rgba(242, 202, 236, 0.18)'],
  multiplication: ['#E4F3DC', 'rgba(188, 227, 170, 0.18)'],
  division: ['#F1ECE9', 'rgba(255, 255, 255, 0.08)'],
  mixed: ['#F1ECE9', 'rgba(255, 255, 255, 0.08)'],
};
