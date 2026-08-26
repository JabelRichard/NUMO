import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { saveUserSettings } from "../../src/services/settingsService";
import {
  DEFAULT_USER_SETTINGS,
  UserGoal,
  UserSettings,
} from "../../src/types/settings";
import { useTheme } from "@/src/context/ThemeContext";

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
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { theme } = useTheme();
  const { user } = useAuth();

  const isCompact = height < 720;
  const isNarrow = width < 360;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoals, setSelectedGoals] = useState<UserGoal[]>([]);
  const [selectedCount, setSelectedCount] = useState<number>(20);
  const [loading, setLoading] = useState(false);

  const toggleGoal = (goal: UserGoal) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
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
        "Could not save your preferences. Please try again."
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isNarrow ? 18 : 24,
            paddingTop: Math.max(insets.top > 0 ? 8 : 16, 12),
            paddingBottom: Math.max(insets.bottom + 12, 16),
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.innerWrapper}>
          {/* Header */}
          <View style={[styles.header, isCompact && styles.headerCompact]}>
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(28, 28, 30, 0.1)" },
                  step >= 1 && { backgroundColor: theme.primary },
                ]}
              />
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(28, 28, 30, 0.1)" },
                  step >= 2 && { backgroundColor: theme.primary },
                ]}
              />
            </View>
            <TouchableOpacity onPress={() => handleFinish(true)} disabled={loading}>
              <Text style={[styles.skipText, { color: theme.text }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Screen 1: Goals */}
          {step === 1 && (
            <View style={styles.content}>
              <View style={[styles.titleSection, isCompact && styles.titleSectionCompact]}>
                <Text style={[styles.title, { color: theme.text }, isCompact && styles.titleCompact]}>
                  What do you want to improve?
                </Text>
                <Text style={[styles.subtitle, { color: theme.subtext }, isCompact && styles.subtitleCompact]}>
                  Choose what you want NUMO to help you improve.
                </Text>
              </View>

              <View style={[styles.cardGrid, isCompact && styles.cardGridCompact]}>
                {GOAL_OPTIONS.map((item) => {
                  const isSelected = selectedGoals.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      style={[
                        styles.card,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        isCompact && styles.cardCompact,
                        isSelected && {
                          borderColor: theme.primary,
                          backgroundColor: theme.isDark ? "rgba(238, 88, 57, 0.18)" : "#FFF5F2",
                        },
                      ]}
                      onPress={() => toggleGoal(item.id)}
                    >
                      <Text
                        style={[
                          styles.cardTitle,
                          { color: theme.text },
                          isCompact && styles.cardTitleCompact,
                          isSelected && { color: theme.primary },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.cardSubtitle,
                          { color: theme.subtext },
                          isCompact && styles.cardSubtitleCompact,
                          isSelected && { color: theme.isDark ? theme.text : theme.primary, opacity: 0.9 },
                        ]}
                      >
                        {item.subtitle}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.primary, shadowColor: theme.primary },
                  isCompact && styles.primaryButtonCompact,
                ]}
                onPress={() => setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Screen 2: Workout Size */}
          {step === 2 && (
            <View style={styles.content}>
              <View style={[styles.titleSection, isCompact && styles.titleSectionCompact]}>
                <Text style={[styles.title, { color: theme.text }, isCompact && styles.titleCompact]}>
                  How many questions do you want to solve?
                </Text>
                <Text style={[styles.subtitle, { color: theme.subtext }, isCompact && styles.subtitleCompact]}>
                  Choose the size of your daily workout.
                </Text>
              </View>

              <View style={[styles.listContainer, isCompact && styles.listContainerCompact]}>
                {QUESTION_OPTIONS.map((item) => {
                  const isSelected = selectedCount === item.count;
                  return (
                    <TouchableOpacity
                      key={item.count}
                      activeOpacity={0.8}
                      style={[
                        styles.countCard,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        isCompact && styles.countCardCompact,
                        isSelected && {
                          borderColor: theme.primary,
                          backgroundColor: theme.isDark ? "rgba(238, 88, 57, 0.18)" : "#FFF5F2",
                        },
                      ]}
                      onPress={() => setSelectedCount(item.count)}
                    >
                      <View
                        style={[
                          styles.countBadge,
                          { backgroundColor: theme.accentYellow },
                          isCompact && styles.countBadgeCompact,
                        ]}
                      >
                        <Text
                          style={[
                            styles.countBadgeText,
                            isSelected && { color: theme.primary },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                      <View style={styles.countTextWrapper}>
                        <Text
                          style={[
                            styles.countTitle,
                            { color: theme.text },
                            isCompact && styles.countTitleCompact,
                            isSelected && { color: theme.primary },
                          ]}
                        >
                          {item.count} questions
                        </Text>
                        <Text
                          style={[
                            styles.countDesc,
                            { color: theme.subtext },
                            isCompact && styles.countDescCompact,
                            isSelected && { color: theme.isDark ? theme.text : theme.primary, opacity: 0.9 },
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
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.primary, shadowColor: theme.primary },
                  isCompact && styles.primaryButtonCompact,
                  loading && styles.buttonDisabled,
                ]}
                onPress={() => handleFinish(false)}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Complete Setup</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E6E6E6",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  innerWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerCompact: {
    marginBottom: 12,
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
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1C1E",
    opacity: 0.6,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
  },
  titleSection: {
    marginBottom: 18,
  },
  titleSectionCompact: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1C1C1E",
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  titleCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 14,
    color: "#1C1C1E",
    opacity: 0.7,
    lineHeight: 19,
  },
  subtitleCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardGrid: {
    gap: 10,
    marginBottom: 20,
  },
  cardGridCompact: {
    gap: 8,
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardCompact: {
    padding: 10,
    borderRadius: 14,
  },
  cardSelected: {
    borderColor: "#EC673C",
    backgroundColor: "#FFF5F2",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  cardTitleCompact: {
    fontSize: 15,
  },
  cardTitleSelected: {
    color: "#EC673C",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#1C1C1E",
    opacity: 0.6,
  },
  cardSubtitleCompact: {
    fontSize: 11,
  },
  cardSubtitleSelected: {
    opacity: 0.9,
  },
  listContainer: {
    gap: 10,
    marginBottom: 20,
  },
  listContainerCompact: {
    gap: 8,
    marginBottom: 14,
  },
  countCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  countCardCompact: {
    padding: 8,
    borderRadius: 14,
  },
  countCardSelected: {
    borderColor: "#EC673C",
    backgroundColor: "#FFF5F2",
  },
  countBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F6FE91",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  countBadgeCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 10,
  },
  countBadgeText: {
    fontSize: 16,
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
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  countTitleCompact: {
    fontSize: 14,
  },
  countTitleSelected: {
    color: "#EC673C",
  },
  countDesc: {
    fontSize: 12,
    color: "#1C1C1E",
    opacity: 0.6,
    marginTop: 1,
  },
  countDescCompact: {
    fontSize: 11,
  },
  countDescSelected: {
    opacity: 0.9,
  },
  primaryButton: {
    backgroundColor: "#EC673C",
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    shadowColor: "#EC673C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonCompact: {
    minHeight: 46,
    paddingVertical: 11,
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