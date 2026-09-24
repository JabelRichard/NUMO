import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { getUserSettings } from '../../../src/services/settingsService';
import {
  fetchAllWorkouts,
  getNextFocus,
  FocusOperation,
  WorkoutSessionRecord,
} from '../../../src/services/workoutService';
import { FUTURE_PROGRAMS } from '../../../src/data/trainingPrograms';
import { ProgramCard } from '../../../src/components/ProgramCard';
import { OfflineNotice } from '../../../src/components/OfflineNotice';

type Difficulty = 'easy' | 'medium' | 'hard';

interface OperationData {
  id: FocusOperation | 'adaptive_mix';
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  glyph?: string;
}

const OPERATIONS: OperationData[] = [
  {
    id: 'addition',
    title: 'Addition',
    subtitle: 'Sums & carries',
    icon: 'add',
  },
  {
    id: 'subtraction',
    title: 'Subtraction',
    subtitle: 'Differences & deduction',
    icon: 'remove',
  },
  {
    id: 'multiplication',
    title: 'Multiplication',
    subtitle: 'Times tables & scaling',
    icon: 'close',
  },
  {
    id: 'division',
    title: 'Division',
    subtitle: 'Quotients & factors',
    glyph: '÷',
  },
  {
    id: 'adaptive_mix',
    title: 'Mixed Challenge',
    subtitle: 'All operations combined',
    icon: 'shuffle',
  },
];

const DIFFICULTIES: { level: Difficulty; label: string }[] = [
  { level: 'easy', label: 'Easy' },
  { level: 'medium', label: 'Medium' },
  { level: 'hard', label: 'Hard' },
];

