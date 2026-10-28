import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { PALETTE } from '@/src/constants/palette';
import { typography } from '@/src/constants/typography';
import type { CoachDataSource } from '../services/coachService';

/** The note for data that isn't live, or null when it is. */
export function offlineNoteText(from: CoachDataSource, isOffline: boolean): string | null {
  if (from === 'live') return null;
  if (!isOffline) return "Couldn't load your latest progress. Showing what's saved on this phone.";
  return from === 'cache'
    ? "You're offline. Workouts still save and sync later."
    : "You're offline. Showing the levels from your plan.";
}

interface OfflineNoteProps {
  from: CoachDataSource;
  isOffline: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Small calm note above the content; the screen stays usable. */
export function OfflineNote({ from, isOffline, style }: OfflineNoteProps) {
  const { theme } = useTheme();
  const text = offlineNoteText(from, isOffline);
  if (!text) return null;

  return (
    <View
      style={[styles.note, { backgroundColor: theme.isDark ? PALETTE.fillDark : PALETTE.fillLight }, style]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={18} color={theme.subtext} />
      <Text style={[styles.text, { color: theme.subtext }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: {
    ...typography.secondary,
    flex: 1,
  },
});
