import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Every vibration in the app goes through here, so the Haptics switch in Settings
// applies everywhere. The setting is a device preference: it stays after sign-out.

export const HAPTICS_ENABLED_KEY = '@numo_haptics_enabled';

let enabled = true;
let loaded: Promise<void> | null = null;

/** Reads the saved setting once; later calls reuse it. On by default. */
export function loadHapticsPreference(): Promise<void> {
  loaded ??= AsyncStorage.getItem(HAPTICS_ENABLED_KEY)
    .then((stored) => {
      if (stored !== null) enabled = stored === 'true';
    })
    .catch(() => {});
  return loaded;
}

export async function getHapticsEnabled(): Promise<boolean> {
  await loadHapticsPreference();
  return enabled;
}

/** The Settings switch. Applies right away; the saved copy is best effort. */
export async function setHapticsEnabled(value: boolean): Promise<void> {
  await loadHapticsPreference();
  enabled = value;
  await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, String(value)).catch(() => {});
}

/** Plays `effect` unless haptics are off or unsupported (web). Never throws. */
async function play(effect: () => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') return;
  await loadHapticsPreference();
  if (!enabled) return;
  try {
    await effect();
  } catch {
    // No haptics hardware, or the OS refused; nothing to tell the user.
  }
}

export const haptics = {
  /** Taps: digits, small buttons. */
  light: () => play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Firmer taps: submit, moving to the next step. */
  medium: () => play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Deleting a digit. */
  selection: () => play(() => Haptics.selectionAsync()),
  /** Good news: celebrations, starting the next workout. */
  success: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};

/** Tests only: forget the cached setting. */
export function resetHapticsForTests(): void {
  enabled = true;
  loaded = null;
}
