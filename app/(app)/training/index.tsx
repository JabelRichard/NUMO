import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CORE_PROGRAMS, FUTURE_PROGRAMS } from '../../../src/data/trainingPrograms';
import { ProgramCard } from '../../../src/components/ProgramCard';
import { GlassCard } from '../../../src/components/GlassCard';

type Difficulty = 'easy' | 'medium' | 'hard';

export default function TrainingSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; difficulty?: Difficulty }>();
  const [showOthers, setShowOthers] = useState(false);

  // Auto-redirect if launched directly in demo mode from the Welcome screen
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

  // Map storing chosen difficulty per program ID (defaults to 'easy')
  const [difficulties, setDifficulties] = useState<Record<string, Difficulty>>({});

  // State for active dropdown modal picker
  const [activePickerId, setActivePickerId] = useState<string | null>(null);

  const getDifficulty = (id: string): Difficulty => difficulties[id] || 'easy';

  const setProgramDifficulty = (id: string, level: Difficulty) => {
    setDifficulties((prev) => ({ ...prev, [id]: level }));
    setActivePickerId(null);
  };

  const handleSelectProgram = (programId: string) => {
    const selectedDifficulty = getDifficulty(programId);
    router.push({
      pathname: '/workout' as any,
      params: { mode: programId, difficulty: selectedDifficulty },
    });
  };

  const getDifficultyLabel = (diff: Difficulty): string => {
    switch (diff) {
      case 'easy':
        return 'Easy';
      case 'medium':
        return 'Medium';
      case 'hard':
        return 'Hard';
      default:
        return 'Easy';
    }
  };

  // Color theme per difficulty option
  const getDifficultyTheme = (diff: Difficulty) => {
    switch (diff) {
      case 'easy':
        return {
          color: '#4CAF50',
          bg: 'rgba(76, 175, 80, 0.15)',
          border: 'rgba(76, 175, 80, 0.3)',
        };
      case 'medium':
        return {
          color: '#EC673C',
          bg: 'rgba(236, 103, 60, 0.15)',
          border: 'rgba(236, 103, 60, 0.3)',
        };
      case 'hard':
        return {
          color: '#EE5839',
          bg: 'rgba(238, 88, 57, 0.18)',
          border: 'rgba(238, 88, 57, 0.35)',
        };
    }
  };

  // Maps operation IDs to original colors and icons
  const getOperationConfig = (id: string) => {
    switch (id.toLowerCase()) {
      case 'addition':
        return { icon: 'add' as const, color: '#AFA2FE' };
      case 'subtraction':
        return { icon: 'remove' as const, color: '#EC673C' };
      case 'multiplication':
        return { icon: 'close' as const, color: '#F6FE91' };
      case 'division':
        return { icon: 'stats-chart' as const, color: '#4CAF50' };
      case 'adaptive_mix':
      case 'mixed':
        return { icon: 'sparkles' as const, color: '#EE5839' };
      default:
        return { icon: 'flash' as const, color: '#1C1C1E' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#1C1C1E" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Workout</Text>
          <Text style={styles.headerSubtitle}>Choose an operation</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Start Banner */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleSelectProgram('adaptive_mix')}
        >
          <View style={styles.quickStartBanner}>
            <View style={styles.quickStartLeft}>
              <View style={styles.quickStartIconRing}>
                <Ionicons name="sparkles" size={22} color="#FFF" />
              </View>
              <View>
                <Text style={styles.quickStartTitle}>Quick Start</Text>
                <Text style={styles.quickStartSubtitle}>
                  Adaptive mix • {getDifficultyLabel(getDifficulty('adaptive_mix'))}
                </Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Section: Core Operations inside Glass Card */}
        <Text style={styles.sectionLabel}>Core operations</Text>
        <GlassCard style={styles.groupedGlassCard} intensity={45}>
          {CORE_PROGRAMS.map((program, index) => {
            const currentDiff = getDifficulty(program.id);
            const diffTheme = getDifficultyTheme(currentDiff);
            const opConfig = getOperationConfig(program.id);
            const descriptionText =
              (program as any).subtitle || (program as any).description || '';

            return (
              <React.Fragment key={program.id}>
                <View style={styles.programCardRow}>
                  {/* Left Main Area: Tap to Start Workout */}
                  <TouchableOpacity
                    style={styles.programInfoLeft}
                    activeOpacity={0.7}
                    onPress={() => handleSelectProgram(program.id)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: opConfig.color }]}>
                      <Ionicons
                        name={opConfig.icon}
                        size={20}
                        color={program.id === 'multiplication' ? '#1C1C1E' : '#FFFFFF'}
                      />
                    </View>
                    <View style={styles.textStack}>
                      <Text style={styles.programTitle}>{program.title}</Text>
                      {descriptionText ? (
                        <Text style={styles.programSubtitle}>{descriptionText}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {/* Right Area: Colored Difficulty Pill */}
                  <TouchableOpacity
                    style={[
                      styles.dropdownButton,
                      {
                        backgroundColor: diffTheme.bg,
                        borderColor: diffTheme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setActivePickerId(program.id)}
                  >
                    <Text style={[styles.dropdownButtonText, { color: diffTheme.color }]}>
                      {getDifficultyLabel(currentDiff)}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={diffTheme.color} />
                  </TouchableOpacity>
                </View>

                {index < CORE_PROGRAMS.length - 1 && <View style={styles.cardDivider} />}
              </React.Fragment>
            );
          })}
        </GlassCard>

        {/* Section: Future Programs Accordion */}
        <GlassCard style={styles.othersHeaderCard} intensity={40}>
          <TouchableOpacity
            style={styles.othersTouchable}
            activeOpacity={0.7}
            onPress={() => setShowOthers(!showOthers)}
          >
            <View style={styles.othersTextGroup}>
              <Text style={styles.othersTitle}>Other programs</Text>
              <Text style={styles.othersSubtitle}>
                Speed Challenge, AI Coach & more
              </Text>
            </View>
            <View style={styles.othersChevronCircle}>
              <Ionicons
                name={showOthers ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#1C1C1E"
              />
            </View>
          </TouchableOpacity>

          {/* Expandable Future Modules List */}
          {showOthers ? (
            <View style={styles.futureList}>
              <View style={styles.divider} />
              {FUTURE_PROGRAMS.map((program, index) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  showDivider={index < FUTURE_PROGRAMS.length - 1}
                />
              ))}
            </View>
          ) : null}
        </GlassCard>
      </ScrollView>

      {/* Glassmorphic Modal Picker */}
      <Modal
        visible={activePickerId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePickerId(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePickerId(null)}
        >
          <GlassCard style={styles.glassModalMenu} intensity={70}>
            <Text style={styles.modalHeaderTitle}>Select Difficulty</Text>

            {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => {
              const isSelected = activePickerId
                ? getDifficulty(activePickerId) === level
                : false;
              const levelTheme = getDifficultyTheme(level);

              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.modalMenuItem,
                    {
                      backgroundColor: isSelected ? levelTheme.bg : 'transparent',
                      borderColor: isSelected ? levelTheme.border : 'transparent',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (activePickerId) {
                      setProgramDifficulty(activePickerId, level);
                    }
                  }}
                >
                  <View style={styles.modalItemLabelRow}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: levelTheme.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.modalMenuItemText,
                        {
                          color: isSelected ? levelTheme.color : '#1C1C1E',
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {getDifficultyLabel(level)}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color={levelTheme.color} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </GlassCard>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E6E6E6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  quickStartBanner: {
    backgroundColor: '#EC673C',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: '#EC673C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  quickStartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  quickStartIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickStartSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 10,
    marginLeft: 4,
  },
  groupedGlassCard: {
    borderRadius: 24,
    paddingVertical: 4,
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  programCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  programInfoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textStack: {
    flex: 1,
  },
  programTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  programSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  dropdownButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  othersHeaderCard: {
    borderRadius: 24,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  othersSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  othersChevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  futureList: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  glassModalMenu: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 24,
    padding: 16,
  },
  modalHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
  },
  modalItemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalMenuItemText: {
    fontSize: 15,
  },
});