import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../src/context/AuthContext';
import {
  getUserSettings,
  saveUserSettings,
  getUserProfile,
  updateProfileName,
  uploadProfileAvatar,
  removeProfileAvatar,
  updateAccountPasswordWithOldPassword,
  deleteUserAccount,
} from '../../src/services/settingsService';
import { UserSettings, DEFAULT_USER_SETTINGS } from '../../src/types/settings';
import { useTheme } from '@/src/context/ThemeContext';
import { OfflineNotice } from '../../src/components/OfflineNotice';

const PALETTE = {
  primary: '#BCE3AA',         // Soft pastel sage
  accentLilac: '#F2CAEC',     // Soft orchid
  backgroundLight: '#F1ECE9', // Warm neutral
  dark: '#0A0F0B',            // Deep obsidian
  cardLight: '#FFFFFF',
  cardDark: '#141C15',
  borderLight: 'rgba(10, 15, 11, 0.08)',
  borderDark: 'rgba(255, 255, 255, 0.08)',
  textSubtleLight: 'rgba(10, 15, 11, 0.55)',
  textSubtleDark: 'rgba(241, 236, 233, 0.65)',
  danger: '#EB5757',
  dangerBgLight: 'rgba(235, 87, 87, 0.1)',
  dangerBgDark: 'rgba(235, 87, 87, 0.16)',
};

const QUESTION_OPTIONS = [5, 10, 30, 50];
const DURATION_OPTIONS = [
  { mins: 2, label: '2 min' },
  { mins: 5, label: '5 min' },
  { mins: 10, label: '10 min' },
];
const FREQUENCY_OPTIONS = [
  { value: '3 days per week', label: '3x / wk' },
  { value: '5 days per week', label: '5x / wk' },
  { value: 'Every day', label: 'Daily' },
];

const PRESET_REMINDER_TIMES = [
  { label: '8:00 AM', value: '08:00' },
  { label: '12:30 PM', value: '12:30' },
  { label: '6:00 PM', value: '18:00' },
];

