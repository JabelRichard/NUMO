// Shared NUMO brand palette used across the app screens.
export const PALETTE = {
  primary: '#BCE3AA', // Soft pastel sage
  primaryDeep: '#23611C', // Sage as text on light backgrounds (sage itself is too faint there)
  primarySoftLight: '#EAF7E4', // Sage chip/badge background, light mode
  primarySoftDark: 'rgba(188, 227, 170, 0.2)', // Sage chip/badge background, dark mode
  onPrimary: '#0A0F0B', // Text and icons on a sage button (white is unreadable on sage)
  accentLilac: '#F2CAEC', // Soft orchid
  backgroundLight: '#F1ECE9', // Warm neutral
  dark: '#0A0F0B', // Deep obsidian
  white: '#FFFFFF',
  cardLight: '#FFFFFF',
  cardDark: '#141C15',
  borderLight: 'rgba(10, 15, 11, 0.08)',
  borderDark: 'rgba(255, 255, 255, 0.08)',
  // The one secondary-text gray for the whole app (labels, hints, placeholders, inactive tabs).
  // Both pass 4.5:1 on every card and background they sit on.
  textSecondaryLight: 'rgba(10, 15, 11, 0.66)',
  textSecondaryDark: 'rgba(241, 236, 233, 0.65)',
  fillLight: 'rgba(10, 15, 11, 0.05)', // Progress tracks, option rows, inputs (light)
  fillDark: 'rgba(255, 255, 255, 0.07)', // Progress tracks, option rows, inputs (dark)
  scrim: 'rgba(0, 0, 0, 0.6)', // Behind bottom sheets, modals and loading overlays
  dangerText: '#EB5757',
  successText: '#2E7D32',
};
