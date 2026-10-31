import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { PALETTE } from '@/src/constants/palette';
import { typography } from '@/src/constants/typography';
import type { CoachDataSource } from '../services/coachService';

/** "1 workout is waiting to sync.", "3 workouts are waiting to sync." */
export function pendingSyncText(count: number): string {
  return count === 1 ? '1 workout is waiting to sync.' : `${count} workouts are waiting to sync.`;
}

/**
 * The note for data that isn't live, or for workouts still waiting to upload.
 * Null when everything is live and synced.
 */
export function offlineNoteText(from: CoachDataSource, isOffline: boolean, pendingSync = 0): string | null {
  const pending = pendingSync > 0 ? pendingSyncText(pendingSync) : null;
  if (from === 'live') return pending && `${pending} It will upload automatically.`;
  if (!isOffline) {
    const base = "Couldn't load your latest progress. Showing what's saved on this phone.";
    return pending ? `${base} ${pending}` : base;
  }
  if (pending) return `You're offline. ${pending} It will upload when you're back online.`;
  return from === 'cache'
    ? "You're offline. Workouts still save and sync later."
    : "You're offline. Showing the levels from your plan.";
}

interface OfflineNoteProps {
  from: CoachDataSource;
  isOffline: boolean;
  /** Workouts saved on this phone that haven't uploaded yet. */
  pendingSync?: number;
  style?: StyleProp<ViewStyle>;
}

/** Small calm note above the content; the screen stays usable. */
export function OfflineNote({ from, isOffline, pendingSync = 0, style }: OfflineNoteProps) {
  const { theme } = useTheme();
  const text = offlineNoteText(from, isOffline, pendingSync);
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
