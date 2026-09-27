import { useTheme } from "@/src/context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import NetInfo from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { OfflineNotice } from "../../src/components/OfflineNotice";
import { useAuth } from "../../src/context/AuthContext";
import {
  calculateActivitySummary,
  calculateProfileOverview,
  getTrainingGoals,
  saveTrainingGoals,
} from "../../src/services/profileService";
import {
  getUserProfile,
  getUserSettings,
  removeProfileAvatar,
  saveUserSettings,
  updateProfileName,
  uploadProfileAvatar,
} from "../../src/services/settingsService";
import {
  fetchAllWorkouts,
  WorkoutSessionRecord,
} from "../../src/services/workoutService";
import {
  ActivityTimeframe,
  DEFAULT_TRAINING_GOALS,
  UserTrainingGoals,
} from "../../src/types/profile";
import {
  formatDurationGoal,
  formatFrequencyGoal,
  formatQuestionGoal,
  formatRelativeSessionDate,
} from "../../src/utils/goalFormatters";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const PALETTE = {
  primary: "#BCE3AA", // Soft pastel sage
  accentLilac: "#F2CAEC", // Soft orchid
  backgroundLight: "#F1ECE9", // Warm neutral
  dark: "#0A0F0B", // Deep obsidian
  cardLight: "#FFFFFF",
  cardDark: "#141C15",
  borderLight: "rgba(10, 15, 11, 0.08)",
  borderDark: "rgba(255, 255, 255, 0.08)",
  textSubtleLight: "rgba(10, 15, 11, 0.55)",
  textSubtleDark: "rgba(241, 236, 233, 0.65)",
  danger: "#EB5757",
};

