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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
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
import { UserSettings, UserGoal, DEFAULT_USER_SETTINGS } from '../../src/types/settings';
import { useTheme } from '@/src/context/ThemeContext';

const QUESTION_OPTIONS: number[] = [5, 10, 20, 30];

const GOAL_OPTIONS: { id: UserGoal; label: string }[] = [
  { id: 'speed', label: 'Speed' },
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'mental_math', label: 'Mental Math' },
  { id: 'consistency', label: 'Consistency' },
];

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { theme, themeMode, setThemeMode } = useTheme();

  const isCompact = height < 720;
  const isNarrow = width < 360;

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  // Info / Legal Modal State
  const [infoModalContent, setInfoModalContent] = useState<{
    title: string;
    body: string;
  } | null>(null);

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
    } catch {
      Alert.alert('Error', 'Could not load your settings.');
    } finally {
      setLoading(false);
    }
  }, [userId, session]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // --- Workout Handlers ---
  const handleUpdateQuestions = async (count: number) => {
    if (!userId || settings.daily_question_goal === count) return;
    const prev = settings.daily_question_goal;
    setSettings((p) => ({ ...p, daily_question_goal: count }));
    setSavingKey('questions');

    const res = await saveUserSettings(userId, { daily_question_goal: count });
    setSavingKey(null);
    if (!res.success) {
      setSettings((p) => ({ ...p, daily_question_goal: prev }));
      Alert.alert('Save Failed', 'Could not update your question count.');
    }
  };

  const handleToggleGoal = async (goal: UserGoal) => {
    if (!userId) return;

    const currentGoals = settings.goals.filter((g): g is UserGoal => g !== 'balanced');
    let nextGoals: UserGoal[];

    if (currentGoals.includes(goal)) {
      nextGoals = currentGoals.filter((g) => g !== goal);
      if (nextGoals.length === 0) {
        nextGoals = ['balanced'];
      }
    } else {
      nextGoals = [...currentGoals, goal];
    }

    const prevGoals = settings.goals;
    setSettings((p) => ({ ...p, goals: nextGoals }));
    setSavingKey('goals');

    const res = await saveUserSettings(userId, { goals: nextGoals });
    setSavingKey(null);

    if (!res.success) {
      setSettings((p) => ({ ...p, goals: prevGoals }));
      Alert.alert('Save Failed', 'Could not update goals.');
    }
  };

  // --- Avatar Handlers ---
  const handlePickAndUploadAvatar = async () => {
    if (!userId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
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

      if (!asset.base64) {
        Alert.alert('Error', 'Could not process image data.');
        return;
      }

      setIsUploadingAvatar(true);
      const fileExt = asset.uri.split('.').pop() || 'jpg';

      const res = await uploadProfileAvatar(userId, asset.base64, fileExt);
      setIsUploadingAvatar(false);

      if (res.success && res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        Alert.alert('Success', 'Profile photo updated successfully!');
      } else {
        Alert.alert('Upload Failed', res.error || 'Could not upload profile photo.');
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

  // --- Account Handlers ---
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
    if (!email) {
      Alert.alert('Error', 'User session email not found.');
      return;
    }

    if (!currentPassword) {
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

    if (currentPassword === newPassword) {
      Alert.alert('Same Password', 'New password must be different from current password.');
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
      Alert.alert('Success', 'Your password has been changed successfully.');
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
      Alert.alert('Deletion Failed', res.error || 'Could not delete your account. Please try again.');
    } else {
      setDeleteModalVisible(false);
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'M';
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Fixed Header */}
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
        <View style={[styles.header, isCompact && styles.headerCompact]}>
          <Text style={[styles.headerTitle, { color: theme.text }, isCompact && styles.headerTitleCompact]}>
            Settings
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.subtext }]}>Manage your NUMO experience</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isNarrow ? 16 : 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 20) + (isCompact ? 70 : 90),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wrapper}>
          {/* TOP PROFILE HERO (Avatar, Name, Actions) */}
          <View style={styles.profileHero}>
            <TouchableOpacity
              onPress={handlePickAndUploadAvatar}
              style={[
                styles.heroAvatarContainer,
                { backgroundColor: theme.pillBg },
                isCompact && styles.heroAvatarContainerCompact,
              ]}
              disabled={isUploadingAvatar}
              activeOpacity={0.85}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.heroAvatarImage} />
              ) : (
                <View style={[styles.heroAvatarPlaceholder, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.heroAvatarInitials, isCompact && styles.heroAvatarInitialsCompact]}>
                    {getInitials(fullName || session?.user?.email || 'NUMO')}
                  </Text>
                </View>
              )}
              {isUploadingAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : (
                <View style={[styles.avatarCameraBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Profile Name Display / Edit */}
            {isEditingName ? (
              <View style={styles.heroEditNameRow}>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Enter full name"
                  placeholderTextColor={theme.muted}
                  style={[styles.heroNameInput, { color: theme.text, borderColor: theme.primary }]}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setIsEditingName(false)} style={styles.cancelAction}>
                  <Text style={[styles.cancelActionText, { color: theme.muted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveName} style={[styles.saveAction, { backgroundColor: theme.primary }]}>
                  {savingKey === 'name' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveActionText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsEditingName(true)}
                activeOpacity={0.7}
                style={styles.heroNameButton}
              >
                <Text style={[styles.heroNameText, { color: theme.text }, isCompact && styles.heroNameTextCompact]}>
                  {fullName || 'Add Name'}
                </Text>
                <Ionicons name="pencil-outline" size={16} color={theme.muted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}

            <Text style={[styles.heroEmailText, { color: theme.subtext }]}>
              {session?.user?.email || ''}
            </Text>

            {avatarUrl && (
              <TouchableOpacity
                onPress={handleRemoveAvatar}
                disabled={isUploadingAvatar}
                activeOpacity={0.7}
                style={styles.heroRemovePhotoBtn}
              >
                <Text style={styles.removePhotoText}>Remove photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* SECTION 1: ACCOUNT DETAILS */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>ACCOUNT</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isCompact && styles.cardCompact]}>
            {/* Email Address */}
            <View style={styles.itemRow}>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemLabel, { color: theme.muted }]}>Email Address</Text>
                <Text style={[styles.itemValue, { color: theme.text }]}>{session?.user?.email || 'N/A'}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            {/* Change Password */}
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
          </View>

          {/* SECTION 2: WORKOUT */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>WORKOUT</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isCompact && styles.cardCompact]}>
            <View style={styles.settingBlock}>
              <View style={styles.labelRow}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Daily Questions</Text>
                {savingKey === 'questions' && <ActivityIndicator size="small" color={theme.primary} />}
              </View>
              <Text style={[styles.settingDescription, { color: theme.subtext }]}>
                Number of questions presented in normal daily workouts.
              </Text>
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

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <View style={styles.settingBlock}>
              <View style={styles.labelRow}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Improvement Focus</Text>
                {savingKey === 'goals' && <ActivityIndicator size="small" color={theme.primary} />}
              </View>
              <Text style={[styles.settingDescription, { color: theme.subtext }]}>Select skills to prioritize.</Text>
              <View style={styles.goalGrid}>
                {GOAL_OPTIONS.map((item) => {
                  const isSelected = settings.goals.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.7}
                      style={[
                        styles.goalChip,
                        { backgroundColor: theme.pillBg },
                        isSelected && {
                          backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF4F0',
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => handleToggleGoal(item.id)}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={isSelected ? theme.primary : theme.muted}
                        style={styles.chipIcon}
                      />
                      <Text style={[styles.goalChipText, { color: theme.text }, isSelected && { color: theme.primary }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* SECTION 3: APPEARANCE */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isCompact && styles.cardCompact]}>
            <View style={styles.settingBlock}>
              <View style={styles.labelRow}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Theme Mode</Text>
              </View>
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

          {/* SECTION 4: ABOUT */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isCompact && styles.cardCompact]}>
            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={() =>
                setInfoModalContent({
                  title: 'About NUMO',
                  body: 'NUMO is an interactive arithmetic engine designed to build speed, accuracy, and everyday mental math confidence.\n\nVersion: 1.0.0\nBuild: 2026.08',
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
                  body: 'Placeholder Privacy Policy:\n\nNUMO does not sell or distribute personal information. This section will contain full legal disclosures in an upcoming release.',
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
                  body: 'Placeholder Terms of Service:\n\nBy accessing NUMO, you agree to fair use and learning guidelines. Formal legal terms will be published prior to general availability.',
                })
              }
            >
              <Text style={[styles.navLabel, { color: theme.text }]}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* SECTION 5: ACTIONS (Sign Out & Delete Account at the bottom) */}
          <Text style={[styles.sectionHeader, { color: theme.muted }]}>ACTIONS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isCompact && styles.cardCompact]}>
            {/* Sign Out */}
            <TouchableOpacity style={styles.signOutRow} onPress={signOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={18} color={theme.primary} style={styles.navIcon} />
              <Text style={[styles.signOutText, { color: theme.primary }]}>Sign Out</Text>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            {/* Delete Account */}
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

      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }, isCompact && styles.modalContentCompact]}>
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

      {/* Delete Account Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }, isCompact && styles.modalContentCompact]}>
            <Text style={[styles.modalTitle, { color: '#FF3B30' }]}>Delete Account</Text>
            <Text style={[styles.deleteWarningText, { color: theme.subtext }]}>
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

      {/* Info / Legal Modal */}
      <Modal visible={infoModalContent !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }, isCompact && styles.modalContentCompact]}>
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
    backgroundColor: '#E6E6E6',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#E6E6E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerWrapper: {
    width: '100%',
    backgroundColor: '#E6E6E6',
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
  wrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginBottom: 6,
  },
  headerCompact: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  headerTitleCompact: {
    fontSize: 24,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  heroAvatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    position: 'relative',
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroAvatarContainerCompact: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  heroAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  heroAvatarInitialsCompact: {
    fontSize: 26,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNameText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroNameTextCompact: {
    fontSize: 18,
  },
  heroEditNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heroNameInput: {
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 1.5,
    paddingVertical: 2,
    paddingHorizontal: 6,
    minWidth: 160,
    textAlign: 'center',
  },
  heroEmailText: {
    fontSize: 13,
    marginTop: 2,
  },
  heroRemovePhotoBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardCompact: {
    padding: 12,
    marginBottom: 14,
    borderRadius: 16,
  },
  settingBlock: {
    paddingVertical: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  settingDescription: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
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
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipIcon: {
    marginRight: 6,
  },
  goalChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEFF4',
    marginVertical: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 2,
  },
  itemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  cancelAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  cancelActionText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  saveAction: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EC673C',
  },
  saveActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
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
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EC673C',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF3B30',
  },
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalContentCompact: {
    padding: 16,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  deleteWarningText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 10,
  },
  deleteInstructionText: {
    fontSize: 12,
    color: '#1C1C1E',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1C1E',
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
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#EC673C',
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
    color: '#3A3A3C',
    lineHeight: 20,
    marginBottom: 16,
  },
  infoCloseButton: {
    backgroundColor: '#1C1C1E',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
});