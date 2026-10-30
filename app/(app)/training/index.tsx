import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { PALETTE } from '@/src/constants/palette';
import { WEAK_SPOTS } from '@/src/constants/planOptions';
import { typography, MAX_FONT_SCALE } from '@/src/constants/typography';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';
import { useResponsiveContentWidth } from '@/src/hooks/useResponsiveContentWidth';
import { useResponsiveTopPadding } from '@/src/hooks/useResponsiveTopPadding';
import { OfflineNote } from '@/src/components/OfflineNote';
import { TodaysPickCard, useStartWorkout } from '@/src/components/TodaysPickCard';
import { LoadedCoachData, loadCoachDataWithFallback } from '../../../src/services/coachService';
import {
  CoachOperation,
  CoachPlan,
  getCoachPlan,
  isTodaysPick,
  LEVEL_NAMES,
  levelExample,
  mainDifficulty,
  operationName,
  operationSymbol,
  WorkoutRequest,
  workoutForOperation,
} from '../../../src/lib/coach';
import { CORE_OPERATIONS } from '../../../src/lib/math/questionGenerator';
import { DifficultyLevel } from '../../../src/lib/math/types';

const LEVELS: DifficultyLevel[] = ['easy', 'medium', 'hard'];

/** Same names and descriptions as onboarding and Profile. */
const OPERATIONS = WEAK_SPOTS;

/** A level, or "Your levels": each operation at the coach's own level. */
type Choice = DifficultyLevel | 'yours';

interface SheetOption {
  value: Choice;
  title: string;
  /** "like 4×7", or the list of levels for "Your levels". */
  detail: string;
  /** Shows the "Your level" tag. */
  isYours: boolean;
}

/** "+ Medium · − Easy · × Hard · ÷ Medium". */
const levelsSummary = (coach: CoachPlan) =>
  CORE_OPERATIONS.map((op) => `${operationSymbol(op)} ${LEVEL_NAMES[coach.levels[op]]}`).join(' · ');

/**
 * Before the first workout only the warm-up at the starting level is offered.
 * A mix also offers "Your levels" above Easy / Medium / Hard.
 */
function sheetOptions(coach: CoachPlan, op: CoachOperation): SheetOption[] {
  const startLevel =
    op === 'mixed'
      ? mainDifficulty({ operations: CORE_OPERATIONS, difficultyByOperation: coach.levels })
      : coach.levels[op];
  if (coach.isFirstWorkout) {
    return [
      { value: 'yours', title: LEVEL_NAMES[startLevel], detail: `like ${levelExample(op, startLevel)}`, isYours: true },
    ];
  }
  const levels: SheetOption[] = LEVELS.map((level) => ({
    value: level,
    title: LEVEL_NAMES[level],
    detail: `like ${levelExample(op, level)}`,
    isYours: op !== 'mixed' && level === coach.levels[op],
  }));
  if (op !== 'mixed') return levels;
  return [{ value: 'yours', title: 'Your levels (recommended)', detail: levelsSummary(coach), isYours: false }, ...levels];
}

const defaultChoice = (coach: CoachPlan, op: CoachOperation): Choice =>
  coach.isFirstWorkout || op === 'mixed' ? 'yours' : coach.levels[op];

