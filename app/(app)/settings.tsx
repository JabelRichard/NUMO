import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StatusBar,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { typography, inputTypography } from '@/src/constants/typography';
import { supabase } from '../../src/config/supabase';
import { useResponsiveContentWidth } from '../../src/hooks/useResponsiveContentWidth';
import { useResponsiveTopPadding } from '../../src/hooks/useResponsiveTopPadding';
import { syncBeforeSignOut } from '../../src/services/localDataService';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  REMINDERS_ENABLED_KEY,
  REMINDER_TIME_KEY,
} from '../../src/services/notificationService';

const APP_VERSION = '1.0.4';
const BUILD_NUMBER = '24';

const STORAGE_KEYS = {
  SOUND_ENABLED: '@numo_sound_enabled',
  HAPTICS_ENABLED: '@numo_haptics_enabled',
  REMINDERS_ENABLED: REMINDERS_ENABLED_KEY,
  REMINDER_TIME: REMINDER_TIME_KEY,
};

const TIME_OPTIONS = [
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '12:00 PM',
  '05:00 PM',
  '07:00 PM',
  '08:30 PM',
  '09:00 PM',
];

const MAX_CONTENT_WIDTH = 480;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { theme, setThemeMode } = useTheme();
  // 480 on a phone, wider on a tablet.
  const contentWidth = useResponsiveContentWidth(MAX_CONTENT_WIDTH);
  // Under the safe area; more on a tablet.
  const topPadding = useResponsiveTopPadding(Math.max(insets.top > 0 ? 4 : 12, 8));

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');
  const userId = session?.user?.id;

  const screenBg = isDark ? '#0A0F0B' : '#FFFFFF';
  const cardBg = isDark ? '#141C15' : '#FAFAFA';
  const primaryText = isDark ? '#F1ECE9' : '#0A0F0B';
  const secondaryText = theme.subtext;
  const borderSubtle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 15, 11, 0.08)';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(10, 15, 11, 0.06)';
  const greenAccent = '#BCE3AA';
  const pinkAccent = '#F2CAEC';
  const redDanger = '#EB5757';

  const switchTrackColor = {
    false: isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1',
    true: '#34C759',
  };
  const switchThumbColor =
    Platform.OS === 'android' ? (isDark ? '#F1ECE9' : '#FFFFFF') : '#FFFFFF';
  const switchIosBg = isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1';

  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  // Off until the person turns it on; sign-out cancels it and clears the setting.
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00 AM');

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadPreferences = useCallback(async () => {
    try {
      const [storedSound, storedHaptics, storedReminders, storedTime] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SOUND_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.HAPTICS_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.REMINDERS_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.REMINDER_TIME),
      ]);

      if (storedSound !== null) setSoundEnabled(storedSound === 'true');
      if (storedHaptics !== null) setHapticsEnabled(storedHaptics === 'true');
      if (storedReminders !== null) setRemindersEnabled(storedReminders === 'true');
      if (storedTime !== null) setReminderTime(storedTime);
    } catch (e) {
      console.warn('Failed to load local preferences:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggleSound = async (val: boolean) => {
    setSoundEnabled(val);
    await AsyncStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(val)).catch(() => {});
  };

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val);
    await AsyncStorage.setItem(STORAGE_KEYS.HAPTICS_ENABLED, String(val)).catch(() => {});
  };

  const handleToggleReminders = async (val: boolean) => {
    setRemindersEnabled(val);
    await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS_ENABLED, String(val)).catch(() => {});

    if (val) {
      const scheduled = await scheduleDailyReminder(reminderTime);
      if (!scheduled) {
        setRemindersEnabled(false);
        await AsyncStorage.setItem(STORAGE_KEYS.REMINDERS_ENABLED, 'false').catch(() => {});
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your phone settings to receive daily training reminders.'
        );
      }
    } else {
      await cancelDailyReminder();
    }
  };

  const handleSelectReminderTime = async (time: string) => {
    setReminderTime(time);
    setTimePickerVisible(false);
    await AsyncStorage.setItem(STORAGE_KEYS.REMINDER_TIME, time).catch(() => {});

    if (remindersEnabled) {
      await scheduleDailyReminder(time);
    }
  };

  const handleToggleTheme = () => {
    const nextMode = isDark ? 'light' : 'dark';
    if (setThemeMode) {
      setThemeMode(nextMode);
    }
  };

  const handleSaveNewPassword = async () => {
    if (!currentPassword) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match. Please try again.');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('Notice', 'New password must be different from your current password.');
      return;
    }

    const userEmail = session?.user?.email;
    if (!userEmail) {
      Alert.alert('Error', 'No authenticated user session found.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyError) {
        throw new Error('Current password is incorrect.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert('Success', 'Your password has been updated successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const finishSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('Sign out failed:', e);
    } finally {
      setIsSigningOut(false);
      router.replace('/(auth)/welcome' as any);
    }
  };

  // Sign-out clears this person's data from the phone. Workouts that haven't
  // synced are tried first; if some are still waiting, ask before going ahead.
  const handleSignOut = () => {
    if (isSigningOut) return;
    Alert.alert('Sign Out', 'Are you sure you want to sign out of NUMO?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          const unsynced = userId ? await syncBeforeSignOut(userId) : 0;
          if (unsynced === 0) {
            await finishSignOut();
            return;
          }
          Alert.alert(
            'Workouts not synced',
            "You have workouts that haven't synced yet. Sign out anyway?",
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setIsSigningOut(false) },
              { text: 'Sign Out Anyway', style: 'destructive', onPress: () => void finishSignOut() },
            ],
            { cancelable: true, onDismiss: () => setIsSigningOut(false) }
          );
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, session logs, and accuracy stats. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            if (!userId) {
              Alert.alert('Error', 'No authenticated user session found.');
              return;
            }

            setIsDeleting(true);
            try {
              const { error } = await supabase.rpc('delete_user');

              if (error) {
                throw error;
              }

              try {
                // The account is gone, so its unsynced workouts can't be saved anymore.
                await signOut({ discardUnsynced: true });
              } catch {
                // Auth user is already gone; local sign-out may fail.
              }

              router.replace('/(auth)/welcome' as any);
            } catch (err: any) {
              Alert.alert(
                'Could not delete account',
                err?.message ||
                  'Your account was not deleted. You can still sign in. Try again or contact support.'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.headerRow, { maxWidth: contentWidth, paddingTop: topPadding }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: borderSubtle }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Settings</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={greenAccent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentWrapper, { maxWidth: contentWidth }]}>
            <Text style={[styles.sectionHeaderLabel, { color: secondaryText }]}>
              INTERFACE & APPEARANCE
            </Text>
            <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#0A0F0B' },
                    ]}
                  >
                    <Ionicons name="moon" size={17} color={isDark ? '#F1ECE9' : '#FFFFFF'} />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Dark Mode</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={handleToggleTheme}
                  trackColor={switchTrackColor}
                  thumbColor={switchThumbColor}
                  ios_backgroundColor={switchIosBg}
                />
              </View>
            </View>

            <Text style={[styles.sectionHeaderLabel, { color: secondaryText }]}>
              AUDIO & FEEDBACK
            </Text>
            <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.2)' : '#EAF7E4' },
                    ]}
                  >
                    <Ionicons name="volume-high" size={18} color={isDark ? greenAccent : '#23611C'} />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Sound Effects</Text>
                </View>
                <Switch
                  value={soundEnabled}
                  onValueChange={handleToggleSound}
                  trackColor={switchTrackColor}
                  thumbColor={switchThumbColor}
                  ios_backgroundColor={switchIosBg}
                />
              </View>

              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isDark ? 'rgba(242, 202, 236, 0.2)' : '#FCEFF9' },
                    ]}
                  >
                    <Ionicons
                      name="hardware-chip-outline"
                      size={18}
                      color={isDark ? pinkAccent : '#8A277C'}
                    />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Haptic Feedback</Text>
                </View>
                <Switch
                  value={hapticsEnabled}
                  onValueChange={handleToggleHaptics}
                  trackColor={switchTrackColor}
                  thumbColor={switchThumbColor}
                  ios_backgroundColor={switchIosBg}
                />
              </View>
            </View>

            <Text style={[styles.sectionHeaderLabel, { color: secondaryText }]}>
              REMINDERS & TRAINING
            </Text>
            <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="notifications" size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>
                    Daily Push Notifications
                  </Text>
                </View>
                <Switch
                  value={remindersEnabled}
                  onValueChange={handleToggleReminders}
                  trackColor={switchTrackColor}
                  thumbColor={switchThumbColor}
                  ios_backgroundColor={switchIosBg}
                />
              </View>

              {remindersEnabled && (
                <>
                  <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
                  <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.7}
                    onPress={() => setTimePickerVisible(true)}
                  >
                    <View style={styles.settingLeft}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' },
                        ]}
                      >
                        <Ionicons name="time-outline" size={18} color={primaryText} />
                      </View>
                      <Text style={[styles.settingTitle, { color: primaryText }]}>Reminder Time</Text>
                    </View>
                    <View style={styles.settingRightGroup}>
                      <Text style={[styles.settingValueText, { color: secondaryText }]}>
                        {reminderTime}
                      </Text>
                      <Ionicons name="chevron-forward" size={17} color={secondaryText} />
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text style={[styles.sectionHeaderLabel, { color: secondaryText }]}>
              SUPPORT & LEGAL
            </Text>
            <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={() =>
                  Linking.openURL('https://numo.app/help').catch(() =>
                    Alert.alert('Help Center', 'Visit https://numo.app/help')
                  )
                }
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="help-circle" size={18} color="#0284C7" />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Help Center</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={() => Linking.openURL('mailto:support@numo.app?subject=NUMO%20Feedback')}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="chatbubble-ellipses" size={17} color="#16A34A" />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Send Feedback</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={() => Linking.openURL('https://numo.app/privacy').catch(() => {})}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="lock-closed" size={17} color="#9333EA" />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={() => Linking.openURL('https://numo.app/terms').catch(() => {})}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="document-text" size={17} color="#D97706" />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionHeaderLabel, { color: secondaryText }]}>
              ACCOUNT & SECURITY
            </Text>
            <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={() => setPasswordModalVisible(true)}
              >
                <View style={styles.settingLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' },
                    ]}
                  >
                    <Ionicons name="key-outline" size={17} color={primaryText} />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={secondaryText} />
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={handleSignOut}
                disabled={isSigningOut}
              >
                <View style={styles.settingLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' },
                    ]}
                  >
                    <Ionicons name="log-out-outline" size={18} color={primaryText} />
                  </View>
                  <Text style={[styles.settingTitle, { color: primaryText }]}>
                    {isSigningOut ? 'Signing Out…' : 'Sign Out'}
                  </Text>
                </View>
                {isSigningOut ? (
                  <ActivityIndicator size="small" color={secondaryText} />
                ) : (
                  <Ionicons name="chevron-forward" size={17} color={secondaryText} />
                )}
              </TouchableOpacity>

              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                <View style={styles.settingLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="trash-outline" size={17} color={redDanger} />
                  </View>
                  <Text style={[styles.settingTitle, { color: redDanger }]}>
                    {isDeleting ? 'Deleting Account...' : 'Delete Account'}
                  </Text>
                </View>
                {isDeleting ? (
                  <ActivityIndicator size="small" color={redDanger} />
                ) : (
                  <Ionicons name="chevron-forward" size={17} color={redDanger} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footnoteWrapper}>
              <View style={styles.syncRow}>
                <View style={[styles.syncDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.syncStatusText, { color: secondaryText }]}>
                  Cloud Sync: Active
                </Text>
              </View>

              <Text style={[styles.appVersionText, { color: secondaryText }]}>
                NUMO v{APP_VERSION} ({BUILD_NUMBER})
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={passwordModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            <Text style={[styles.modalTitle, { color: primaryText }]}>Change Password</Text>
            <Text style={[styles.modalSubtitle, { color: secondaryText }]}>
              Confirm your current password to set a new one.
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: screenBg, color: primaryText, borderColor: borderSubtle },
              ]}
              placeholder="Current Password"
              placeholderTextColor={secondaryText}
              secureTextEntry
              autoCapitalize="none"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: screenBg, color: primaryText, borderColor: borderSubtle },
              ]}
              placeholder="New Password (min 6 chars)"
              placeholderTextColor={secondaryText}
              secureTextEntry
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: screenBg, color: primaryText, borderColor: borderSubtle },
              ]}
              placeholder="Confirm New Password"
              placeholderTextColor={secondaryText}
              secureTextEntry
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { borderColor: borderSubtle }]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isUpdatingPassword}
              >
                <Text style={[styles.modalBtnCancelText, { color: primaryText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: greenAccent }]}
                onPress={handleSaveNewPassword}
                disabled={isUpdatingPassword}
              >
                {isUpdatingPassword ? (
                  <ActivityIndicator size="small" color="#0A0F0B" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={timePickerVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            <Text style={[styles.modalTitle, { color: primaryText }]}>
              Select Daily Reminder Time
            </Text>
            <View style={styles.timeList}>
              {TIME_OPTIONS.map((time) => {
                const isSelected = reminderTime === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeItem,
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(188, 227, 170, 0.18)' : '#EAF7E4',
                      },
                    ]}
                    onPress={() => handleSelectReminderTime(time)}
                  >
                    <Text
                      style={[
                        styles.timeItemText,
                        { color: primaryText },
                        isSelected && { color: isDark ? greenAccent : '#23611C' },
                      ]}
                    >
                      {time}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={isDark ? greenAccent : '#23611C'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { borderColor: borderSubtle }]}
              onPress={() => setTimePickerVisible(false)}
            >
              <Text style={[styles.modalCloseText, { color: primaryText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    ...typography.sectionHeading,
    letterSpacing: -0.4,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 38,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 8,
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionHeaderLabel: {
    ...typography.caption,
    letterSpacing: 0.8,
    marginLeft: 6,
    marginTop: 10,
    marginBottom: -4,
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    ...typography.button,
    letterSpacing: -0.2,
  },
  settingRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValueText: {
    ...typography.secondary,
  },
  rowDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
  footnoteWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  syncStatusText: {
    ...typography.caption,
  },
  appVersionText: {
    ...typography.caption,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    ...typography.sectionHeading,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    ...typography.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    ...inputTypography('body'),
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtnCancel: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    ...typography.button,
  },
  modalBtnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimaryText: {
    ...typography.button,
    color: '#0A0F0B',
  },
  timeList: {
    gap: 4,
    marginBottom: 14,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  timeItemText: {
    ...typography.button,
  },
  modalCloseBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    ...typography.button,
  },
});