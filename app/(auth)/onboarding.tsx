// app/(auth)/onboarding.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// Import useAuth as default or from context depending on your export style:
import { useAuth } from '../../src/context/AuthContext';
// If useAuth is a named export from context instead, use:
// import { useAuth } from '../../src/context/AuthContext';
import { saveUserSettings } from "../../src/services/settingsService";
import {
  DEFAULT_USER_SETTINGS,
  UserGoal,
  UserSettings,
} from "../../src/types/settings";

const GOAL_OPTIONS: { id: UserGoal; title: string; subtitle: string }[] = [
  { id: "speed", title: "Speed", subtitle: "Solve calculations faster" },
  { id: "accuracy", title: "Accuracy", subtitle: "Minimize errors and slips" },
  {
    id: "mental_math",
    title: "Mental Math",
    subtitle: "Master arithmetic tricks",
  },
  {
    id: "consistency",
    title: "Consistency",
    subtitle: "Build a daily training habit",
  },
];

const QUESTION_OPTIONS = [
  { count: 5, label: "5", description: "Quick sprint" },
  { count: 10, label: "10", description: "Light session" },
  { count: 20, label: "20", description: "Standard workout (Recommended)" },
  { count: 30, label: "30", description: "Deep challenge" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoals, setSelectedGoals] = useState<UserGoal[]>([]);
  const [selectedCount, setSelectedCount] = useState<number>(20);
  const [loading, setLoading] = useState(false);

  const toggleGoal = (goal: UserGoal) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  };

  const handleFinish = async (isSkipping = false) => {
    if (!user) return;
    setLoading(true);

    const defaultGoalFallback: UserGoal[] = ["balanced"];

    const payload: Partial<UserSettings> = isSkipping
      ? {
          ...DEFAULT_USER_SETTINGS,
          has_completed_onboarding: true,
        }
      : {
          daily_question_goal: selectedCount,
          goals: selectedGoals.length > 0 ? selectedGoals : defaultGoalFallback,
          has_completed_onboarding: true,
        };

    const result = await saveUserSettings(user.id, payload);
    setLoading(false);

    if (result.success) {
      router.replace("/(app)");
    } else {
      Alert.alert(
        "Save Failed",
        "Could not save your preferences. Please try again.",
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, step >= 1 && styles.progressActive]}
          />
          <View
            style={[styles.progressBar, step >= 2 && styles.progressActive]}
          />
        </View>
        <TouchableOpacity onPress={() => handleFinish(true)} disabled={loading}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Screen 1: Goals */}
      {step === 1 && (
        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>What do you want to improve?</Text>
            <Text style={styles.subtitle}>
              Choose what you want NUMO to help you improve.
            </Text>
          </View>

          <View style={styles.cardGrid}>
            {GOAL_OPTIONS.map((item) => {
              const isSelected = selectedGoals.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => toggleGoal(item.id)}
                >
                  <Text
                    style={[
                      styles.cardTitle,
                      isSelected && styles.cardTitleSelected,
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      isSelected && styles.cardSubtitleSelected,
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setStep(2)}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Screen 2: Workout Size */}
      {step === 2 && (
        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              How many questions do you want to solve?
            </Text>
            <Text style={styles.subtitle}>
              Choose the size of your daily workout.
            </Text>
          </View>

          <View style={styles.listContainer}>
            {QUESTION_OPTIONS.map((item) => {
              const isSelected = selectedCount === item.count;
              return (
                <TouchableOpacity
                  key={item.count}
                  activeOpacity={0.8}
                  style={[
                    styles.countCard,
                    isSelected && styles.countCardSelected,
                  ]}
                  onPress={() => setSelectedCount(item.count)}
                >
                  <View style={styles.countBadge}>
                    <Text
                      style={[
                        styles.countBadgeText,
                        isSelected && styles.countBadgeTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <View style={styles.countTextWrapper}>
                    <Text
                      style={[
                        styles.countTitle,
                        isSelected && styles.countTitleSelected,
                      ]}
                    >
                      {item.count} questions
                    </Text>
                    <Text
                      style={[
                        styles.countDesc,
                        isSelected && styles.countDescSelected,
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={() => handleFinish(false)}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1C1C1E" />
            ) : (
              <Text style={styles.primaryButtonText}>Complete Setup</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E6E6E6",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  progressContainer: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    marginRight: 20,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(28, 28, 30, 0.1)",
  },
  progressActive: {
    backgroundColor: "#EC673C",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
    opacity: 0.6,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1C1C1E",
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#1C1C1E",
    opacity: 0.7,
    lineHeight: 20,
  },
  cardGrid: {
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: {
    borderColor: "#EC673C",
    backgroundColor: "#FFF5F2",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  cardTitleSelected: {
    color: "#EC673C",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#1C1C1E",
    opacity: 0.6,
  },
  cardSubtitleSelected: {
    opacity: 0.9,
  },
  listContainer: {
    gap: 12,
  },
  countCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  countCardSelected: {
    borderColor: "#EC673C",
    backgroundColor: "#FFF5F2",
  },
  countBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F6FE91",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  countBadgeText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1C1C1E",
  },
  countBadgeTextSelected: {
    color: "#EC673C",
  },
  countTextWrapper: {
    flex: 1,
  },
  countTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  countTitleSelected: {
    color: "#EC673C",
  },
  countDesc: {
    fontSize: 13,
    color: "#1C1C1E",
    opacity: 0.6,
    marginTop: 2,
  },
  countDescSelected: {
    opacity: 0.9,
  },
  primaryButton: {
    backgroundColor: "#EC673C",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