const PREF_KEYS = {
  NOTIFICATIONS: '@numo_notifications_enabled',
  REMINDER_TIME: '@numo_reminder_time',
  DAILY_MINUTES: '@numo_daily_goal_minutes',
  FREQUENCY: '@numo_training_frequency',
  HAPTICS: '@numo_haptics_enabled',
  SOUNDS: '@numo_sounds_enabled',
};

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, themeMode, setThemeMode } = useTheme();

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');
  const isNarrow = width < 360;

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const textColor = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const subtextColor = isDark ? PALETTE.textSubtleDark : PALETTE.textSubtleLight;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(10, 15, 11, 0.06)';
  const pillBaseBg = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(10, 15, 11, 0.05)';
  const accentGreen = PALETTE.primary;
  const accentLilac = PALETTE.accentLilac;
  const dangerText = PALETTE.danger;

  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  // Sensory Toggles
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [soundsEnabled, setSoundsEnabled] = useState<boolean>(true);

  // Local Device Preferences
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(5);
  const [trainingFrequency, setTrainingFrequency] = useState<string>('5 days per week');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [reminderTime, setReminderTime] = useState<string>('08:00');

  // Custom Time Input Modal
  const [customTimeModalVisible, setCustomTimeModalVisible] = useState<boolean>(false);
  const [customTimeInput, setCustomTimeInput] = useState<string>('');

  // Avatar & Profile State
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [editNameModalVisible, setEditNameModalVisible] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  // Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);

  // Delete Account Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  // Info / Feedback Modal State
  const [infoModalContent, setInfoModalContent] = useState<{ title: string; body: string } | null>(null);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');

  const userId = session?.user?.id;

  // Connectivity Listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      if (!offline && isOffline) {
        loadSettings();
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  const loadSettings = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (net.isConnected === false || net.isInternetReachable === false) {
      setIsOffline(true);
      setLoading(false);
      return;
    }

    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const [settingsData, profileData] = await Promise.all([
        getUserSettings(userId),
        getUserProfile(userId),
      ]);
      setSettings(settingsData);

      const name = profileData.full_name || session?.user?.user_metadata?.full_name || '';
      const avatar = profileData.avatar_url || session?.user?.user_metadata?.avatar_url || null;

      setFullName(name);
      setNameInput(name);
      setAvatarUrl(avatar);

      const [storedNotifs, storedTime, storedMins, storedFreq, storedHaptics, storedSounds] = await Promise.all([
        AsyncStorage.getItem(PREF_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(PREF_KEYS.REMINDER_TIME),
        AsyncStorage.getItem(PREF_KEYS.DAILY_MINUTES),
        AsyncStorage.getItem(PREF_KEYS.FREQUENCY),
        AsyncStorage.getItem(PREF_KEYS.HAPTICS),
        AsyncStorage.getItem(PREF_KEYS.SOUNDS),
      ]);

      if (storedNotifs !== null) setNotificationsEnabled(storedNotifs === 'true');
      if (storedTime !== null) setReminderTime(storedTime);
      if (storedMins !== null) setDailyGoalMinutes(parseInt(storedMins, 10) || 5);
      if (storedFreq !== null) setTrainingFrequency(storedFreq);
      if (storedHaptics !== null) setHapticsEnabled(storedHaptics === 'true');
      if (storedSounds !== null) setSoundsEnabled(storedSounds === 'true');

      setIsOffline(false);
    } catch {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, [userId, session]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handlers
  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem(PREF_KEYS.NOTIFICATIONS, val ? 'true' : 'false').catch(() => {});
  };

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val);
    await AsyncStorage.setItem(PREF_KEYS.HAPTICS, val ? 'true' : 'false').catch(() => {});
  };

  const handleToggleSounds = async (val: boolean) => {
    setSoundsEnabled(val);
    await AsyncStorage.setItem(PREF_KEYS.SOUNDS, val ? 'true' : 'false').catch(() => {});
  };

  const handleUpdateReminderTime = async (timeStr: string) => {
    setReminderTime(timeStr);
    await AsyncStorage.setItem(PREF_KEYS.REMINDER_TIME, timeStr).catch(() => {});
  };

  const handleSaveCustomTime = async () => {
    const trimmed = customTimeInput.trim();
    if (!trimmed) {
      Alert.alert('Time Required', 'Please enter a valid time (e.g., 07:15 AM or 20:30).');
      return;
    }
    await handleUpdateReminderTime(trimmed);
    setCustomTimeModalVisible(false);
    setCustomTimeInput('');
  };

  const handleUpdateDuration = async (mins: number) => {
    setDailyGoalMinutes(mins);
    await AsyncStorage.setItem(PREF_KEYS.DAILY_MINUTES, mins.toString()).catch(() => {});
  };

  const handleUpdateFrequency = async (freq: string) => {
    setTrainingFrequency(freq);
    await AsyncStorage.setItem(PREF_KEYS.FREQUENCY, freq).catch(() => {});
  };

  const handleUpdateQuestions = async (count: number) => {
    if (!userId || settings.daily_question_goal === count) return;
    const prev = settings.daily_question_goal;
    setSettings((p) => ({ ...p, daily_question_goal: count }));

    const res = await saveUserSettings(userId, { daily_question_goal: count });
    if (!res.success) {
      setSettings((p) => ({ ...p, daily_question_goal: prev }));
      Alert.alert('Save Failed', 'Could not update question count.');
    }
  };

  const handlePickAndUploadAvatar = async () => {
    if (!userId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (!asset.base64) return;

      setIsUploadingAvatar(true);
      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const res = await uploadProfileAvatar(userId, asset.base64, fileExt);
      setIsUploadingAvatar(false);

      if (res.success && res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
      } else {
        Alert.alert('Upload Failed', res.error || 'Could not upload photo.');
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!userId || !avatarUrl) return;
    setIsUploadingAvatar(true);
    const res = await removeProfileAvatar(userId);
    setIsUploadingAvatar(false);

    if (res.success) {
      setAvatarUrl(null);
    } else {
      Alert.alert('Error', res.error || 'Failed to remove avatar.');
    }
  };

  const handleSaveName = async () => {
    if (!userId || !nameInput.trim()) return;
    setIsSavingName(true);
    const res = await updateProfileName(userId, nameInput.trim());
    setIsSavingName(false);

    if (res.success) {
      setFullName(nameInput.trim());
      setEditNameModalVisible(false);
    } else {
      Alert.alert('Error', res.error || 'Failed to update name.');
    }
  };

  const handlePasswordSubmit = async () => {
    const email = session?.user?.email;
    if (!email || !currentPassword) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    setUpdatingPassword(true);
    const res = await updateAccountPasswordWithOldPassword(email, currentPassword, newPassword);
    setUpdatingPassword(false);

    if (res.success) {
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully.');
    } else {
      Alert.alert('Error', res.error || 'Failed to change password.');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeletingAccount(true);
    const res = await deleteUserAccount();
    setIsDeletingAccount(false);

    if (!res.success) {
      Alert.alert('Deletion Failed', res.error || 'Could not delete your account.');
    } else {
      setDeleteModalVisible(false);
    }
  };

  const handleSendFeedbackSubmit = () => {
    if (!feedbackText.trim()) return;
    Alert.alert('Thank You!', 'Your feedback has been received.');
    setFeedbackText('');
    setFeedbackModalVisible(false);
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'N';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (isOffline) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={screenBg} />
        <OfflineNotice onRetry={loadSettings} isRetrying={loading} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: screenBg }]}>
        <ActivityIndicator size="large" color={accentGreen} />
      </View>
    );
  }

  const isPresetSelected = PRESET_REMINDER_TIMES.some((p) => p.value === reminderTime);
  const customDisplayLabel = !isPresetSelected ? reminderTime : 'Custom';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={screenBg} />

      {/* Header Bar */}
      <View
        style={[
          styles.headerWrapper,
          {
            backgroundColor: screenBg,
            paddingHorizontal: isNarrow ? 16 : 20,
            paddingTop: Math.max(insets.top > 0 ? 6 : 14, 10),
          },
        ]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={[styles.headerBackButton, { backgroundColor: cardBg, borderColor: borderSubtle }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={textColor} />
          </TouchableOpacity>

          <Text style={[styles.headerCenteredTitle, { color: textColor }]}>Settings</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isNarrow ? 16 : 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 20) + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wrapper}>
          
          {/* 1. HERO ATHLETE PROFILE CARD */}
          <View style={[styles.profileHeroCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            <View style={styles.profileHeroMain}>
              <TouchableOpacity
                onPress={handlePickAndUploadAvatar}
                activeOpacity={0.8}
                style={[styles.heroAvatarContainer, { borderColor: accentGreen }]}
                disabled={isUploadingAvatar}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.heroAvatarImage} />
                ) : (
                  <View style={[styles.heroAvatarPlaceholder, { backgroundColor: accentGreen }]}>
                    <Text style={[styles.heroAvatarInitials, { color: PALETTE.dark }]}>
                      {getInitials(fullName || session?.user?.email || 'NUMO')}
                    </Text>
                  </View>
                )}
                {isUploadingAvatar ? (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={[styles.heroAvatarMiniBadge, { backgroundColor: accentGreen }]}>
                    <Ionicons name="camera" size={11} color={PALETTE.dark} />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.heroProfileInfo}>
                <View style={[styles.athleteTierPill, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.18)' : accentLilac }]}>
                  <Text style={[styles.athleteTierText, { color: isDark ? accentGreen : PALETTE.dark }]}>
                    DAILY ATHLETE
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setNameInput(fullName);
                    setEditNameModalVisible(true);
                  }}
                  activeOpacity={0.7}
                  style={styles.heroNameTouchable}
                >
                  <Text style={[styles.heroNameText, { color: textColor }]} numberOfLines={1}>
                    {fullName || 'Add Your Name'}
                  </Text>
                  <Ionicons name="pencil-outline" size={14} color={subtextColor} />
                </TouchableOpacity>

                <Text style={[styles.heroEmailText, { color: subtextColor }]} numberOfLines={1}>
                  {session?.user?.email || 'Personal Account'}
                </Text>

                {avatarUrl && (
                  <TouchableOpacity onPress={handleRemoveAvatar} activeOpacity={0.7} style={{ marginTop: 4 }}>
                    <Text style={[styles.removePhotoText, { color: dangerText }]}>Remove photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* 2. WORKOUT TARGETS (INLINE CONTROLS) */}
          <Text style={[styles.sectionHeader, { color: subtextColor }]}>WORKOUT TARGETS</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            
            {/* Questions per session */}
            <View style={styles.targetRowBlock}>
              <View style={styles.targetLabelRow}>
                <Text style={[styles.targetLabelTitle, { color: textColor }]}>Questions Per Session</Text>
                <Text style={[styles.targetLabelValue, { color: accentGreen }]}>
                  {settings.daily_question_goal} Qs
                </Text>
              </View>
              <View style={styles.segmentedContainer}>
                {QUESTION_OPTIONS.map((count) => {
                  const isSelected = settings.daily_question_goal === count;
                  return (
                    <TouchableOpacity
                      key={count}
                      activeOpacity={0.7}
                      style={[
                        styles.segmentPill,
                        { backgroundColor: pillBaseBg },
                        isSelected && { backgroundColor: accentGreen },
                      ]}
                      onPress={() => handleUpdateQuestions(count)}
                    >
                      <Text
                        style={[
                          styles.segmentPillText,
                          { color: textColor },
                          isSelected && { color: PALETTE.dark, fontWeight: '800' },
                        ]}
                      >
                        {count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* Target Duration */}
            <View style={styles.targetRowBlock}>
              <View style={styles.targetLabelRow}>
                <Text style={[styles.targetLabelTitle, { color: textColor }]}>Target Duration</Text>
                <Text style={[styles.targetLabelValue, { color: accentGreen }]}>
                  {dailyGoalMinutes} min
                </Text>
              </View>
              <View style={styles.segmentedContainer}>
                {DURATION_OPTIONS.map((opt) => {
                  const isSelected = dailyGoalMinutes === opt.mins;
                  return (
                    <TouchableOpacity
                      key={opt.mins}
                      activeOpacity={0.7}
                      style={[
                        styles.segmentPill,
                        { backgroundColor: pillBaseBg },
                        isSelected && { backgroundColor: accentGreen },
                      ]}
                      onPress={() => handleUpdateDuration(opt.mins)}
                    >
                      <Text
                        style={[
                          styles.segmentPillText,
                          { color: textColor },
                          isSelected && { color: PALETTE.dark, fontWeight: '800' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            {/* Weekly Cadence */}
            <View style={styles.targetRowBlock}>
              <View style={styles.targetLabelRow}>
                <Text style={[styles.targetLabelTitle, { color: textColor }]}>Weekly Cadence</Text>
                <Text style={[styles.targetLabelValue, { color: accentGreen }]}>
                  {trainingFrequency.replace(' per week', '/wk')}
                </Text>
              </View>
              <View style={styles.segmentedContainer}>
                {FREQUENCY_OPTIONS.map((opt) => {
                  const isSelected = trainingFrequency === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      activeOpacity={0.7}
                      style={[
                        styles.segmentPill,
                        { backgroundColor: pillBaseBg },
                        isSelected && { backgroundColor: accentGreen },
                      ]}
                      onPress={() => handleUpdateFrequency(opt.value)}
                    >
                      <Text
                        style={[
                          styles.segmentPillText,
                          { color: textColor },
                          isSelected && { color: PALETTE.dark, fontWeight: '800' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 3. SENSORY & FEEDBACK (HAPTICS & AUDIO) */}
          <Text style={[styles.sectionHeader, { color: subtextColor }]}>SENSORY & CADENCE</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Haptic Feedback</Text>
                <Text style={[styles.rowSubtext, { color: subtextColor }]}>Tactile vibrations on arithmetic response.</Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{
                  false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(10,15,11,0.12)',
                  true: accentGreen,
                }}
                thumbColor={isDark ? '#FFFFFF' : '#0A0F0B'}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Sound Effects</Text>
                <Text style={[styles.rowSubtext, { color: subtextColor }]}>Audio cues for completed sets and streaks.</Text>
              </View>
              <Switch
                value={soundsEnabled}
                onValueChange={handleToggleSounds}
                trackColor={{
                  false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(10,15,11,0.12)',
                  true: accentGreen,
                }}
                thumbColor={isDark ? '#FFFFFF' : '#0A0F0B'}
              />
            </View>
          </View>

          {/* 4. NOTIFICATIONS */}
          <Text style={[styles.sectionHeader, { color: subtextColor }]}>REMINDERS</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextCol}>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Daily Reminders</Text>
                <Text style={[styles.rowSubtext, { color: subtextColor }]}>
                  Keep your rhythm alive with timed prompts.
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{
                  false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(10,15,11,0.12)',
                  true: accentGreen,
                }}
                thumbColor={isDark ? '#FFFFFF' : '#0A0F0B'}
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                <View style={styles.targetRowBlock}>
                  <Text style={[styles.targetLabelTitle, { color: textColor, marginBottom: 8 }]}>Preferred Prompt Time</Text>
                  <View style={styles.segmentedContainer}>
                    {PRESET_REMINDER_TIMES.map((time) => {
                      const isSelected = reminderTime === time.value;
                      return (
                        <TouchableOpacity
                          key={time.value}
                          activeOpacity={0.7}
                          style={[
                            styles.segmentPill,
                            { backgroundColor: pillBaseBg },
                            isSelected && { backgroundColor: accentGreen },
                          ]}
                          onPress={() => handleUpdateReminderTime(time.value)}
                        >
                          <Text
                            style={[
                              styles.segmentPillText,
                              { color: textColor },
                              isSelected && { color: PALETTE.dark, fontWeight: '800' },
                            ]}
                          >
                            {time.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[
                        styles.segmentPill,
                        { backgroundColor: pillBaseBg },
                        !isPresetSelected && { backgroundColor: accentGreen },
                      ]}
                      onPress={() => {
                        setCustomTimeInput(!isPresetSelected ? reminderTime : '');
                        setCustomTimeModalVisible(true);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentPillText,
                          { color: textColor },
                          !isPresetSelected && { color: PALETTE.dark, fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        {customDisplayLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* 5. APPEARANCE */}
          <Text style={[styles.sectionHeader, { color: subtextColor }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            <View style={styles.targetLabelRow}>
              <Text style={[styles.targetLabelTitle, { color: textColor }]}>Theme Mode</Text>
            </View>
            <View style={[styles.segmentedContainer, { marginTop: 8 }]}>
              {(['system', 'light', 'dark'] as const).map((mode) => {
                const isSelected = themeMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    activeOpacity={0.7}
                    style={[
                      styles.segmentPill,
                      { backgroundColor: pillBaseBg },
                      isSelected && { backgroundColor: accentGreen },
                    ]}
                    onPress={() => setThemeMode(mode)}
                  >
                    <Text
                      style={[
                        styles.segmentPillText,
                        { color: textColor },
                        isSelected && { color: PALETTE.dark, fontWeight: '800' },
                      ]}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 6. SUPPORT & LEGAL (INSET LIST) */}
          <Text style={[styles.sectionHeader, { color: subtextColor }]}>SUPPORT & ABOUT</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderSubtle, paddingVertical: 8 }]}>
            
            <TouchableOpacity
              style={styles.insetNavRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'Help Center',
                  body: 'Need assistance with workout modes, streak tracking, or account management?\n\nContact support directly at:\nsupport@numo.app',
                })
              }
            >
              <View style={styles.insetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.16)' : accentGreen }]}>
                  <Ionicons name="help-buoy" size={17} color={isDark ? accentGreen : PALETTE.dark} />
                </View>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtextColor} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity style={styles.insetNavRow} activeOpacity={0.7} onPress={() => setFeedbackModalVisible(true)}>
              <View style={styles.insetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(242, 202, 236, 0.18)' : accentLilac }]}>
                  <Ionicons name="chatbubble-ellipses" size={17} color={isDark ? accentLilac : PALETTE.dark} />
                </View>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Send Feedback</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtextColor} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.insetNavRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'About NUMO',
                  body: 'NUMO is an interactive arithmetic engine designed to build speed, accuracy, and everyday mental math confidence.\n\nVersion: 1.0.0\nBuild: 2026.09',
                })
              }
            >
              <View style={styles.insetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: pillBaseBg }]}>
                  <Ionicons name="information" size={17} color={textColor} />
                </View>
                <Text style={[styles.rowTitleText, { color: textColor }]}>About NUMO</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtextColor} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.insetNavRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'Privacy Policy',
                  body: 'NUMO does not sell or distribute personal information. All your calculations remain private.',
                })
              }
            >
              <View style={styles.insetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: pillBaseBg }]}>
                  <Ionicons name="shield-checkmark" size={17} color={textColor} />
                </View>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtextColor} />
            </TouchableOpacity>
          </View>

          {/* 7. ACCOUNT SECURITY & ACTIONS */}
          <Text style={[styles.sectionHeader, { color: subtextColor }]}>SECURITY & ACTIONS</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderSubtle, paddingVertical: 8 }]}>
            <TouchableOpacity
              style={styles.insetNavRow}
              activeOpacity={0.7}
              onPress={() => setPasswordModalVisible(true)}
            >
              <View style={styles.insetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: pillBaseBg }]}>
                  <Ionicons name="key" size={17} color={textColor} />
                </View>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtextColor} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity style={styles.insetNavRow} onPress={signOut} activeOpacity={0.7}>
              <View style={styles.insetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: pillBaseBg }]}>
                  <Ionicons name="log-out" size={17} color={textColor} />
                </View>
                <Text style={[styles.rowTitleText, { color: textColor }]}>Sign Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtextColor} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <TouchableOpacity
              style={styles.insetNavRow}
              onPress={() => {
                setDeleteConfirmText('');
                setDeleteModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.insetLeft}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? PALETTE.dangerBgDark : PALETTE.dangerBgLight }]}>
                  <Ionicons name="trash" size={17} color={dangerText} />
                </View>
                <Text style={[styles.rowTitleText, { color: dangerText }]}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={subtextColor} />
            </TouchableOpacity>
          </View>

          {/* 8. CLOUD SYNC STATUS FOOTER */}
          <View style={styles.cloudSyncFooter}>
            <View style={styles.cloudSyncBadge}>
              <View style={[styles.syncStatusDot, { backgroundColor: accentGreen }]} />
              <Text style={[styles.cloudSyncText, { color: subtextColor }]}>
                NUMO v1.0.0 (Build 2026.09) · Cloud Synced
              </Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={editNameModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderSubtle, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Edit Name</Text>
            <Text style={[styles.modalDescription, { color: subtextColor }]}>
              Enter how you want NUMO to address you across workouts.
            </Text>

            <TextInput
              placeholder="Full Name"
              placeholderTextColor={subtextColor}
              style={[styles.modalInput, { backgroundColor: pillBaseBg, color: textColor }]}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: pillBaseBg }]}
                onPress={() => setEditNameModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: accentGreen }]}
                onPress={handleSaveName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color={PALETTE.dark} />
                ) : (
                  <Text style={[styles.modalSubmitText, { color: PALETTE.dark }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Time Selection Modal */}
      <Modal visible={customTimeModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderSubtle, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Set Custom Time</Text>
            <Text style={[styles.modalDescription, { color: subtextColor }]}>
              Enter your ideal daily reminder time (e.g., 07:15 AM or 20:30).
            </Text>

            <TextInput
              placeholder="e.g. 07:30 AM"
              placeholderTextColor={subtextColor}
              style={[styles.modalInput, { backgroundColor: pillBaseBg, color: textColor }]}
              value={customTimeInput}
              onChangeText={setCustomTimeInput}
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: pillBaseBg }]}
                onPress={() => {
                  setCustomTimeModalVisible(false);
                  setCustomTimeInput('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: accentGreen }]}
                onPress={handleSaveCustomTime}
              >
                <Text style={[styles.modalSubmitText, { color: PALETTE.dark }]}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderSubtle, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Change Password</Text>

            <TextInput
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor={subtextColor}
              style={[styles.modalInput, { backgroundColor: pillBaseBg, color: textColor }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              secureTextEntry
              placeholder="New password (min 6 characters)"
              placeholderTextColor={subtextColor}
              style={[styles.modalInput, { backgroundColor: pillBaseBg, color: textColor }]}
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              secureTextEntry
              placeholder="Confirm new password"
              placeholderTextColor={subtextColor}
              style={[styles.modalInput, { backgroundColor: pillBaseBg, color: textColor }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: pillBaseBg }]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: accentGreen }]}
                onPress={handlePasswordSubmit}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color={PALETTE.dark} />
                ) : (
                  <Text style={[styles.modalSubmitText, { color: PALETTE.dark }]}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Send Feedback Modal */}
      <Modal visible={feedbackModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderSubtle, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Send Feedback</Text>
            <Text style={[styles.modalDescription, { color: subtextColor }]}>
              We are constantly working to improve NUMO. Let us know how we can make mental math training better for you.
            </Text>
            <TextInput
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Tell us what you think..."
              placeholderTextColor={subtextColor}
              style={[styles.modalInput, styles.modalTextArea, { backgroundColor: pillBaseBg, color: textColor }]}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: pillBaseBg }]}
                onPress={() => setFeedbackModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: accentGreen }]}
                onPress={handleSendFeedbackSubmit}
              >
                <Text style={[styles.modalSubmitText, { color: PALETTE.dark }]}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderSubtle, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: dangerText }]}>Delete Account</Text>
            <Text style={[styles.modalDescription, { color: subtextColor }]}>
              This action is permanent. Your profile, workout history, calculation statistics, and settings will be permanently erased.
            </Text>
            <Text style={[styles.deleteInstructionText, { color: textColor }]}>
              Type <Text style={{ fontWeight: '800' }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={subtextColor}
              style={[styles.modalInput, { backgroundColor: pillBaseBg, color: textColor }]}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: pillBaseBg }]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  { backgroundColor: isDark ? PALETTE.dangerBgDark : PALETTE.dangerBgLight },
                  deleteConfirmText !== 'DELETE' && { opacity: 0.4 },
                ]}
                disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                onPress={handleDeleteAccount}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator size="small" color={dangerText} />
                ) : (
                  <Text style={[styles.modalDeleteButtonText, { color: dangerText }]}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Info Modal */}
      <Modal visible={infoModalContent !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg, borderColor: borderSubtle, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>{infoModalContent?.title}</Text>
            <Text style={[styles.infoBodyText, { color: subtextColor }]}>{infoModalContent?.body}</Text>
            <TouchableOpacity
              style={[styles.infoCloseButton, { backgroundColor: accentGreen }]}
              onPress={() => setInfoModalContent(null)}
            >
              <Text style={[styles.infoCloseButtonText, { color: PALETTE.dark }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerWrapper: {
    width: '100%',
    zIndex: 10,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  headerBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerCenteredTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 38,
  },
  scrollContent: {
    flexGrow: 1,
  },
  wrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 16,
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
    marginBottom: -6,
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },

  /* Hero Athlete Profile Card */
  profileHeroCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeroMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  heroAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarInitials: {
    fontSize: 24,
    fontWeight: '900',
  },
  heroAvatarMiniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0F0B',
  },
  heroProfileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  athleteTierPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  athleteTierText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroNameTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroNameText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroEmailText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  removePhotoText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Inline Segmented Controls */
  targetRowBlock: {
    paddingVertical: 2,
  },
  targetLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  targetLabelTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  targetLabelValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  segmentedContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* Switch & Sensory Rows */
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchTextCol: {
    flex: 1,
    marginRight: 14,
  },
  rowTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  rowSubtext: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },

  /* Inset Navigation Rows */
  insetNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  insetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: 1,
    marginVertical: 12,
  },

  /* Cloud Sync Footer */
  cloudSyncFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  cloudSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cloudSyncText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  modalTextArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  deleteInstructionText: {
    fontSize: 12,
    marginBottom: 8,
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDeleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoBodyText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoCloseButton: {
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});