export default function TrainingSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === 'dark');
  const params = useLocalSearchParams<{ mode?: string; difficulty?: Difficulty }>();
  const isNarrow = width < 360;

  const [isOffline, setIsOffline] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSessionRecord[]>([]);
  const [userQuestionGoal, setUserQuestionGoal] = useState<number>(10);

  // Selected state for modal
  const [selectedOperation, setSelectedOperation] = useState<OperationData | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(params.difficulty || 'easy');
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  const loadScreenData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [workoutsData, settingsData] = await Promise.all([
        fetchAllWorkouts(user.id).catch(() => []),
        getUserSettings(user.id).catch(() => null),
      ]);

      setWorkouts(workoutsData || []);
      if (settingsData?.daily_question_goal) {
        setUserQuestionGoal(Number(settingsData.daily_question_goal) || 10);
      }
    } catch (e) {
      console.warn('Error loading training screen data:', e);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadScreenData();
    }, [loadScreenData])
  );

  useEffect(() => {
    if (params.mode === 'demo') {
      router.replace({
        pathname: '/workout' as any,
        params: {
          mode: 'adaptive_mix',
          difficulty: 'easy',
          isDemo: 'true',
        },
      });
    }
  }, [params.mode]);

  const handleRetryConnection = async () => {
    const state = await NetInfo.fetch();
    const offline = state.isConnected === false || state.isInternetReachable === false;
    setIsOffline(offline);
    if (!offline) {
      loadScreenData();
    }
  };

  // Recommended focus aligned with Home & Stats
  const nextFocusRecommendation = useMemo(() => {
    return getNextFocus(workouts);
  }, [workouts]);

  // Dynamic baseline adaptive difficulty
  const adaptiveDifficulty = useMemo((): Difficulty => {
    if (workouts.length === 0) return 'easy';
    const sample = workouts.slice(0, 5);
    const avgAccuracy = sample.reduce((acc, curr) => acc + (Number(curr.accuracy) || 0), 0) / sample.length;
    const avgTimePerQuestionMs =
      sample.reduce((acc, curr) => acc + (Number(curr.average_time_per_question) || 0), 0) / sample.length;

    if (avgAccuracy >= 85 && avgTimePerQuestionMs <= 3500) return 'hard';
    if (avgAccuracy >= 70) return 'medium';
    return 'easy';
  }, [workouts]);

  const screenBg = isDark ? '#0A0F0B' : '#F1ECE9';
  const cardBg = isDark ? '#141C15' : '#FFFFFF';
  const cardElevated = isDark ? '#1B241C' : '#F8F6F4';
  const primaryText = isDark ? '#F1ECE9' : '#0A0F0B';
  const secondaryText = isDark ? 'rgba(241, 236, 233, 0.65)' : 'rgba(10, 15, 11, 0.55)';
  const borderSubtle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(10, 15, 11, 0.08)';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(10, 15, 11, 0.06)';
  const accentGreen = '#BCE3AA';
  const accentLilac = '#F2CAEC';

  const handleOpenDifficulty = (op: OperationData) => {
    setSelectedOperation(op);
    setSelectedDifficulty(params.difficulty || adaptiveDifficulty);
  };

  const handleDismissModal = () => {
    setSelectedOperation(null);
  };

  const handleContinueToWorkout = () => {
    if (!selectedOperation) return;
    const rawMode = selectedOperation.id;
    const mode = rawMode === 'mixed' ? 'adaptive_mix' : rawMode;
    const diff = selectedDifficulty;
    const isNewUser = workouts.length === 0;

    handleDismissModal();

    router.push({
      pathname: '/workout' as any,
      params: {
        mode,
        difficulty: diff,
        count: isNewUser ? '10' : userQuestionGoal.toString(),
        source: 'training_menu',
        reset: 'true',
        sessionKey: Date.now().toString(),
      },
    });
  };

  if (isOffline) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top', 'bottom']}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={screenBg}
        />
        <OfflineNotice onRetry={handleRetryConnection} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={screenBg}
      />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: cardBg, borderColor: borderSubtle }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: primaryText }]}>Workout</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isNarrow ? 16 : 20,
            paddingBottom: Math.max(insets.bottom, 20) + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveWrapper}>
          {/* Header Title Section */}
          <View style={styles.titleSection}>
            <View
              style={[
                styles.tagBadge,
                { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.16)' : accentLilac },
              ]}
            >
              <Text style={[styles.tagBadgeText, { color: isDark ? accentGreen : '#0A0F0B' }]}>
                PRACTICE
              </Text>
            </View>
            <Text style={[styles.mainHeading, { color: primaryText }]}>
              Choose your workout
            </Text>
            <Text style={[styles.subHeading, { color: secondaryText }]}>
              Master one skill or challenge all four.
            </Text>
          </View>

          {/* Grouped Operations Card */}
          <View style={[styles.groupedCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            {OPERATIONS.map((op, index) => {
              const iconBg = index % 2 === 0 ? accentGreen : accentLilac;
              const isRecommended =
                nextFocusRecommendation.targetOp === op.id ||
                (nextFocusRecommendation.targetOp === 'mixed' && op.id === 'adaptive_mix');

              return (
                <React.Fragment key={op.id}>
                  <TouchableOpacity
                    style={styles.programCardRow}
                    activeOpacity={0.7}
                    onPress={() => handleOpenDifficulty(op)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                      {op.glyph ? (
                        <Text style={styles.glyphText}>{op.glyph}</Text>
                      ) : (
                        <Ionicons name={op.icon!} size={20} color="#0A0F0B" />
                      )}
                    </View>

                    <View style={styles.textStack}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.programTitle, { color: primaryText }]}>{op.title}</Text>
                        {isRecommended && (
                          <View style={[styles.recPill, { backgroundColor: accentGreen }]}>
                            <Text style={styles.recPillText}>RECOMMENDED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.programSubtitle, { color: secondaryText }]}>
                        {op.subtitle}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={secondaryText} />
                  </TouchableOpacity>

                  {index < OPERATIONS.length - 1 && (
                    <View style={[styles.cardDivider, { backgroundColor: dividerColor }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* More Modes Section */}
          <View style={[styles.othersHeaderCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
            <TouchableOpacity
              style={styles.othersTouchable}
              activeOpacity={0.7}
              onPress={() => setShowOthers(!showOthers)}
            >
              <View style={styles.othersTextGroup}>
                <Text style={[styles.othersTitle, { color: primaryText }]}>More modes</Text>
                <Text style={[styles.othersSubtitle, { color: secondaryText }]}>
                  Speed runs & AI coach
                </Text>
              </View>
              <Ionicons
                name={showOthers ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={secondaryText}
              />
            </TouchableOpacity>

            {showOthers && (
              <View style={styles.futureList}>
                <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                {FUTURE_PROGRAMS.map((program, index) => (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    showDivider={index < FUTURE_PROGRAMS.length - 1}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Slide-Up Bottom Sheet Modal */}
      <Modal
        visible={selectedOperation !== null}
        transparent
        animationType="slide"
        onRequestClose={handleDismissModal}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropDismiss}
            activeOpacity={1}
            onPress={handleDismissModal}
          />

          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: isDark ? '#141C15' : '#FFFFFF',
                borderTopColor: borderSubtle,
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            {/* Grab Handle */}
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)' },
              ]}
            />

            {/* Modal Title */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: primaryText }]}>
                {selectedOperation?.title}
              </Text>
            </View>

            {/* Difficulty Options */}
            <View style={styles.difficultyList}>
              {DIFFICULTIES.map(({ level, label }) => {
                const isSelected = selectedDifficulty === level;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.diffCard,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(188, 227, 170, 0.15)'
                            : 'rgba(188, 227, 170, 0.35)'
                          : cardElevated,
                        borderColor: isSelected ? accentGreen : borderSubtle,
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedDifficulty(level)}
                  >
                    <Text
                      style={[
                        styles.diffCardTitle,
                        { color: primaryText, fontWeight: isSelected ? '800' : '600' },
                      ]}
                    >
                      {label}
                    </Text>

                    <View
                      style={[
                        styles.checkCircle,
                        {
                          borderColor: isSelected ? accentGreen : borderSubtle,
                          backgroundColor: isSelected ? accentGreen : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Ionicons name="checkmark" size={14} color="#0A0F0B" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: accentGreen }]}
              activeOpacity={0.85}
              onPress={handleContinueToWorkout}
            >
              <Text style={styles.continueButtonText}>START</Text>
              <Ionicons name="arrow-forward" size={18} color="#0A0F0B" />
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerInner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 10,
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: 20,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  tagBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  mainHeading: {
    fontSize: 27,
    fontWeight: '600',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '500',
  },
  groupedCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 2,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  programCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  glyphText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: '#0A0F0B',
    textAlign: 'center',
  },
  textStack: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  programTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  recPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0A0F0B',
    letterSpacing: 0.5,
  },
  programSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  othersHeaderCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
  },
  othersTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  othersTextGroup: {
    flex: 1,
  },
  othersTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  othersSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  futureList: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    marginBottom: 10,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetBackdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  difficultyList: {
    gap: 8,
    marginBottom: 18,
  },
  diffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  diffCardTitle: {
    fontSize: 15,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButton: {
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0F0B',
    letterSpacing: 1,
  },
});