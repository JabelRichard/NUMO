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

// Options
const QUESTION_OPTIONS: number[] = [5, 10, 30, 50];
const DURATION_OPTIONS: { mins: number; label: string }[] = [
  { mins: 2, label: '2 mins' },
  { mins: 5, label: '5 mins' },
  { mins: 10, label: '10 mins' },
];
const FREQUENCY_OPTIONS: string[] = ['3 days per week', '5 days per week', 'Every day'];

// Presets (First 3 slots)
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
};

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { theme, themeMode, setThemeMode } = useTheme();

  const isCompact = height < 720;
  const isNarrow = width < 360;

  // DB Settings
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Accordion Expandable States
  const [expandedSection, setExpandedSection] = useState<'questions' | 'duration' | 'frequency' | null>(null);

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
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');

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

  const loadSettings = useCallback(async () => {
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

      const [storedNotifs, storedTime, storedMins, storedFreq] = await Promise.all([
        AsyncStorage.getItem(PREF_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(PREF_KEYS.REMINDER_TIME),
        AsyncStorage.getItem(PREF_KEYS.DAILY_MINUTES),
        AsyncStorage.getItem(PREF_KEYS.FREQUENCY),
      ]);

      if (storedNotifs !== null) setNotificationsEnabled(storedNotifs === 'true');
      if (storedTime !== null) setReminderTime(storedTime);
      if (storedMins !== null) setDailyGoalMinutes(parseInt(storedMins, 10) || 5);
      if (storedFreq !== null) setTrainingFrequency(storedFreq);
    } catch {
      Alert.alert('Error', 'Could not load your settings.');
    } finally {
      setLoading(false);
    }
  }, [userId, session]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleAccordion = (section: 'questions' | 'duration' | 'frequency') => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // --- Handlers ---
  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    try {
      await AsyncStorage.setItem(PREF_KEYS.NOTIFICATIONS, val ? 'true' : 'false');
    } catch (e) {
      console.error('Failed saving notification preference', e);
    }
  };

  const handleUpdateReminderTime = async (timeStr: string) => {
    setReminderTime(timeStr);
    try {
      await AsyncStorage.setItem(PREF_KEYS.REMINDER_TIME, timeStr);
    } catch (e) {
      console.error('Failed saving reminder time', e);
    }
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
    try {
      await AsyncStorage.setItem(PREF_KEYS.DAILY_MINUTES, mins.toString());
    } catch (e) {
      console.error('Failed saving duration', e);
    }
  };

  const handleUpdateFrequency = async (freq: string) => {
    setTrainingFrequency(freq);
    try {
      await AsyncStorage.setItem(PREF_KEYS.FREQUENCY, freq);
    } catch (e) {
      console.error('Failed saving frequency', e);
    }
  };

  const handleUpdateQuestions = async (count: number) => {
    if (!userId || settings.daily_question_goal === count) return;
    const prev = settings.daily_question_goal;
    setSettings((p) => ({ ...p, daily_question_goal: count }));
    setSavingKey('questions');

    const res = await saveUserSettings(userId, { daily_question_goal: count });
    setSavingKey(null);
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
    setSavingKey('name');
    const res = await updateProfileName(userId, nameInput.trim());
    setSavingKey(null);

    if (res.success) {
      setFullName(nameInput.trim());
      setIsEditingName(false);
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

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const isLight = !theme.isDark;

  // Determine if active reminder time is a preset or custom
  const isPresetSelected = PRESET_REMINDER_TIMES.some((p) => p.value === reminderTime);
  const customDisplayLabel = !isPresetSelected ? reminderTime : 'Custom';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER: Centered Title with Back Button */}
      <View
        style={[
          styles.headerWrapper,
          {
            backgroundColor: theme.background,
            paddingHorizontal: isNarrow ? 16 : 20,
            paddingTop: Math.max(insets.top > 0 ? 6 : 14, 10),
          },
        ]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={[styles.headerBackButton, { backgroundColor: isLight ? '#FFFFFF' : theme.card }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <Text style={[styles.headerCenteredTitle, { color: theme.text }]}>Settings</Text>

          <View style={styles.headerPlaceholder} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isNarrow ? 16 : 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 20) + (isCompact ? 60 : 80),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wrapper}>
          {/* SECTION 1: ACCOUNT (Profile Compact Card) */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>ACCOUNT</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.profileRow}>
              {/* Compact Avatar */}
              <TouchableOpacity
                onPress={handlePickAndUploadAvatar}
                activeOpacity={0.8}
                style={[styles.compactAvatar, { backgroundColor: theme.pillBg }]}
                disabled={isUploadingAvatar}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.compactAvatarImage} />
                ) : (
                  <View style={[styles.compactAvatarPlaceholder, { backgroundColor: theme.primary }]}>
                    <Text style={styles.compactAvatarInitials}>
                      {getInitials(fullName || session?.user?.email || 'NUMO')}
                    </Text>
                  </View>
                )}
                {isUploadingAvatar ? (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={[styles.avatarMiniBadge, { backgroundColor: theme.primary }]}>
                    <Ionicons name="camera" size={10} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Name & Email Stack */}
              <View style={styles.profileTextColumn}>
                {isEditingName ? (
                  <View style={styles.inlineEditRow}>
                    <TextInput
                      value={nameInput}
                      onChangeText={setNameInput}
                      placeholder="Full Name"
                      placeholderTextColor={theme.muted}
                      style={[styles.inlineNameInput, { color: theme.text, borderColor: theme.primary }]}
                      autoFocus
                    />
                    <TouchableOpacity onPress={handleSaveName} style={[styles.inlineSaveBtn, { backgroundColor: theme.primary }]}>
                      {savingKey === 'name' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.inlineSaveText}>Save</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsEditingName(false)} style={styles.inlineCancelBtn}>
                      <Text style={[styles.inlineCancelText, { color: theme.muted }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setIsEditingName(true)}
                    activeOpacity={0.7}
                    style={styles.profileNameRow}
                  >
                    <Text style={[styles.profileNameText, { color: theme.text }]} numberOfLines={1}>
                      {fullName || 'Add Name'}
                    </Text>
                    <Ionicons name="pencil-outline" size={14} color={theme.muted} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                )}

                <Text style={[styles.profileEmailText, { color: theme.subtext }]} numberOfLines={1}>
                  {session?.user?.email || 'No email associated'}
                </Text>

                {avatarUrl && (
                  <TouchableOpacity onPress={handleRemoveAvatar} activeOpacity={0.7} style={{ marginTop: 4 }}>
                    <Text style={styles.removePhotoText}>Remove photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* SECTION 2: WORKOUT PREFERENCES (Dropdown Accordions) */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>WORKOUT PREFERENCES</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Accordion Item 1: Questions per Workout */}
            <TouchableOpacity
              style={styles.accordionHeaderRow}
              activeOpacity={0.7}
              onPress={() => toggleAccordion('questions')}
            >
              <Text style={[styles.accordionTitle, { color: theme.text }]}>Questions per Workout</Text>
              <View style={styles.accordionValueRight}>
                <Text style={[styles.accordionValueText, { color: theme.subtext }]}>
                  {settings.daily_question_goal} questions
                </Text>
                <Ionicons
                  name={expandedSection === 'questions' ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={theme.muted}
                />
              </View>
            </TouchableOpacity>

            {expandedSection === 'questions' && (
              <View style={styles.accordionBody}>
                <View style={styles.pillsContainer}>
                  {QUESTION_OPTIONS.map((count) => {
                    const isSelected = settings.daily_question_goal === count;
                    return (
                      <TouchableOpacity
                        key={count}
                        activeOpacity={0.7}
                        style={[
                          styles.pill,
                          { backgroundColor: theme.pillBg },
                          isSelected && {
                            backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF4F0',
                            borderColor: theme.primary,
                          },
                        ]}
                        onPress={() => handleUpdateQuestions(count)}
                      >
                        <Text style={[styles.pillText, { color: theme.text }, isSelected && { color: theme.primary }]}>
                          {count}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            {/* Accordion Item 2: Target Duration */}
            <TouchableOpacity
              style={styles.accordionHeaderRow}
              activeOpacity={0.7}
              onPress={() => toggleAccordion('duration')}
            >
              <Text style={[styles.accordionTitle, { color: theme.text }]}>Target Duration</Text>
              <View style={styles.accordionValueRight}>
                <Text style={[styles.accordionValueText, { color: theme.subtext }]}>
                  {dailyGoalMinutes} mins
                </Text>
                <Ionicons
                  name={expandedSection === 'duration' ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={theme.muted}
                />
              </View>
            </TouchableOpacity>

            {expandedSection === 'duration' && (
              <View style={styles.accordionBody}>
                <View style={styles.pillsContainer}>
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = dailyGoalMinutes === opt.mins;
                    return (
                      <TouchableOpacity
                        key={opt.mins}
                        activeOpacity={0.7}
                        style={[
                          styles.pill,
                          { backgroundColor: theme.pillBg },
                          isSelected && {
                            backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF4F0',
                            borderColor: theme.primary,
                          },
                        ]}
                        onPress={() => handleUpdateDuration(opt.mins)}
                      >
                        <Text style={[styles.pillText, { color: theme.text }, isSelected && { color: theme.primary }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            {/* Accordion Item 3: Weekly Frequency */}
            <TouchableOpacity
              style={styles.accordionHeaderRow}
              activeOpacity={0.7}
              onPress={() => toggleAccordion('frequency')}
            >
              <Text style={[styles.accordionTitle, { color: theme.text }]}>Weekly Frequency</Text>
              <View style={styles.accordionValueRight}>
                <Text style={[styles.accordionValueText, { color: theme.subtext }]}>
                  {trainingFrequency.replace(' per week', '/wk')}
                </Text>
                <Ionicons
                  name={expandedSection === 'frequency' ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={theme.muted}
                />
              </View>
            </TouchableOpacity>

            {expandedSection === 'frequency' && (
              <View style={styles.accordionBody}>
                <View style={styles.pillsContainer}>
                  {FREQUENCY_OPTIONS.map((freq) => {
                    const isSelected = trainingFrequency === freq;
                    return (
                      <TouchableOpacity
                        key={freq}
                        activeOpacity={0.7}
                        style={[
                          styles.pill,
                          { backgroundColor: theme.pillBg },
                          isSelected && {
                            backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF4F0',
                            borderColor: theme.primary,
                          },
                        ]}
                        onPress={() => handleUpdateFrequency(freq)}
                      >
                        <Text style={[styles.pillTextSmall, { color: theme.text }, isSelected && { color: theme.primary }]}>
                          {freq.replace(' per week', '/wk')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* SECTION 3: REMINDERS & NOTIFICATIONS */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>REMINDERS & NOTIFICATIONS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.accordionTitle, { color: theme.text }]}>Reminders & Notifications</Text>
                <Text style={[styles.settingDescription, { color: theme.subtext, marginBottom: 0 }]}>
                  Daily workout prompts, streak alerts, and updates.
                </Text>
              </View>

              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{
                  false: isLight ? '#D1D1D6' : '#3A3A3C',
                  true: theme.primary,
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={isLight ? '#D1D1D6' : '#3A3A3C'}
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                <View style={styles.settingBlock}>
                  <Text style={[styles.settingLabel, { color: theme.text, marginBottom: 4 }]}>Preferred Time</Text>
                  <Text style={[styles.settingDescription, { color: theme.subtext }]}>
                    Choose a preset or enter any custom time you prefer.
                  </Text>
                  <View style={styles.pillsContainer}>
                    {/* 3 Presets */}
                    {PRESET_REMINDER_TIMES.map((time) => {
                      const isSelected = reminderTime === time.value;
                      return (
                        <TouchableOpacity
                          key={time.value}
                          activeOpacity={0.7}
                          style={[
                            styles.pill,
                            { backgroundColor: theme.pillBg },
                            isSelected && {
                              backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF4F0',
                              borderColor: theme.primary,
                            },
                          ]}
                          onPress={() => handleUpdateReminderTime(time.value)}
                        >
                          <Text
                            style={[
                              styles.pillTextSmall,
                              { color: theme.text },
                              isSelected && { color: theme.primary },
                            ]}
                          >
                            {time.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {/* 4th Slot: Custom Time Input Option */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[
                        styles.pill,
                        { backgroundColor: theme.pillBg },
                        !isPresetSelected && {
                          backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF4F0',
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => {
                        setCustomTimeInput(!isPresetSelected ? reminderTime : '');
                        setCustomTimeModalVisible(true);
                      }}
                    >
                      <Text
                        style={[
                          styles.pillTextSmall,
                          { color: theme.text },
                          !isPresetSelected && { color: theme.primary },
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

          {/* SECTION 4: APPEARANCE */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.settingBlock}>
              <Text style={[styles.accordionTitle, { color: theme.text, marginBottom: 4 }]}>Theme Mode</Text>
              <Text style={[styles.settingDescription, { color: theme.subtext }]}>
                Choose your preferred interface appearance.
              </Text>
              <View style={styles.pillsContainer}>
                {(['system', 'light', 'dark'] as const).map((mode) => {
                  const isSelected = themeMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      activeOpacity={0.7}
                      style={[
                        styles.pill,
                        { backgroundColor: theme.pillBg },
                        isSelected && {
                          backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF4F0',
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => setThemeMode(mode)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: theme.text },
                          isSelected && { color: theme.primary },
                        ]}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* SECTION 5: SUPPORT & FEEDBACK */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>SUPPORT</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'Help Center',
                  body: 'Need assistance with workouts, streak tracking, or your account?\n\nContact support directly at:\nsupport@numo.app',
                })
              }
            >
              <Text style={[styles.navLabel, { color: theme.text }]}>Help center</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={() => setFeedbackModalVisible(true)}
            >
              <Text style={[styles.navLabel, { color: theme.text }]}>Send feedback</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* SECTION 6: ABOUT */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'About NUMO',
                  body: 'NUMO is an interactive arithmetic engine designed to build speed, accuracy, and everyday mental math confidence.\n\nVersion: 1.0.0\nBuild: 2026.09',
                })
              }
            >
              <Text style={[styles.navLabel, { color: theme.text }]}>About NUMO</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'Privacy Policy',
                  body: 'NUMO does not sell or distribute personal information. All your calculations remain private.',
                })
              }
            >
              <Text style={[styles.navLabel, { color: theme.text }]}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'Terms of Service',
                  body: 'By accessing NUMO, you agree to fair use and learning guidelines.',
                })
              }
            >
              <Text style={[styles.navLabel, { color: theme.text }]}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* SECTION 7: ACTIONS */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>ACTIONS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={() => setPasswordModalVisible(true)}
            >
              <View style={styles.navLeft}>
                <Ionicons name="key-outline" size={18} color={theme.text} style={styles.navIcon} />
                <Text style={[styles.navLabel, { color: theme.text }]}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity style={styles.signOutRow} onPress={signOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={18} color={theme.primary} style={styles.navIcon} />
              <Text style={[styles.signOutText, { color: theme.primary }]}>Sign Out</Text>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <TouchableOpacity
              style={styles.deleteRow}
              onPress={() => {
                setDeleteConfirmText('');
                setDeleteModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" style={styles.navIcon} />
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Custom Time Selection Modal */}
      <Modal visible={customTimeModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Set Custom Time</Text>
            <Text style={[styles.modalDescription, { color: theme.subtext }]}>
              Enter your ideal daily reminder time (e.g., 07:15 AM, 2:30 PM, or 21:00).
            </Text>

            <TextInput
              placeholder="e.g. 07:30 AM"
              placeholderTextColor={theme.muted}
              style={[styles.modalInput, { backgroundColor: theme.pillBg, color: theme.text }]}
              value={customTimeInput}
              onChangeText={setCustomTimeInput}
              autoFocus
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  setCustomTimeModalVisible(false);
                  setCustomTimeInput('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveCustomTime}
              >
                <Text style={styles.modalSubmitText}>Set Time</Text>
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
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>

            <TextInput
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor={theme.muted}
              style={[styles.modalInput, { backgroundColor: theme.pillBg, color: theme.text }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              secureTextEntry
              placeholder="New password (min 6 characters)"
              placeholderTextColor={theme.muted}
              style={[styles.modalInput, { backgroundColor: theme.pillBg, color: theme.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              secureTextEntry
              placeholder="Confirm new password"
              placeholderTextColor={theme.muted}
              style={[styles.modalInput, { backgroundColor: theme.pillBg, color: theme.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: theme.pillBg }]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: theme.primary }]}
                onPress={handlePasswordSubmit}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Update</Text>
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
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Send Feedback</Text>
            <Text style={[styles.modalDescription, { color: theme.subtext }]}>
              We are constantly working to improve NUMO. Let us know how we can make mental math training better for you.
            </Text>
            <TextInput
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Tell us what you think..."
              placeholderTextColor={theme.muted}
              style={[styles.modalInput, styles.modalTextArea, { backgroundColor: theme.pillBg, color: theme.text }]}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: theme.pillBg }]}
                onPress={() => setFeedbackModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, { backgroundColor: theme.primary }]}
                onPress={handleSendFeedbackSubmit}
              >
                <Text style={styles.modalSubmitText}>Submit</Text>
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
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: '#FF3B30' }]}>Delete Account</Text>
            <Text style={[styles.modalDescription, { color: theme.subtext }]}>
              This action is permanent. Your profile, workout history, calculation statistics, and settings will be permanently erased.
            </Text>
            <Text style={[styles.deleteInstructionText, { color: theme.text }]}>
              Type <Text style={{ fontWeight: '800' }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={theme.muted}
              style={[styles.modalInput, { backgroundColor: theme.pillBg, color: theme.text }]}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: theme.pillBg }]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  deleteConfirmText !== 'DELETE' && { opacity: 0.4 },
                ]}
                disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                onPress={handleDeleteAccount}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDeleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Info Modal */}
      <Modal visible={infoModalContent !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{infoModalContent?.title}</Text>
            <Text style={[styles.infoBodyText, { color: theme.subtext }]}>{infoModalContent?.body}</Text>
            <TouchableOpacity
              style={[styles.infoCloseButton, { backgroundColor: theme.text }]}
              onPress={() => setInfoModalContent(null)}
            >
              <Text style={[styles.infoCloseButtonText, { color: theme.card }]}>Done</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerCenteredTitle: {
    fontSize: 22,
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
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },

  /* Profile Compact Card */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  compactAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  compactAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  avatarMiniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  profileNameText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profileEmailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  inlineNameInput: {
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: 1.5,
    paddingVertical: 1,
    paddingHorizontal: 4,
    flex: 1,
  },
  inlineSaveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  inlineSaveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  inlineCancelBtn: {
    paddingHorizontal: 6,
  },
  inlineCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  removePhotoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF3B30',
  },

  /* Accordion Styles */
  accordionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  accordionValueRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accordionValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  accordionBody: {
    paddingTop: 10,
    paddingBottom: 4,
  },

  /* General Settings Blocks */
  settingBlock: {
    paddingVertical: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingDescription: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  pillsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pillTextSmall: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },

  /* Navigation & Action Rows */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navIcon: {
    marginRight: 10,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF3B30',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
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
    color: '#FFFFFF',
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  modalDeleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
});