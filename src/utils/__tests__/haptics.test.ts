import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  getHapticsEnabled,
  haptics,
  HAPTICS_ENABLED_KEY,
  resetHapticsForTests,
  setHapticsEnabled,
} from '../haptics';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetHapticsForTests();
  jest.clearAllMocks();
});

describe('haptics', () => {
  it('plays when nothing is saved (on by default)', async () => {
    await haptics.light();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('stays silent when the saved setting is off', async () => {
    await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, 'false');
    await haptics.light();
    await haptics.medium();
    await haptics.selection();
    await haptics.success();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('applies the switch right away and saves it', async () => {
    await setHapticsEnabled(false);
    await haptics.success();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(HAPTICS_ENABLED_KEY)).toBe('false');

    await setHapticsEnabled(true);
    await haptics.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(await getHapticsEnabled()).toBe(true);
  });

  it('never throws when the device has no haptics', async () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error('unsupported'));
    await expect(haptics.selection()).resolves.toBeUndefined();
  });
});