const QUESTION_OPTIONS = [5, 10, 20, 30, 50];
const DURATION_OPTIONS = [2, 5, 10];
const FREQUENCY_OPTIONS = [3, 5, 7];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { theme } = useTheme();

  const isDark = Boolean(theme?.isDark || (theme as any)?.mode === "dark");
  const userId = session?.user?.id;

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const primaryText = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const secondaryText = isDark
    ? PALETTE.textSubtleDark
    : PALETTE.textSubtleLight;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const pillBaseBg = isDark
    ? "rgba(255, 255, 255, 0.07)"
    : "rgba(10, 15, 11, 0.05)";
  const dividerColor = isDark
    ? "rgba(255, 255, 255, 0.07)"
    : "rgba(10, 15, 11, 0.06)";
  const accentGreen = PALETTE.primary;
  const accentLilac = PALETTE.accentLilac;

  const [loading, setLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Profile data
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [editNameVisible, setEditNameVisible] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  // Goals & Activity
  const [goals, setGoals] = useState<UserTrainingGoals>(DEFAULT_TRAINING_GOALS);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSessionRecord[]>([]);

  // Bottom Sheets
  const [activitySheetVisible, setActivitySheetVisible] =
    useState<boolean>(false);
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<ActivityTimeframe>("7D");
  const [goalSheetType, setGoalSheetType] = useState<
    "questions" | "duration" | "frequency" | null
  >(null);

  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Graceful fallback
    }
  };

  const openSheet = useCallback(() => {
    triggerHaptic();
    sheetAnim.setValue(SCREEN_HEIGHT);
    Animated.spring(sheetAnim, {
      toValue: 0,
      damping: 26,
      mass: 0.9,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(
    (onFinished?: () => void) => {
      Animated.timing(sheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        if (onFinished) onFinished();
      });
    },
    [sheetAnim],
  );

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const net = await NetInfo.fetch();
    if (net.isConnected === false || net.isInternetReachable === false) {
      setIsOffline(true);
      setLoading(false);
      return;
    }

    try {
      const [profileData, goalsData, userSettingsData, workoutsResult] =
        await Promise.all([
          getUserProfile(userId).catch(() => null),
          getTrainingGoals(userId).catch(() => DEFAULT_TRAINING_GOALS),
          getUserSettings(userId).catch(() => null),
          fetchAllWorkouts(userId).catch(() => []),
        ]);

      const name =
        profileData?.full_name || session?.user?.user_metadata?.full_name || "";
      const avatar =
        profileData?.avatar_url ||
        session?.user?.user_metadata?.avatar_url ||
        null;

      setFullName(name);
      setNameInput(name);
      setAvatarUrl(avatar);

      const mergedGoals: UserTrainingGoals = {
        ...goalsData,
        dailyQuestions: userSettingsData?.daily_question_goal
          ? Number(userSettingsData.daily_question_goal)
          : goalsData.dailyQuestions,
      };
      setGoals(mergedGoals);

      setAllWorkouts(Array.isArray(workoutsResult) ? workoutsResult : []);
      setIsOffline(false);
    } catch (err) {
      console.warn("Profile load warning:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Computations
  const overview = useMemo(() => {
    return calculateProfileOverview(allWorkouts);
  }, [allWorkouts]);

  const activitySummary = useMemo(() => {
    return calculateActivitySummary(allWorkouts, selectedTimeframe);
  }, [allWorkouts, selectedTimeframe]);

  // Mental Math Fluency Rank Calculation
  const mentalRank = useMemo(() => {
    const total = overview.lifetimeQuestions || 0;
    if (total >= 1000) {
      return { title: "Grandmaster", subtitle: "Instant Recall", icon: "flash" };
    }
    if (total >= 500) {
      return { title: "Mental Calculist", subtitle: "Rapid Arithmetic", icon: "sparkles" };
    }
    if (total >= 150) {
      return { title: "Practitioner", subtitle: "Building Fluency", icon: "bar-chart-outline" };
    }
    return { title: "Apprentice", subtitle: "Foundational Drills", icon: "school-outline" };
  }, [overview.lifetimeQuestions]);

  // Today's actual progress for the goal bars
  const todayProgress = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todaySessions = allWorkouts.filter((w) => {
      const dateStr = (w as any).completed_at || (w as any).completedAt;
      return dateStr && dateStr.slice(0, 10) === today;
    });

    const questionsToday = todaySessions.reduce((acc, s) => {
      return acc + ((s as any).total_questions ?? (s as any).totalQuestions ?? 0);
    }, 0);

    const now = new Date();
    const currentDay = (now.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekSessionDates = new Set(
      allWorkouts
        .filter((w) => {
          const d = (w as any).completed_at || (w as any).completedAt;
          return d && new Date(d) >= startOfWeek;
        })
        .map((w) => ((w as any).completed_at || (w as any).completedAt).slice(0, 10)),
    );

    return {
      questionsToday,
      daysTrainedThisWeek: weekSessionDates.size,
    };
  }, [allWorkouts]);

  // Avatar Management with Native Menu
  const processImagePickerResult = async (
    pickerPromise: Promise<ImagePicker.ImagePickerResult>,
  ) => {
    if (!userId) return;
    try {
      const result = await pickerPromise;
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.base64) {
          Alert.alert("Upload Error", "Could not process the selected image.");
          return;
        }

        setIsUploadingAvatar(true);
        const ext = asset.uri ? asset.uri.split(".").pop() || "jpg" : "jpg";
        const res = await uploadProfileAvatar(userId, asset.base64, ext);
        setIsUploadingAvatar(false);

        if (res.success && res.avatarUrl) {
          setAvatarUrl(res.avatarUrl);
        } else {
          Alert.alert("Upload Error", res.error || "Failed to upload photo.");
        }
      }
    } catch {
      setIsUploadingAvatar(false);
      Alert.alert("Error", "Could not complete image selection.");
    }
  };

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Please enable photo library access to choose your profile picture.",
      );
      return;
    }
    processImagePickerResult(
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      }),
    );
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Please enable camera access to take a profile picture.",
      );
      return;
    }
    processImagePickerResult(
      ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      }),
    );
  };

  const handleRemoveAvatar = async () => {
    if (!userId || !avatarUrl) return;
    setIsUploadingAvatar(true);
    const res = await removeProfileAvatar(userId);
    setIsUploadingAvatar(false);

    if (res.success) {
      setAvatarUrl(null);
    } else {
      Alert.alert("Error", res.error || "Failed to remove photo.");
    }
  };

  const handleAvatarPress = () => {
    if (isUploadingAvatar) return;
    triggerHaptic();

    if (Platform.OS === "ios") {
      const options = ["Take Photo", "Choose from Library"];
      if (avatarUrl) options.push("Remove Photo");
      options.push("Cancel");

      const destructiveButtonIndex = avatarUrl ? 2 : undefined;
      const cancelButtonIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
          title: "Profile Photo",
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleTakePhoto();
          else if (buttonIndex === 1) handlePickFromLibrary();
          else if (avatarUrl && buttonIndex === 2) handleRemoveAvatar();
        },
      );
    } else {
      const buttons: { text: string; onPress?: () => void; style?: any }[] = [
        { text: "Take Photo", onPress: handleTakePhoto },
        { text: "Choose from Library", onPress: handlePickFromLibrary },
      ];
      if (avatarUrl) {
        buttons.push({
          text: "Remove Photo",
          onPress: handleRemoveAvatar,
          style: "destructive",
        });
      }
      buttons.push({ text: "Cancel", style: "cancel" });
      Alert.alert("Profile Photo", "Select an option", buttons);
    }
  };

  const handleSaveName = async () => {
    if (!userId || !nameInput.trim()) return;
    setIsSavingName(true);
    const res = await updateProfileName(userId, nameInput.trim());
    setIsSavingName(false);

    if (res.success) {
      setFullName(nameInput.trim());
      setEditNameVisible(false);
    } else {
      Alert.alert("Error", res.error || "Could not update name.");
    }
  };

  const handleSelectGoalValue = async (
    key: "dailyQuestions" | "sessionDurationMinutes" | "weeklyFrequencyDays",
    val: number,
  ) => {
    triggerHaptic();
    const updated = { ...goals, [key]: val };
    setGoals(updated);
    closeSheet(() => setGoalSheetType(null));

    await saveTrainingGoals({ [key]: val }, userId);
    if (key === "dailyQuestions" && userId) {
      await saveUserSettings(userId, { daily_question_goal: val }).catch(
        () => {},
      );
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "N";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (isOffline) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: screenBg }]}
        edges={["top", "bottom"]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={screenBg}
        />
        <OfflineNotice onRetry={loadData} isRetrying={loading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: screenBg }]}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={screenBg}
      />

      {/* Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top > 0 ? 6 : 14, 10),
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: primaryText }]}>
          My profile
        </Text>
        <TouchableOpacity
          style={[
            styles.gearButton,
            { backgroundColor: cardBg, borderColor: borderSubtle },
          ]}
          activeOpacity={0.7}
          onPress={() => router.push("/(app)/settings")}
        >
          <Ionicons name="settings-outline" size={20} color={primaryText} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={accentGreen} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentWrapper}>
            {/* 1. Athlete Hero Card */}
            <View
              style={[
                styles.athleteHeroCard,
                { backgroundColor: cardBg, borderColor: borderSubtle },
              ]}
            >
              <View style={styles.athleteTopRow}>
                <TouchableOpacity
                  onPress={handleAvatarPress}
                  activeOpacity={0.8}
                  style={[styles.avatarCircle, { borderColor: accentGreen }]}
                  disabled={isUploadingAvatar}
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarFallback,
                        { backgroundColor: accentGreen },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarInitials,
                          { color: PALETTE.dark },
                        ]}
                      >
                        {getInitials(
                          fullName || session?.user?.email || "NUMO",
                        )}
                      </Text>
                    </View>
                  )}
                  {isUploadingAvatar ? (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.avatarMiniBadge,
                        { backgroundColor: accentGreen },
                      ]}
                    >
                      <Ionicons
                        name="camera"
                        size={12}
                        color={PALETTE.dark}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.heroDetailsCol}>
                  <TouchableOpacity
                    onPress={() => {
                      setNameInput(fullName);
                      setEditNameVisible(true);
                    }}
                    activeOpacity={0.7}
                    style={styles.nameRow}
                  >
                    <Text
                      style={[styles.displayName, { color: primaryText }]}
                      numberOfLines={1}
                    >
                      {fullName || "Add Name"}
                    </Text>
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={secondaryText}
                      style={{ marginLeft: 6 }}
                    />
                  </TouchableOpacity>

                  <Text
                    style={[styles.displayEmail, { color: secondaryText }]}
                    numberOfLines={1}
                  >
                    {session?.user?.email || "Daily Practitioner"}
                  </Text>

                  {/* Mental Math Fluency Rank Pill */}
                  <View
                    style={[
                      styles.tierBadgePill,
                      {
                        backgroundColor: isDark
                          ? "rgba(188, 227, 170, 0.12)"
                          : "rgba(37, 99, 30, 0.08)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={mentalRank.icon as any}
                      size={13}
                      color={accentGreen}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.tierBadgeText,
                        { color: isDark ? accentGreen : "#25631E" },
                      ]}
                    >
                      Rank: {mentalRank.title}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Sub-card Highlight Strip */}
              <View
                style={[
                  styles.cardDivider,
                  { backgroundColor: dividerColor },
                ]}
              />
              <View style={styles.heroHighlightsRow}>
                <View style={styles.heroStatItem}>
                  <Text
                    style={[styles.heroStatLabel, { color: secondaryText }]}
                  >
                    LIFETIME QUESTIONS
                  </Text>
                  <Text
                    style={[styles.heroStatValue, { color: primaryText }]}
                  >
                    {overview.lifetimeQuestions.toLocaleString()}
                  </Text>
                </View>

                <View
                  style={[
                    styles.heroStatSeparator,
                    { backgroundColor: dividerColor },
                  ]}
                />

                <View style={styles.heroStatItem}>
                  <Text
                    style={[styles.heroStatLabel, { color: secondaryText }]}
                  >
                    DRILLS COMPLETED
                  </Text>
                  <Text
                    style={[styles.heroStatValue, { color: primaryText }]}
                  >
                    {overview.lifetimeSessions}
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. Training Activity Card */}
            <View
              style={[
                styles.activityOverviewCard,
                { backgroundColor: cardBg, borderColor: borderSubtle },
              ]}
            >
              <View style={styles.activityCardHeader}>
                <Text
                  style={[
                    styles.activityCardHeading,
                    { color: primaryText },
                  ]}
                >
                  Training activity
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setActivitySheetVisible(true);
                    openSheet();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.seeActivityLink,
                      { color: isDark ? accentGreen : "#2B6327" },
                    ]}
                  >
                    See activity →
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.overviewMetricsRow}>
                <View style={styles.metricBlock}>
                  <Text style={[styles.metricLabel, { color: secondaryText }]}>
                    Today's questions
                  </Text>
                  <Text style={[styles.metricValue, { color: primaryText }]}>
                    {todayProgress.questionsToday}{" "}
                    <Text style={styles.metricUnit}>solved</Text>
                  </Text>
                </View>
                <View style={styles.metricBlock}>
                  <Text style={[styles.metricLabel, { color: secondaryText }]}>
                    Weekly active days
                  </Text>
                  <Text style={[styles.metricValue, { color: primaryText }]}>
                    {todayProgress.daysTrainedThisWeek}{" "}
                    <Text style={styles.metricUnit}>
                      / {goals.weeklyFrequencyDays}d
                    </Text>
                  </Text>
                </View>
              </View>

              {overview.latestWorkout && (
                <View
                  style={[
                    styles.lastSessionNote,
                    { borderTopColor: dividerColor },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={secondaryText}
                  />
                  <Text
                    style={[
                      styles.lastSessionText,
                      { color: secondaryText },
                    ]}
                    numberOfLines={1}
                  >
                    Last session:{" "}
                    <Text style={{ fontWeight: "700", color: primaryText }}>
                      {overview.latestWorkout.operation
                        .charAt(0)
                        .toUpperCase() +
                        overview.latestWorkout.operation.slice(1)}
                    </Text>
                    {" · "}
                    {overview.latestWorkout.totalQuestions}Q{" · "}
                    {formatRelativeSessionDate(
                      (overview.latestWorkout as any).completed_at ||
                        (overview.latestWorkout as any).completedAt,
                    )}
                  </Text>
                </View>
              )}
            </View>

            {/* 3. Training Goals Section */}
            <Text style={[styles.sectionHeading, { color: secondaryText }]}>
              TRAINING GOALS
            </Text>
            <View style={styles.goalsList}>
              {/* Daily Questions Goal */}
              <TouchableOpacity
                style={[
                  styles.goalItemCard,
                  { backgroundColor: cardBg, borderColor: borderSubtle },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setGoalSheetType("questions");
                  openSheet();
                }}
              >
                <View
                  style={[
                    styles.goalIconBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(188, 227, 170, 0.18)"
                        : "#EAF7E4",
                    },
                  ]}
                >
                  <Ionicons
                    name="sparkles"
                    size={18}
                    color={isDark ? accentGreen : "#25631E"}
                  />
                </View>
                <View style={styles.goalTextStack}>
                  <View style={styles.goalHeaderRow}>
                    <Text
                      style={[
                        styles.goalItemTitle,
                        { color: primaryText },
                      ]}
                    >
                      Daily questions
                    </Text>
                    <Text
                      style={[
                        styles.goalProgressLabel,
                        { color: secondaryText },
                      ]}
                    >
                      {todayProgress.questionsToday}/{goals.dailyQuestions}
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View
                    style={[
                      styles.progressBarTrack,
                      { backgroundColor: pillBaseBg },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: accentGreen,
                          width: `${Math.min(
                            (todayProgress.questionsToday /
                              goals.dailyQuestions) *
                              100,
                            100,
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <Text
                    style={[
                      styles.goalItemSubtitle,
                      { color: secondaryText },
                    ]}
                  >
                    {formatQuestionGoal(goals.dailyQuestions)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={secondaryText}
                />
              </TouchableOpacity>

              {/* Session Duration Goal */}
              <TouchableOpacity
                style={[
                  styles.goalItemCard,
                  { backgroundColor: cardBg, borderColor: borderSubtle },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setGoalSheetType("duration");
                  openSheet();
                }}
              >
                <View
                  style={[
                    styles.goalIconBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(242, 202, 236, 0.18)"
                        : "#FCEFF9",
                    },
                  ]}
                >
                  <Ionicons
                    name="timer-outline"
                    size={19}
                    color={isDark ? accentLilac : "#8C2B7E"}
                  />
                </View>
                <View style={styles.goalTextStack}>
                  <Text
                    style={[styles.goalItemTitle, { color: primaryText }]}
                  >
                    Session duration
                  </Text>
                  <Text
                    style={[
                      styles.goalItemSubtitle,
                      { color: secondaryText },
                    ]}
                  >
                    {formatDurationGoal(goals.sessionDurationMinutes)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={secondaryText}
                />
              </TouchableOpacity>

              {/* Weekly Frequency Goal */}
              <TouchableOpacity
                style={[
                  styles.goalItemCard,
                  { backgroundColor: cardBg, borderColor: borderSubtle },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  setGoalSheetType("frequency");
                  openSheet();
                }}
              >
                <View
                  style={[
                    styles.goalIconBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(188, 227, 170, 0.18)"
                        : "#EAF7E4",
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={isDark ? accentGreen : "#25631E"}
                  />
                </View>
                <View style={styles.goalTextStack}>
                  <View style={styles.goalHeaderRow}>
                    <Text
                      style={[
                        styles.goalItemTitle,
                        { color: primaryText },
                      ]}
                    >
                      Weekly training
                    </Text>
                    <Text
                      style={[
                        styles.goalProgressLabel,
                        { color: secondaryText },
                      ]}
                    >
                      {todayProgress.daysTrainedThisWeek}/
                      {goals.weeklyFrequencyDays}d
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View
                    style={[
                      styles.progressBarTrack,
                      { backgroundColor: pillBaseBg },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: accentGreen,
                          width: `${Math.min(
                            (todayProgress.daysTrainedThisWeek /
                              goals.weeklyFrequencyDays) *
                              100,
                            100,
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <Text
                    style={[
                      styles.goalItemSubtitle,
                      { color: secondaryText },
                    ]}
                  >
                    {formatFrequencyGoal(goals.weeklyFrequencyDays)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={secondaryText}
                />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Activity Bottom Sheet with Full Scrolling */}
      <Modal visible={activitySheetVisible} transparent animationType="none">
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetDismissArea}
            activeOpacity={1}
            onPress={() => closeSheet(() => setActivitySheetVisible(false))}
          />

          <Animated.View
            style={[
              styles.activitySheetContainer,
              {
                backgroundColor: cardBg,
                borderColor: borderSubtle,
                transform: [{ translateY: sheetAnim }],
                paddingBottom: Math.max(insets.bottom, 20) + 12,
              },
            ]}
          >
            {/* Top Grab Handle */}
            <View style={styles.handleContainer}>
              <View
                style={[styles.grabHandle, { backgroundColor: secondaryText }]}
              />
            </View>

            {/* Header */}
            <View style={styles.sheetTopRow}>
              <Text style={[styles.sheetMainTitle, { color: primaryText }]}>
                Training activity
              </Text>
              <TouchableOpacity
                onPress={() => closeSheet(() => setActivitySheetVisible(false))}
                style={[styles.sheetCloseIcon, { backgroundColor: pillBaseBg }]}
              >
                <Ionicons name="close" size={18} color={primaryText} />
              </TouchableOpacity>
            </View>

            {/* Timeframe Selector */}
            <View
              style={[
                styles.timeframeSegment,
                { backgroundColor: pillBaseBg },
              ]}
            >
              {(["7D", "30D", "3M"] as ActivityTimeframe[]).map((tf) => {
                const isSelected = selectedTimeframe === tf;
                return (
                  <TouchableOpacity
                    key={tf}
                    style={[
                      styles.timeframePill,
                      isSelected && { backgroundColor: accentGreen },
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedTimeframe(tf);
                    }}
                  >
                    <Text
                      style={[
                        styles.timeframeText,
                        { color: primaryText },
                        isSelected && {
                          color: PALETTE.dark,
                          fontWeight: "800",
                        },
                      ]}
                    >
                      {tf}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Scrollable Sessions Container */}
            <View style={styles.scrollWrapper}>
              <ScrollView
                style={styles.activityScrollArea}
                contentContainerStyle={styles.activityScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                bounces={true}
              >
                <Text
                  style={[
                    styles.recentSessionsHeader,
                    { color: secondaryText },
                  ]}
                >
                  SESSIONS IN TIMEFRAME ({activitySummary.recentSessions.length})
                </Text>

                {activitySummary.recentSessions.length === 0 ? (
                  <View style={styles.emptySessionBox}>
                    <Text
                      style={[styles.emptySessionText, { color: secondaryText }]}
                    >
                      No sessions recorded in this timeframe.
                    </Text>
                  </View>
                ) : (
                  activitySummary.recentSessions.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.sessionItemRow,
                        { borderBottomColor: dividerColor },
                      ]}
                    >
                      <View style={styles.sessionLeftStack}>
                        <Text
                          style={[
                            styles.sessionOpTitle,
                            { color: primaryText },
                          ]}
                        >
                          {item.operation.charAt(0).toUpperCase() +
                            item.operation.slice(1)}
                        </Text>
                        <Text
                          style={[
                            styles.sessionDetailSub,
                            { color: secondaryText },
                          ]}
                        >
                          {(item as any).total_questions ??
                            (item as any).totalQuestions}{" "}
                          questions ·{" "}
                          {formatRelativeSessionDate(
                            (item as any).completed_at ||
                              (item as any).completedAt,
                          )}
                        </Text>
                      </View>
                      <View style={styles.sessionRightPill}>
                        <Text
                          style={[
                            styles.sessionAccuracyText,
                            { color: isDark ? accentGreen : "#25631E" },
                          ]}
                        >
                          {item.accuracy}%
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[
                styles.viewStatsCtaBtn,
                { backgroundColor: accentGreen },
              ]}
              onPress={() => {
                closeSheet(() => {
                  setActivitySheetVisible(false);
                  router.push("/(app)/statistics");
                });
              }}
            >
              <Text style={styles.viewStatsCtaText}>
                View Full Statistics →
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Goal Selector Bottom Sheet */}
      <Modal visible={goalSheetType !== null} transparent animationType="none">
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetDismissArea}
            activeOpacity={1}
            onPress={() => closeSheet(() => setGoalSheetType(null))}
          />

          <Animated.View
            style={[
              styles.goalSheetContainer,
              {
                backgroundColor: cardBg,
                borderColor: borderSubtle,
                transform: [{ translateY: sheetAnim }],
                paddingBottom: Math.max(insets.bottom, 20) + 16,
              },
            ]}
          >
            <View style={styles.handleContainer}>
              <View
                style={[styles.grabHandle, { backgroundColor: secondaryText }]}
              />
            </View>

            <Text
              style={[
                styles.sheetMainTitle,
                { color: primaryText, marginBottom: 4 },
              ]}
            >
              {goalSheetType === "questions" && "Daily question goal"}
              {goalSheetType === "duration" && "Session duration"}
              {goalSheetType === "frequency" && "Weekly training"}
            </Text>

            <Text style={[styles.sheetDescSubtitle, { color: secondaryText }]}>
              {goalSheetType === "questions" &&
                "How many arithmetic drills do you aim to complete each day?"}
              {goalSheetType === "duration" &&
                "Target duration for your daily calculation sessions."}
              {goalSheetType === "frequency" &&
                "How many days per week do you want to train your recall?"}
            </Text>

            <View style={styles.goalPillsWrapper}>
              {goalSheetType === "questions" &&
                QUESTION_OPTIONS.map((q) => {
                  const isSelected = goals.dailyQuestions === q;
                  return (
                    <TouchableOpacity
                      key={q}
                      style={[
                        styles.goalOptionRow,
                        { backgroundColor: pillBaseBg },
                        isSelected && {
                          borderColor: accentGreen,
                          borderWidth: 1.5,
                        },
                      ]}
                      onPress={() => handleSelectGoalValue("dailyQuestions", q)}
                    >
                      <Text
                        style={[styles.goalOptionText, { color: primaryText }]}
                      >
                        {q} questions
                      </Text>
                      <Ionicons
                        name={
                          isSelected ? "radio-button-on" : "radio-button-off"
                        }
                        size={20}
                        color={isSelected ? accentGreen : secondaryText}
                      />
                    </TouchableOpacity>
                  );
                })}

              {goalSheetType === "duration" &&
                DURATION_OPTIONS.map((m) => {
                  const isSelected = goals.sessionDurationMinutes === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.goalOptionRow,
                        { backgroundColor: pillBaseBg },
                        isSelected && {
                          borderColor: accentGreen,
                          borderWidth: 1.5,
                        },
                      ]}
                      onPress={() =>
                        handleSelectGoalValue("sessionDurationMinutes", m)
                      }
                    >
                      <Text
                        style={[styles.goalOptionText, { color: primaryText }]}
                      >
                        {m} minutes
                      </Text>
                      <Ionicons
                        name={
                          isSelected ? "radio-button-on" : "radio-button-off"
                        }
                        size={20}
                        color={isSelected ? accentGreen : secondaryText}
                      />
                    </TouchableOpacity>
                  );
                })}

              {goalSheetType === "frequency" &&
                FREQUENCY_OPTIONS.map((d) => {
                  const isSelected = goals.weeklyFrequencyDays === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.goalOptionRow,
                        { backgroundColor: pillBaseBg },
                        isSelected && {
                          borderColor: accentGreen,
                          borderWidth: 1.5,
                        },
                      ]}
                      onPress={() =>
                        handleSelectGoalValue("weeklyFrequencyDays", d)
                      }
                    >
                      <Text
                        style={[styles.goalOptionText, { color: primaryText }]}
                      >
                        {d === 7 ? "Every day" : `${d} days / week`}
                      </Text>
                      <Ionicons
                        name={
                          isSelected ? "radio-button-on" : "radio-button-off"
                        }
                        size={20}
                        color={isSelected ? accentGreen : secondaryText}
                      />
                    </TouchableOpacity>
                  );
                })}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Edit Name Modal */}
      <Modal visible={editNameVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalBox,
              { backgroundColor: cardBg, borderColor: borderSubtle },
            ]}
          >
            <Text style={[styles.modalHeading, { color: primaryText }]}>
              Edit Name
            </Text>
            <Text style={[styles.modalSubheading, { color: secondaryText }]}>
              Enter how you want your coach to greet you.
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Full Name"
              placeholderTextColor={secondaryText}
              style={[
                styles.modalInput,
                { backgroundColor: pillBaseBg, color: primaryText },
              ]}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: pillBaseBg }]}
                onPress={() => setEditNameVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: primaryText }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: accentGreen }]}
                onPress={handleSaveName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color={PALETTE.dark} />
                ) : (
                  <Text
                    style={[
                      styles.modalBtnText,
                      { color: PALETTE.dark, fontWeight: "800" },
                    ]}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBar: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  gearButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },
  scrollContent: {
    paddingTop: 8,
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 16,
  },
  // Athlete Identity Card
  athleteHeroCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  athleteTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "900",
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMiniBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0A0F0B",
  },
  heroDetailsCol: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  displayEmail: {
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 2,
  },
  tierBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  tierBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cardDivider: {
    height: 1,
    marginVertical: 14,
  },
  heroHighlightsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  heroStatItem: {
    alignItems: "center",
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  heroStatSeparator: {
    width: 1,
    height: 24,
  },
  // Training Activity Card
  activityOverviewCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  activityCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  activityCardHeading: {
    fontSize: 16,
    fontWeight: "800",
  },
  seeActivityLink: {
    fontSize: 13,
    fontWeight: "700",
  },
  overviewMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricBlock: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  metricUnit: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  lastSessionNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  lastSessionText: {
    fontSize: 12.5,
    fontWeight: "500",
    flex: 1,
  },
  // Goals Section
  sectionHeading: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginLeft: 4,
    marginBottom: -6,
  },
  goalsList: {
    gap: 10,
  },
  goalItemCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  goalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  goalTextStack: {
    flex: 1,
    marginRight: 10,
  },
  goalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  goalProgressLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginVertical: 6,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  goalItemSubtitle: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  // Bottom Sheet Base
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheetDismissArea: {
    flex: 1,
  },
  activitySheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    height: SCREEN_HEIGHT * 0.78,
  },
  goalSheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetMainTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  sheetDescSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  sheetCloseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timeframeSegment: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  timeframePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timeframeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  recentSessionsHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  // Scrollable container for activity sheet
  scrollWrapper: {
    flex: 1,
    marginBottom: 12,
  },
  activityScrollArea: {
    flex: 1,
  },
  activityScrollContent: {
    paddingBottom: 16,
  },
  sessionItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sessionLeftStack: {
    flex: 1,
  },
  sessionOpTitle: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  sessionDetailSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sessionRightPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sessionAccuracyText: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptySessionBox: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySessionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  viewStatsCtaBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  viewStatsCtaText: {
    color: "#0A0F0B",
    fontSize: 14,
    fontWeight: "800",
  },
  goalPillsWrapper: {
    gap: 8,
    marginBottom: 12,
  },
  goalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  goalOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },
  // Modal Edit
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  modalSubheading: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});