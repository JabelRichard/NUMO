// app/(app)/settings.tsx
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

      // Explicit guard: ensure base64 is a valid string
      if (!asset.base64) {
        Alert.alert('Error', 'Could not process image data.');
        return;
      }

      setIsUploadingAvatar(true);
      const fileExt = asset.uri.split('.').pop() || 'jpg';

      // asset.base64 is strictly narrowed to string here
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#EC673C" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your NUMO experience</Text>
        </View>

        {/* SECTION 1: WORKOUT */}
        <Text style={styles.sectionHeader}>WORKOUT</Text>
        <View style={styles.card}>
          <View style={styles.settingBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.settingLabel}>Daily Questions</Text>
              {savingKey === 'questions' && <ActivityIndicator size="small" color="#EC673C" />}
            </View>
            <Text style={styles.settingDescription}>
              Number of questions presented in normal daily workouts.
            </Text>
            <View style={styles.pillsContainer}>
              {QUESTION_OPTIONS.map((count) => {
                const isSelected = settings.daily_question_goal === count;
                return (
                  <TouchableOpacity
                    key={count}
                    activeOpacity={0.7}
                    style={[styles.pill, isSelected && styles.pillActive]}
                    onPress={() => handleUpdateQuestions(count)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                      {count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.settingLabel}>Improvement Focus</Text>
              {savingKey === 'goals' && <ActivityIndicator size="small" color="#EC673C" />}
            </View>
            <Text style={styles.settingDescription}>Select skills to prioritize.</Text>
            <View style={styles.goalGrid}>
              {GOAL_OPTIONS.map((item) => {
                const isSelected = settings.goals.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    style={[styles.goalChip, isSelected && styles.goalChipActive]}
                    onPress={() => handleToggleGoal(item.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={isSelected ? '#EC673C' : '#666666'}
                      style={styles.chipIcon}
                    />
                    <Text style={[styles.goalChipText, isSelected && styles.goalChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION 2: ACCOUNT */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          {/* Avatar Management Row */}
          <View style={styles.avatarSectionRow}>
            <TouchableOpacity
              onPress={handlePickAndUploadAvatar}
              style={styles.settingsAvatarContainer}
              disabled={isUploadingAvatar}
              activeOpacity={0.8}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.settingsAvatarImage} />
              ) : (
                <View style={styles.settingsAvatarPlaceholder}>
                  <Text style={styles.settingsAvatarInitials}>
                    {getInitials(fullName || session?.user?.email || 'NUMO')}
                  </Text>
                </View>
              )}
              {isUploadingAvatar && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.avatarActions}>
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={handlePickAndUploadAvatar}
                disabled={isUploadingAvatar}
                activeOpacity={0.7}
              >
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>

              {avatarUrl && (
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={handleRemoveAvatar}
                  disabled={isUploadingAvatar}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removePhotoText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Full Name Row */}
          <View style={styles.itemRow}>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemLabel}>Name</Text>
              {isEditingName ? (
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Enter full name"
                  placeholderTextColor="#8E8E93"
                  style={styles.nameTextInput}
                  autoFocus
                />
              ) : (
                <Text style={styles.itemValue}>{fullName || 'Not provided'}</Text>
              )}
            </View>
            {isEditingName ? (
              <View style={styles.inlineActionRow}>
                <TouchableOpacity onPress={() => setIsEditingName(false)} style={styles.cancelAction}>
                  <Text style={styles.cancelActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveName} style={styles.saveAction}>
                  {savingKey === 'name' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveActionText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.editAction}>
                <Text style={styles.editActionText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {/* Email Address (Read-only) */}
          <View style={styles.itemRow}>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemLabel}>Email Address</Text>
              <Text style={styles.itemValue}>{session?.user?.email || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Change Password */}
          <TouchableOpacity
            style={styles.navRow}
            activeOpacity={0.7}
            onPress={() => setPasswordModalVisible(true)}
          >
            <View style={styles.navLeft}>
              <Ionicons name="key-outline" size={18} color="#1C1C1E" style={styles.navIcon} />
              <Text style={styles.navLabel}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutRow} onPress={signOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="#EC673C" style={styles.navIcon} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Delete Account (Destructive) */}
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

        {/* SECTION 3: ABOUT */}
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <View style={styles.card}>
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
            <Text style={styles.navLabel}>About NUMO</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
          </TouchableOpacity>

          <View style={styles.divider} />

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
            <Text style={styles.navLabel}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
          </TouchableOpacity>

          <View style={styles.divider} />

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
            <Text style={styles.navLabel}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <TextInput
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor="#8E8E93"
              style={styles.modalInput}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              secureTextEntry
              placeholder="New password (min 6 characters)"
              placeholderTextColor="#8E8E93"
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              secureTextEntry
              placeholder="Confirm new password"
              placeholderTextColor="#8E8E93"
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitButton}
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
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: '#FF3B30' }]}>Delete Account</Text>
            <Text style={styles.deleteWarningText}>
              This action is permanent. Your profile, workout history, calculation statistics, and settings will be permanently erased.
            </Text>
            <Text style={styles.deleteInstructionText}>
              Type <Text style={{ fontWeight: '800' }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor="#8E8E93"
              style={styles.modalInput}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
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
        </View>
      </Modal>

      {/* Info / Legal Modal */}
      <Modal visible={infoModalContent !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{infoModalContent?.title}</Text>
            <Text style={styles.infoBodyText}>{infoModalContent?.body}</Text>
            <TouchableOpacity
              style={styles.infoCloseButton}
              onPress={() => setInfoModalContent(null)}
            >
              <Text style={styles.infoCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E6E6E6' },
  centerContainer: { flex: 1, backgroundColor: '#E6E6E6', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: '#666666', marginTop: 4 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#8E8E93', marginBottom: 8, marginLeft: 4, letterSpacing: 0.8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 24 },
  settingBlock: { paddingVertical: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  settingLabel: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  settingDescription: { fontSize: 13, color: '#666666', marginBottom: 14 },
  pillsContainer: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  pillActive: { backgroundColor: '#FFF4F0', borderColor: '#EC673C' },
  pillText: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  pillTextActive: { color: '#EC673C' },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: 'transparent' },
  goalChipActive: { backgroundColor: '#FFF4F0', borderColor: '#EC673C' },
  chipIcon: { marginRight: 6 },
  goalChipText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  goalChipTextActive: { color: '#EC673C' },
  divider: { height: 1, backgroundColor: '#EFEFF4', marginVertical: 12 },
  
  // Avatar Styles
  avatarSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  settingsAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsAvatarImage: {
    width: '100%',
    height: '100%',
  },
  settingsAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EC673C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActions: {
    marginLeft: 16,
    gap: 6,
  },
  changePhotoBtn: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  removePhotoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  removePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },

  // Item Rows
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  itemTextContainer: { flex: 1 },
  itemLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 2 },
  itemValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  nameTextInput: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', borderBottomWidth: 1.5, borderColor: '#EC673C', paddingVertical: 2, marginRight: 10 },
  inlineActionRow: { flexDirection: 'row', gap: 8 },
  editAction: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F2F2F7' },
  editActionText: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  saveAction: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#EC673C' },
  saveActionText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  cancelAction: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  cancelActionText: { fontSize: 13, color: '#8E8E93' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  navLeft: { flexDirection: 'row', alignItems: 'center' },
  navIcon: { marginRight: 10 },
  navLabel: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  signOutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#EC673C' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  deleteText: { fontSize: 15, fontWeight: '700', color: '#FF3B30' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalContent: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 12 },
  deleteWarningText: { fontSize: 14, color: '#666666', lineHeight: 20, marginBottom: 12 },
  deleteInstructionText: { fontSize: 13, color: '#1C1C1E', marginBottom: 10 },
  modalInput: { backgroundColor: '#F2F2F7', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1C1C1E', marginBottom: 12 },
  modalButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F2F2F7', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  modalSubmitButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#EC673C', alignItems: 'center' },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  modalDeleteButton: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF3B30', alignItems: 'center' },
  modalDeleteButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  infoBodyText: { fontSize: 14, color: '#3A3A3C', lineHeight: 22, marginBottom: 20 },
  infoCloseButton: { backgroundColor: '#1C1C1E', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  infoCloseButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});