const MAX_CONTENT_WIDTH = 480;
const MAX_SHEET_WIDTH = 500;
const TOP_PADDING = 16;

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isOffline, recheck } = useOnlineStatus(() => loadScreenData());

  const isDark = theme.isDark;
  const isNarrow = width < 360;
  // 480 on a phone, wider on a tablet.
  const contentWidth = useResponsiveContentWidth(MAX_CONTENT_WIDTH);
  // The sheet grows with the screen behind it.
  const sheetWidth = useResponsiveContentWidth(MAX_SHEET_WIDTH);
  // Under the safe area; more on a tablet.
  const topPadding = useResponsiveTopPadding(TOP_PADDING);

  const [loaded, setLoaded] = useState<LoadedCoachData | null>(null);
  const [sheetOp, setSheetOp] = useState<CoachOperation | null>(null);
  const [choice, setChoice] = useState<Choice>('yours');
  // Only the newest load may update the screen.
  const loadIdRef = useRef(0);

  // Same data as Home: live, else the cached copy, else the plan saved on this phone.
  const loadScreenData = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const loadId = ++loadIdRef.current;
    const next = await loadCoachDataWithFallback(userId, await recheck());
    if (loadId === loadIdRef.current) setLoaded(next);
  }, [user?.id, recheck]);

  useFocusEffect(
    useCallback(() => {
      loadScreenData();
    }, [loadScreenData])
  );

  // Same coach as Home, Results and Statistics. Without history it shows the plan's
  // levels, has no pick, and every round is a manual practice round.
  const coach = useMemo(
    () =>
      loaded
        ? getCoachPlan(loaded.data.plan, loaded.data.workouts, new Date(), {
            historyUnknown: loaded.from === 'phone',
          })
        : null,
    [loaded]
  );

  const sheetRequest = useMemo<WorkoutRequest | null>(
    () =>
      coach && loaded && sheetOp
        ? workoutForOperation(coach, loaded.data.plan, sheetOp, choice === 'yours' ? undefined : choice)
        : null,
    [coach, loaded, sheetOp, choice]
  );
  // Any level other than the coach's is saved as manual and never moves the levels.
  const isPracticeRound = sheetRequest?.source === 'manual';

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const primaryText = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const secondaryText = theme.subtext;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const fillBg = isDark ? PALETTE.fillDark : PALETTE.fillLight;
  // One sage accent, same as Home, Profile and Results.
  const accent = theme.primary;
  const accentStrong = theme.primaryText;
  const accentSoft = theme.primarySoft;

  const startWorkout = useStartWorkout();

  const openSheet = (op: CoachOperation) => {
    if (!coach) return;
    setChoice(defaultChoice(coach, op));
    setSheetOp(op);
  };

  const closeSheet = () => setSheetOp(null);

  const handleStartFromSheet = () => {
    if (!sheetRequest) return;
    closeSheet();
    startWorkout(sheetRequest);
  };

  const renderBadge = (op: CoachOperation) => (
    <View
      style={[styles.badge, { backgroundColor: accentSoft }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {op === 'mixed' ? (
        <Ionicons name="shuffle" size={22} color={accentStrong} />
      ) : (
        <Text style={[styles.badgeSymbol, { color: accentStrong }]} maxFontSizeMultiplier={1.3}>
          {operationSymbol(op)}
        </Text>
      )}
    </View>
  );

  // Without any saved history (offline, nothing cached) the pick isn't known, so it's hidden.
  const showPick = coach && !coach.historyUnknown;

  const renderRow = (op: (typeof OPERATIONS)[number], index: number) => {
    if (!coach) return null;
    const id = op.id;
    const isPick = showPick && isTodaysPick(coach, id);
    const level = id === 'mixed' ? null : LEVEL_NAMES[coach.levels[id]];
    const isMastered = id !== 'mixed' && coach.mastered.includes(id);
    const label = [
      op.title,
      level ? `your level ${level}` : 'uses your level for each operation',
      isMastered ? 'mastered' : null,
      isPick ? "today's pick" : null,
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <React.Fragment key={id}>
        {index > 0 && <View style={[styles.cardDivider, { backgroundColor: borderSubtle }]} />}
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => openSheet(id)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Choose a level and start"
        >
          {renderBadge(id)}

          <View style={styles.rowText}>
            <View style={styles.rowTitleLine}>
              <Text style={[styles.rowTitle, { color: primaryText }]}>{op.title}</Text>
              {isPick && (
                <View style={[styles.tag, { backgroundColor: accentSoft }]}>
                  <Text style={[styles.tagText, { color: accentStrong }]}>Today's pick</Text>
                </View>
              )}
            </View>
            <Text style={[styles.rowDesc, { color: secondaryText }]}>{op.desc}</Text>
          </View>

          {level && (
            <View style={styles.rowRight}>
              <Text style={[styles.rowLevel, { color: primaryText }]}>{level}</Text>
              {isMastered && <Text style={[styles.rowMastered, { color: accentStrong }]}>✓ Mastered</Text>}
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={secondaryText} />
        </TouchableOpacity>
      </React.Fragment>
    );
  };

  const options = coach && sheetOp ? sheetOptions(coach, sheetOp) : [];
  const sheetOperation = OPERATIONS.find((o) => o.id === sheetOp);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPadding,
            paddingHorizontal: isNarrow ? 16 : 20,
            paddingBottom: Math.max(insets.bottom, 20) + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.responsiveWrapper, { maxWidth: contentWidth }]}>
          <View style={styles.titleSection}>
            <Text
              style={[styles.screenTitle, { color: primaryText }]}
              accessibilityRole="header"
              maxFontSizeMultiplier={MAX_FONT_SCALE.screenTitle}
            >
              Practice
            </Text>
            <Text style={[styles.subtitle, { color: secondaryText }]}>Pick what you want to practice.</Text>
          </View>

          {!coach ? (
            <ActivityIndicator style={styles.loading} size="large" color={accentStrong} />
          ) : (
            <>
              {loaded && <OfflineNote from={loaded.from} isOffline={isOffline} style={styles.offlineNote} />}

              {coach && <TodaysPickCard coach={coach} style={styles.pickCard} />}

              <Text style={[styles.sectionHeading, { color: primaryText }]} accessibilityRole="header">
                All operations
              </Text>
              <View style={[styles.groupedCard, { backgroundColor: cardBg, borderColor: borderSubtle }]}>
                {OPERATIONS.map(renderRow)}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={sheetOp !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropDismiss}
            activeOpacity={1}
            onPress={closeSheet}
            accessible={false}
            importantForAccessibility="no"
          />

          <View
            style={[
              styles.sheetContainer,
              {
                maxWidth: sheetWidth,
                backgroundColor: cardBg,
                borderTopColor: borderSubtle,
                paddingBottom: Math.max(insets.bottom, 20) + 12,
                maxHeight: '92%',
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHeader}>
              {sheetOp && renderBadge(sheetOp)}
              <Text style={[styles.sheetTitle, { color: primaryText }]} accessibilityRole="header">
                {sheetOp ? operationName(sheetOp) : ''}
              </Text>
              <TouchableOpacity
                onPress={closeSheet}
                style={[styles.closeButton, { backgroundColor: fillBg }]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={primaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
              {sheetOperation && (
                <Text style={[styles.sheetDesc, { color: secondaryText }]}>{sheetOperation.desc}</Text>
              )}

              <View accessibilityRole="radiogroup" style={styles.optionList}>
                {options.map((option) => {
                  const isSelected = choice === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.option,
                        {
                          backgroundColor: isSelected ? accentSoft : fillBg,
                          borderColor: isSelected ? accentStrong : 'transparent',
                        },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setChoice(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected, checked: isSelected }}
                      accessibilityLabel={[option.title, option.detail, option.isYours ? 'your level' : null]
                        .filter(Boolean)
                        .join(', ')}
                    >
                      <View style={styles.optionText}>
                        <Text style={[styles.optionTitle, { color: primaryText }]}>
                          {option.title}
                          {option.value !== 'yours' || coach?.isFirstWorkout ? (
                            <Text style={[styles.optionDetailInline, { color: secondaryText }]}>
                              {' · '}
                              {option.detail}
                            </Text>
                          ) : null}
                        </Text>
                        {option.value === 'yours' && !coach?.isFirstWorkout && (
                          <Text style={[styles.optionDetail, { color: secondaryText }]}>{option.detail}</Text>
                        )}
                        {option.isYours && (
                          <View style={[styles.tag, styles.optionTag, { backgroundColor: accentSoft, borderColor: accentStrong }]}>
                            <Text style={[styles.tagText, { color: accentStrong }]}>Your level</Text>
                          </View>
                        )}
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={isSelected ? accentStrong : secondaryText}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {(coach?.isFirstWorkout || isPracticeRound) && (
                <View style={[styles.note, { backgroundColor: fillBg }]} accessibilityLiveRegion="polite">
                  <Ionicons name="information-circle-outline" size={18} color={secondaryText} />
                  <Text style={[styles.noteText, { color: secondaryText }]}>
                    {coach?.isFirstWorkout
                      ? 'Warm-up first. After your warm-up, you can pick any level.'
                      : "Practice round. This won't change your level."}
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: accent }]}
              activeOpacity={0.85}
              onPress={handleStartFromSheet}
              accessibilityRole="button"
              accessibilityLabel={isPracticeRound ? 'Start practice round' : 'Start'}
            >
              <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Start</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.onPrimary} />
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
  scrollContent: {
    flexGrow: 1,
  },
  responsiveWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: 20,
  },
  screenTitle: {
    ...typography.screenTitle,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.secondary,
  },
  loading: {
    marginTop: 48,
  },
  offlineNote: {
    marginBottom: 16,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  noteText: {
    ...typography.secondary,
    flex: 1,
  },
  pickCard: {
    marginBottom: 24,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 27,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    ...typography.button,
    textAlign: 'center',
    flexShrink: 1,
  },
  sectionHeading: {
    ...typography.button,
    marginBottom: 10,
  },
  groupedCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 2,
    shadowColor: PALETTE.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSymbol: {
    ...typography.sectionHeading,
    fontWeight: '700',
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    ...typography.button,
    letterSpacing: -0.2,
  },
  rowDesc: {
    ...typography.secondary,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '40%',
  },
  rowLevel: {
    ...typography.secondary,
    fontWeight: '600',
    textAlign: 'right',
  },
  rowMastered: {
    ...typography.secondary,
    textAlign: 'right',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    ...typography.secondary,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: PALETTE.scrim,
    justifyContent: 'flex-end',
  },
  sheetBackdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sheetTitle: {
    ...typography.sectionHeading,
    letterSpacing: -0.4,
    flex: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetScrollContent: {
    paddingBottom: 4,
  },
  sheetDesc: {
    ...typography.secondary,
    marginBottom: 14,
  },
  optionList: {
    gap: 8,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  optionText: {
    flex: 1,
    alignItems: 'flex-start',
  },
  optionTitle: {
    ...typography.button,
  },
  optionDetailInline: {
    ...typography.secondary,
  },
  optionDetail: {
    ...typography.secondary,
    marginTop: 2,
  },
  optionTag: {
    marginTop: 6,
    borderWidth: 1,
  },
});
