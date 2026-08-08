import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CORE_PROGRAMS, FUTURE_PROGRAMS } from '../../../src/data/trainingPrograms';
import { ProgramCard } from '../../../src/components/ProgramCard';
import { GlassCard } from '../../../src/components/GlassCard';

export default function TrainingSelectionScreen() {
  const router = useRouter();
  const [showOthers, setShowOthers] = useState(false);

  const handleSelectProgram = (programId: string) => {
    // Navigate to the workout screen with the chosen operation mode
    router.push({
      pathname: '/workout',
      params: { mode: programId },
    });
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
        {/* Hero Quick Start Banner */}
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
                <Text style={styles.quickStartSubtitle}>Adaptive mix</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Section: Core Operations */}
        <Text style={styles.sectionLabel}>Core operations</Text>
        <View style={styles.groupedCard}>
          {CORE_PROGRAMS.map((program, index) => (
            <ProgramCard
              key={program.id}
              program={program}
              onPress={() => handleSelectProgram(program.id)}
              showDivider={index < CORE_PROGRAMS.length - 1}
            />
          ))}
        </View>

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
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
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
});