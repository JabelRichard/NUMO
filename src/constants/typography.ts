import { TextStyle } from 'react-native';
import type { FontFamilyDefinition } from 'expo-font';
// Per-weight imports so only these five font files end up in the bundle.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { InterTight_700Bold } from '@expo-google-fonts/inter-tight/700Bold';

// Font family names registered by useFonts in app/_layout.tsx.
// Each family groups its weights, so pick a face with fontWeight.
export const FONT_FAMILY = {
  heading: 'InterTight',
  text: 'Inter',
};

// Passed straight to useFonts() in the root layout.
export const FONT_DEFINITIONS: FontFamilyDefinition[] = [
  {
    fontFamily: FONT_FAMILY.text,
    fontDefinitions: [
      { path: Inter_400Regular, weight: 400, style: 'normal' },
      { path: Inter_500Medium, weight: 500, style: 'normal' },
      { path: Inter_600SemiBold, weight: 600, style: 'normal' },
    ],
  },
  {
    fontFamily: FONT_FAMILY.heading,
    fontDefinitions: [
      { path: InterTight_600SemiBold, weight: 600, style: 'normal' },
      { path: InterTight_700Bold, weight: 700, style: 'normal' },
    ],
  },
];

// Tabular figures: every digit gets the same width, so scores, timers
// and answers don't jitter as they change. Applied to all styles because
// numbers show up in nearly every role in this app; it only affects digits.
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

const lh = (size: number, ratio: number) => Math.round(size * ratio);

// Sizes stay in plain points: React Native scales fontSize and lineHeight
// with the system text-size setting automatically (allowFontScaling is on
// by default). Don't set allowFontScaling={false} on Text using these.
export const typography = {
  display: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: lh(32, 1.2), // 38
    fontVariant: TABULAR,
  },
  // The main math question on the workout screen.
  problem: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 56,
    fontWeight: '700',
    lineHeight: lh(56, 1.2), // 67
    fontVariant: TABULAR,
  },
  screenTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: lh(26, 1.2), // 31
    fontVariant: TABULAR,
  },
  sectionHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: lh(20, 1.2), // 24
    fontVariant: TABULAR,
  },
  body: {
    fontFamily: FONT_FAMILY.text,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: lh(16, 1.5), // 24
    fontVariant: TABULAR,
  },
  secondary: {
    fontFamily: FONT_FAMILY.text,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: lh(14, 1.45), // 20
    fontVariant: TABULAR,
  },
  button: {
    fontFamily: FONT_FAMILY.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: lh(15, 1.4), // 21
    fontVariant: TABULAR,
  },
  caption: {
    fontFamily: FONT_FAMILY.text,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: lh(12, 1.4), // 17
    fontVariant: TABULAR,
  },
} satisfies Record<string, TextStyle>;

export type TypographyRole = keyof typeof typography;

// For TextInput: same role without lineHeight, which shifts or clips
// single-line input text on iOS.
export const inputTypography = (role: TypographyRole): TextStyle => {
  const { lineHeight, ...rest } = typography[role];
  return rest;
};

// Upper bounds for maxFontSizeMultiplier on the largest text, so the
// biggest accessibility sizes still grow the text without pushing a
// 56px problem off screen. Smaller roles scale without a cap.
export const MAX_FONT_SCALE: Partial<Record<TypographyRole, number>> = {
  problem: 1.4,
  display: 1.6,
  screenTitle: 1.8,
};
