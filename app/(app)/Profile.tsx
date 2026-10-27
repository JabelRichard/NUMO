import { useTheme } from "@/src/context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ReactNode,
  useCallback,
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
import { PALETTE } from "../../src/constants/palette";
import {
  COMFORT_LEVELS,
  GOALS,
  IoniconName,
  NOT_SURE_OPTION,
  WEAK_SPOTS,
} from "../../src/constants/planOptions";
import {
  FONT_FAMILY,
  inputTypography,
  typography,
} from "../../src/constants/typography";
import { useOnlineStatus } from "../../src/hooks/useOnlineStatus";
import { getInitials } from "../../src/utils/getInitials";
import { useAuth } from "../../src/context/AuthContext";
import {
  calculateActivitySummary,
  calculateProfileOverview,
  getTrainingGoals,
  saveTrainingGoals,
} from "../../src/services/profileService";
import {
  getUserProfile,
  removeProfileAvatar,
  updateProfileName,
  uploadProfileAvatar,
} from "../../src/services/settingsService";
import {
  fetchAllWorkouts,
  WorkoutSessionRecord,
} from "../../src/services/workoutService";
import {
  ComfortLevel,
  DEFAULT_TRAINING_GOALS,
  FrictionArea,
  UserTrainingGoals,
} from "../../src/types/profile";
import {
  formatDurationGoal,
  formatFrequencyGoal,
  formatOperationName,
  formatRelativeSessionDate,
} from "../../src/utils/goalFormatters";
import {
  countDayStreak,
  localDayKey,
  startOfLocalWeek,
} from "../../src/utils/localDates";
import {
  DURATION_MINUTE_OPTIONS,
  FREQUENCY_DAY_OPTIONS,
  OnboardingPrimaryGoal,
  questionsForDuration,
} from "../../src/utils/onboardingDraft";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const NAME_MAX_LENGTH = 40;
const NOT_SET = "Not set";

// Lifetime-question thresholds for each rank, lowest first.
const RANKS: { min: number; title: string; icon: IoniconName }[] = [
  { min: 0, title: "Apprentice", icon: "school-outline" },
  { min: 150, title: "Practitioner", icon: "bar-chart-outline" },
  { min: 500, title: "Mental Calculist", icon: "sparkles" },
  { min: 1000, title: "Grandmaster", icon: "flash" },
];

type SheetType = "duration" | "frequency" | "focus" | "workingOn" | "level";

const SHEET_COPY: Record<SheetType, { title: string; subtitle: string }> = {
  duration: {
    title: "Time per day",
    subtitle: "How long do you want to practice each day?",
  },
  frequency: {
    title: "Days per week",
    subtitle: "How many days a week do you want to practice?",
  },
  // Same questions as onboarding.
  focus: {
    title: "What do you want to get better at?",
    subtitle: "Pick your goal. We'll tailor your workouts around it.",
  },
  workingOn: {
    title: "What's hardest for you?",
    subtitle: "Pick as many as you like.",
  },
  level: {
    title: "How comfortable are you with math?",
    subtitle: "We'll pick a starting level that suits you.",
  },
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { theme } = useTheme();

  const isDark = theme.isDark;
  const userId = session?.user?.id;

  const screenBg = isDark ? PALETTE.dark : PALETTE.backgroundLight;
  const cardBg = isDark ? PALETTE.cardDark : PALETTE.cardLight;
  const primaryText = isDark ? PALETTE.backgroundLight : PALETTE.dark;
  const secondaryText = isDark
    ? PALETTE.textSubtleDark
    : PALETTE.textSecondaryLight;
  const borderSubtle = isDark ? PALETTE.borderDark : PALETTE.borderLight;
  const fillBg = isDark ? PALETTE.fillDark : PALETTE.fillLight;
  // One sage accent, same as Home, Workout, Settings and Onboarding.
  // `accent` fills buttons; `accentStrong` (deep sage in light mode) colors icons,
  // progress bars, accent text and selected borders so they stay readable.
  const accent = theme.primary;
  const accentStrong = theme.primaryText;
  const accentSoft = theme.primarySoft;
  const onAccent = theme.onPrimary;

  const [loading, setLoading] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const loadDataRef = useRef<() => Promise<void>>(async () => {});
  const { isOffline, recheck } = useOnlineStatus(() => {
    loadDataRef.current();
  });

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
  const [sheetType, setSheetType] = useState<SheetType | null>(null);
  // Unsaved picks in the multi-select "Working on" sheet.
  const [draftAreas, setDraftAreas] = useState<FrictionArea[]>([]);
  const [draftUnsure, setDraftUnsure] = useState<boolean>(false);

  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const editNameVisibleRef = useRef(false);
  editNameVisibleRef.current = editNameVisible;

  // Primitive deps so a token refresh (new session object) doesn't re-run loadData.
  const metaFullName: string | undefined = session?.user?.user_metadata?.full_name;
  const metaAvatarUrl: string | undefined = session?.user?.user_metadata?.avatar_url;

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

    // Offline: keep whatever is already on screen; the banner or OfflineNotice takes over.
    if (!(await recheck())) {
      setLoading(false);
      return;
    }

    try {
      const [profileData, goalsData, workoutsResult] = await Promise.all([
        getUserProfile(userId).catch(() => null),
        // Reads Supabase; falls back to the phone copy on its own if that fails.
        getTrainingGoals(userId).catch(() => null),
        fetchAllWorkouts(userId).catch(() => null),
      ]);

      const name = profileData?.full_name || metaFullName || "";
      const avatar = profileData?.avatar_url || metaAvatarUrl || null;

      setFullName(name);
      // Don't stomp on what the user is typing in the edit-name sheet.
      if (!editNameVisibleRef.current) setNameInput(name);
      setAvatarUrl(avatar);

      if (goalsData) setGoals(goalsData);
      // A failed fetch keeps the workouts already shown instead of blanking them.
      if (Array.isArray(workoutsResult)) setAllWorkouts(workoutsResult);
      setHasLoaded(true);
    } catch (err) {
      console.warn("Profile load warning:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, metaFullName, metaAvatarUrl, recheck]);
  loadDataRef.current = loadData;

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await loadData();
    } finally {
      setIsRetrying(false);
    }
  }, [loadData]);

  // useFocusEffect also fires on first mount, so no separate useEffect is needed.
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
    return calculateActivitySummary(allWorkouts, "30D");
  }, [allWorkouts]);

  // Mental Math Fluency Rank and progress to the next one
  const rankInfo = useMemo(() => {
    const total = overview.lifetimeQuestions || 0;
    let index = 0;
    RANKS.forEach((rank, i) => {
      if (total >= rank.min) index = i;
    });
    const current = RANKS[index];
    const next = RANKS[index + 1] ?? null;
    return {
      current,
      next,
      remaining: next ? next.min - total : 0,
      progress: next ? (total - current.min) / (next.min - current.min) : 1,
    };
  }, [overview.lifetimeQuestions]);

  // Today's and this week's progress, counted in the phone's local days.
  const todayProgress = useMemo(() => {
    const todayKey = localDayKey(new Date());
    const weekStart = startOfLocalWeek();
    let questionsToday = 0;
    let practicedToday = false;
    const weekDays = new Set<string>();

    for (const w of allWorkouts) {
      if (!w.completed_at) continue;
      const completed = new Date(w.completed_at);
      const dayKey = localDayKey(completed);
      if (dayKey === todayKey) {
        practicedToday = true;
        questionsToday += Number(w.total_questions) || 0;
      }
      if (completed >= weekStart) weekDays.add(dayKey);
    }

    return {
      questionsToday,
      practicedToday,
      daysTrainedThisWeek: weekDays.size,
      streak: countDayStreak(allWorkouts.map((w) => w.completed_at)),
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

        if (res.success && res.avatarUrl) {
          setAvatarUrl(res.avatarUrl);
        } else {
          Alert.alert("Upload Error", res.error || "Failed to upload photo.");
        }
      }
    } catch {
      Alert.alert("Error", "Could not complete image selection.");
    } finally {
      setIsUploadingAvatar(false);
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
    try {
      const res = await removeProfileAvatar(userId);
      if (res.success) {
        setAvatarUrl(null);
      } else {
        Alert.alert("Error", res.error || "Failed to remove photo.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to remove photo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const confirmRemoveAvatar = () => {
    Alert.alert("Remove your photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: handleRemoveAvatar },
    ]);
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
          else if (avatarUrl && buttonIndex === 2) confirmRemoveAvatar();
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
          onPress: confirmRemoveAvatar,
          style: "destructive",
        });
      }
      buttons.push({ text: "Cancel", style: "cancel" });
      Alert.alert("Profile Photo", "Select an option", buttons);
    }
  };

  const trimmedName = nameInput.trim();
  const canSaveName =
    trimmedName.length > 0 && trimmedName !== fullName.trim() && !isSavingName;

  const handleSaveName = async () => {
    if (!userId || !canSaveName) return;
    setIsSavingName(true);
    try {
      const res = await updateProfileName(userId, trimmedName);
      if (res.success) {
        setFullName(trimmedName);
        setEditNameVisible(false);
      } else {
        Alert.alert("Error", res.error || "Could not update name.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not update name.");
    } finally {
      setIsSavingName(false);
    }
  };

  // Shows the change right away; puts the old values back if the save fails.
  const saveGoalChange = async (changes: Partial<UserTrainingGoals>) => {
    const previous = goals;
    setGoals((g) => ({ ...g, ...changes }));

    try {
      await saveTrainingGoals(changes, userId);
    } catch (err: any) {
      console.warn("Goal save failed:", err);
      // Only roll back the fields this change touched.
      const rollback = Object.fromEntries(
        Object.keys(changes).map((key) => [
          key,
          previous[key as keyof UserTrainingGoals],
        ]),
      ) as Partial<UserTrainingGoals>;
      setGoals((g) => ({ ...g, ...rollback }));
      Alert.alert(
        "Couldn't save your change",
        isOffline
          ? "You're offline. Connect to the internet and try again."
          : err?.message || "Please try again.",
      );
    }
  };

  const openPlanSheet = (type: SheetType) => {
    if (type === "workingOn") {
      const areas = goals.frictionAreas;
      setDraftAreas(areas ?? []);
      setDraftUnsure(Array.isArray(areas) && areas.length === 0);
    }
    setSheetType(type);
    openSheet();
  };

  const closePlanSheet = () => closeSheet(() => setSheetType(null));

  const selectAndClose = (changes: Partial<UserTrainingGoals>, unchanged: boolean) => {
    triggerHaptic();
    closePlanSheet();
    if (!unchanged) saveGoalChange(changes);
  };

  // Time is the only daily goal; the question count follows from it, like onboarding.
  const handleSelectDuration = (minutes: number) =>
    selectAndClose(
      {
        sessionDurationMinutes: minutes,
        dailyQuestions: questionsForDuration(minutes),
      },
      minutes === goals.sessionDurationMinutes &&
        questionsForDuration(minutes) === goals.dailyQuestions,
    );

  const handleSelectFrequency = (days: number) =>
    selectAndClose(
      { weeklyFrequencyDays: days },
      days === goals.weeklyFrequencyDays,
    );

  const handleSelectFocus = (id: OnboardingPrimaryGoal) =>
    selectAndClose({ primaryGoal: id }, id === goals.primaryGoal);

  const handleSelectLevel = (id: ComfortLevel) =>
    selectAndClose({ comfortLevel: id }, id === goals.comfortLevel);

  const toggleDraftArea = (id: FrictionArea) => {
    triggerHaptic();
    setDraftUnsure(false);
    setDraftAreas((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const toggleDraftUnsure = () => {
    triggerHaptic();
    setDraftAreas([]);
    setDraftUnsure((prev) => !prev);
  };

  const canSaveWorkingOn = draftUnsure || draftAreas.length > 0;

  const handleSaveWorkingOn = () => {
    if (!canSaveWorkingOn) return;
    // Keep the same order as the list. Empty array = "Not sure, test me".
    const areas = draftUnsure
      ? []
      : WEAK_SPOTS.map((w) => w.id).filter((id) => draftAreas.includes(id));
    const current = goals.frictionAreas;
    const unchanged =
      Array.isArray(current) &&
      current.length === areas.length &&
      areas.every((a) => current.includes(a));
    selectAndClose(
      // Legacy single field: first pick, or 'mixed' when unsure (same as onboarding).
      { frictionAreas: areas, frictionArea: areas[0] ?? "mixed" },
      unchanged,
    );
  };

  // Plan values shown on the cards
  const focusOption = GOALS.find((g) => g.id === goals.primaryGoal);
  const levelOption = COMFORT_LEVELS.find((c) => c.id === goals.comfortLevel);
  const workingOnSpots = WEAK_SPOTS.filter((w) =>
    (goals.frictionAreas ?? []).includes(w.id),
  );
  const workingOnValue =
    goals.frictionAreas === undefined
      ? NOT_SET
      : goals.frictionAreas.length === 0
        ? "Not sure yet"
        : workingOnSpots.map((w) => w.title).join(", ");
  const workingOnSymbols = workingOnSpots
    .map((w) => w.symbol)
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  const renderMathSymbol = (symbol: string, size: "badge" | "option") => (
    <Text
      importantForAccessibility="no"
      accessibilityElementsHidden
      maxFontSizeMultiplier={1.3}
      style={[
        size === "badge" ? styles.badgeSymbol : styles.optionSymbol,
        { color: size === "badge" ? accentStrong : primaryText },
      ]}
    >
      {symbol}
    </Text>
  );

  const renderSettingCard = (opts: {
    title: string;
    value: string;
    leading: ReactNode;
    onPress: () => void;
    progress?: { label: string; ratio: number };
  }) => {
    const isEmpty = opts.value === NOT_SET;
    const spokenValue = isEmpty ? "not set" : opts.value;
    return (
      <TouchableOpacity
        style={[
          styles.goalItemCard,
          { backgroundColor: cardBg, borderColor: borderSubtle },
        ]}
        activeOpacity={0.7}
        onPress={opts.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${opts.title}: ${spokenValue}${
          opts.progress ? `. ${opts.progress.label}` : ""
        }`}
        accessibilityHint="Opens options to change it"
      >
        <View style={[styles.goalIconBadge, { backgroundColor: accentSoft }]}>
          {opts.leading}
        </View>
        <View style={styles.goalTextStack}>
          <Text style={[styles.goalItemTitle, { color: secondaryText }]}>
            {opts.title}
          </Text>
          <Text
            style={[
              styles.goalItemValue,
              { color: isEmpty ? accentStrong : primaryText },
            ]}
          >
            {isEmpty ? "Not set · Tap to choose" : opts.value}
          </Text>
          {opts.progress && (
            <>
              <View
                style={[styles.progressBarTrack, { backgroundColor: fillBg }]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: accentStrong,
                      width: `${Math.round(
                        Math.min(Math.max(opts.progress.ratio, 0), 1) * 100,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.goalItemSubtitle, { color: secondaryText }]}>
                {opts.progress.label}
              </Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={secondaryText} />
      </TouchableOpacity>
    );
  };

  const renderCardIcon = (name: IoniconName) => (
    <Ionicons name={name} size={20} color={accentStrong} />
  );

  const renderSheetOption = (opts: {
    key: string | number;
    title: string;
    desc?: string;
    leading?: ReactNode;
    selected: boolean;
    role: "radio" | "checkbox";
    onPress: () => void;
  }) => {
    const indicator =
      opts.role === "radio"
        ? opts.selected
          ? "radio-button-on"
          : "radio-button-off"
        : opts.selected
          ? "checkbox"
          : "square-outline";
    return (
      <TouchableOpacity
        key={opts.key}
        style={[
          styles.goalOptionRow,
          {
            backgroundColor: opts.selected ? accentSoft : fillBg,
            borderColor: opts.selected ? accentStrong : "transparent",
          },
        ]}
        activeOpacity={0.7}
        onPress={opts.onPress}
        accessibilityRole={opts.role}
        accessibilityLabel={opts.desc ? `${opts.title}. ${opts.desc}` : opts.title}
        accessibilityState={
          opts.role === "radio"
            ? { selected: opts.selected }
            : { selected: opts.selected, checked: opts.selected }
        }
      >
        {opts.leading && <View style={styles.optionLeading}>{opts.leading}</View>}
        <View style={styles.optionTextStack}>
          <Text style={[styles.goalOptionText, { color: primaryText }]}>
            {opts.title}
          </Text>
          {opts.desc && (
            <Text style={[styles.optionDesc, { color: secondaryText }]}>
              {opts.desc}
            </Text>
          )}
        </View>
        <Ionicons
          name={indicator}
          size={22}
          color={opts.selected ? accentStrong : secondaryText}
        />
      </TouchableOpacity>
    );
  };

  const renderOptionIcon = (name: IoniconName) => (
    <Ionicons name={name} size={22} color={primaryText} />
  );

  const renderSheetOptions = () => {
    switch (sheetType) {
      case "duration":
        return DURATION_MINUTE_OPTIONS.map((m) =>
          renderSheetOption({
            key: m,
            title: `${m} minutes`,
            desc: `About ${questionsForDuration(m)} questions`,
            selected: goals.sessionDurationMinutes === m,
            role: "radio",
            onPress: () => handleSelectDuration(m),
          }),
        );
      case "frequency":
        return FREQUENCY_DAY_OPTIONS.map((opt) =>
          renderSheetOption({
            key: opt.days,
            title: formatFrequencyGoal(opt.days),
            selected: goals.weeklyFrequencyDays === opt.days,
            role: "radio",
            onPress: () => handleSelectFrequency(opt.days),
          }),
        );
      case "focus":
        return GOALS.map((item) =>
          renderSheetOption({
            key: item.id,
            title: item.title,
            desc: item.desc,
            leading: renderOptionIcon(item.icon),
            selected: goals.primaryGoal === item.id,
            role: "radio",
            onPress: () => handleSelectFocus(item.id),
          }),
        );
      case "workingOn":
        return [
          ...WEAK_SPOTS.map((item) =>
            renderSheetOption({
              key: item.id,
              title: item.title,
              desc: item.desc,
              leading: item.symbol
                ? renderMathSymbol(item.symbol, "option")
                : renderOptionIcon(item.icon!),
              selected: draftAreas.includes(item.id),
              role: "checkbox",
              onPress: () => toggleDraftArea(item.id),
            }),
          ),
          renderSheetOption({
            key: "unsure",
            title: NOT_SURE_OPTION.title,
            desc: NOT_SURE_OPTION.desc,
            leading: renderOptionIcon(NOT_SURE_OPTION.icon),
            selected: draftUnsure,
            role: "checkbox",
            onPress: toggleDraftUnsure,
          }),
        ];
      case "level":
        return COMFORT_LEVELS.map((item) =>
          renderSheetOption({
            key: item.id,
            title: item.title,
            desc: item.desc,
            leading: renderOptionIcon(item.icon),
            selected: goals.comfortLevel === item.id,
            role: "radio",
            onPress: () => handleSelectLevel(item.id),
          }),
        );
      default:
        return null;
    }
  };

  const renderSheetHeader = (title: string, onClose: () => void) => (
    <View style={styles.sheetTopRow}>
      <Text
        style={[styles.sheetMainTitle, { color: primaryText }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <TouchableOpacity
        onPress={onClose}
        style={[styles.sheetCloseIcon, { backgroundColor: fillBg }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={20} color={primaryText} />
      </TouchableOpacity>
    </View>
  );

  if (isOffline && !hasLoaded) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: screenBg }]}
        edges={["top", "bottom"]}
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <OfflineNotice onRetry={handleRetry} isRetrying={isRetrying} />
      </SafeAreaView>
    );
  }

  const { streak, practicedToday } = todayProgress;
  const streakHint =
    streak === 0
      ? "Do a workout today to start a streak."
      : practicedToday
        ? "You practiced today. Nice work!"
        : "Practice today to keep it going.";
  const latestWorkout = overview.latestWorkout;
  const rankProgressText = rankInfo.next
    ? `${rankInfo.remaining.toLocaleString()} questions to ${rankInfo.next.title}`
    : "Top rank reached";

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: screenBg }]}
      edges={["top"]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

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
        <Text
          style={[styles.headerTitle, { color: primaryText }]}
          accessibilityRole="header"
        >
          My profile
        </Text>
        <TouchableOpacity
          style={[
            styles.gearButton,
            { backgroundColor: cardBg, borderColor: borderSubtle },
          ]}
          activeOpacity={0.7}
          onPress={() => router.push("/(app)/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={22} color={primaryText} />
        </TouchableOpacity>
      </View>

      {/* Offline banner: data loaded earlier stays on screen */}
      {isOffline && hasLoaded && (
        <View style={styles.offlineBannerWrap}>
          <View
            style={[
              styles.offlineBanner,
              { backgroundColor: cardBg, borderColor: borderSubtle },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name="cloud-offline-outline"
              size={20}
              color={secondaryText}
            />
            <Text style={[styles.offlineBannerText, { color: primaryText }]}>
              You're offline
            </Text>
            <TouchableOpacity
              onPress={handleRetry}
              disabled={isRetrying}
              style={styles.offlineRetryBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry connection"
              accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color={accentStrong} />
              ) : (
                <Text style={[styles.offlineRetryText, { color: accentStrong }]}>
                  Retry
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={accentStrong} />
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
                  style={[styles.avatarCircle, { borderColor: accent }]}
                  disabled={isUploadingAvatar}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                  accessibilityState={{ busy: isUploadingAvatar }}
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
                        { backgroundColor: accent },
                      ]}
                    >
                      <Text
                        style={[styles.avatarInitials, { color: onAccent }]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {getInitials(
                          fullName || session?.user?.email || "NUMO",
                        )}
                      </Text>
                    </View>
                  )}
                  {isUploadingAvatar ? (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color={PALETTE.white} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.avatarMiniBadge,
                        { backgroundColor: accent, borderColor: cardBg },
                      ]}
                    >
                      <Ionicons name="camera" size={12} color={onAccent} />
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
                    accessibilityRole="button"
                    accessibilityLabel={
                      fullName ? `Edit name, ${fullName}` : "Add your name"
                    }
                  >
                    <Text
                      style={[styles.displayName, { color: primaryText }]}
                      numberOfLines={2}
                    >
                      {fullName || "Add your name"}
                    </Text>
                    <Ionicons
                      name="create-outline"
                      size={18}
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
                    style={[styles.tierBadgePill, { backgroundColor: accentSoft }]}
                  >
                    <Ionicons
                      name={rankInfo.current.icon}
                      size={14}
                      color={accentStrong}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[styles.tierBadgeText, { color: accentStrong }]}
                    >
                      Rank: {rankInfo.current.title}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Progress to the next rank */}
              <View
                style={styles.rankProgressBlock}
                accessible
                accessibilityLabel={`Rank ${rankInfo.current.title}. ${rankProgressText}`}
              >
                <View
                  style={[styles.progressBarTrack, { backgroundColor: fillBg }]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: accentStrong,
                        width: `${Math.round(rankInfo.progress * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.rankProgressText, { color: secondaryText }]}>
                  {rankProgressText}
                </Text>
              </View>

              {/* Sub-card Highlight Strip */}
              <View
                style={[styles.cardDivider, { backgroundColor: borderSubtle }]}
              />
              <View style={styles.heroHighlightsRow}>
                <View
                  style={styles.heroStatItem}
                  accessible
                  accessibilityLabel={`Lifetime questions: ${overview.lifetimeQuestions.toLocaleString()}`}
                >
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
                    { backgroundColor: borderSubtle },
                  ]}
                />

                <View
                  style={styles.heroStatItem}
                  accessible
                  accessibilityLabel={`Workouts completed: ${overview.lifetimeSessions}`}
                >
                  <Text
                    style={[styles.heroStatLabel, { color: secondaryText }]}
                  >
                    WORKOUTS COMPLETED
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
                  style={[styles.activityCardHeading, { color: primaryText }]}
                  accessibilityRole="header"
                >
                  Training activity
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setActivitySheetVisible(true);
                    openSheet();
                  }}
                  activeOpacity={0.7}
                  style={styles.seeActivityBtn}
                  accessibilityRole="button"
                  accessibilityLabel="See activity"
                >
                  <Text style={[styles.seeActivityLink, { color: accentStrong }]}>
                    See activity →
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={styles.streakRow}
                accessible
                accessibilityLabel={`${streak} ${streak === 1 ? "day" : "days"} in a row. ${streakHint}`}
              >
                <View
                  style={[styles.goalIconBadge, { backgroundColor: accentSoft }]}
                >
                  <Ionicons name="flame-outline" size={20} color={accentStrong} />
                </View>
                <View style={styles.goalTextStack}>
                  <Text style={[styles.streakValue, { color: primaryText }]}>
                    {streak} {streak === 1 ? "day" : "days"} in a row
                  </Text>
                  <Text style={[styles.streakHint, { color: secondaryText }]}>
                    {streakHint}
                  </Text>
                </View>
              </View>

              {latestWorkout && (
                <View
                  style={[styles.lastSessionNote, { borderTopColor: borderSubtle }]}
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={secondaryText}
                  />
                  <Text style={[styles.lastSessionText, { color: secondaryText }]}>
                    Last session:{" "}
                    <Text style={{ fontWeight: "600", color: primaryText }}>
                      {formatOperationName(latestWorkout.operation)}
                    </Text>
                    {" · "}
                    {latestWorkout.totalQuestions} questions{" · "}
                    {formatRelativeSessionDate(latestWorkout.completedAt)}
                  </Text>
                </View>
              )}
            </View>

            {/* 3. Your Plan Section (choices from onboarding) */}
            <Text
              style={[styles.sectionHeading, { color: secondaryText }]}
              accessibilityRole="header"
            >
              YOUR PLAN
            </Text>
            <View style={styles.goalsList}>
              {renderSettingCard({
                title: "Focus",
                value: focusOption?.title ?? NOT_SET,
                leading: renderCardIcon(focusOption?.icon ?? "flag-outline"),
                onPress: () => openPlanSheet("focus"),
              })}
              {renderSettingCard({
                title: "Working on",
                value: workingOnValue,
                leading: workingOnSymbols
                  ? renderMathSymbol(workingOnSymbols, "badge")
                  : workingOnSpots.some((w) => w.id === "mixed")
                    ? renderCardIcon("shuffle")
                    : renderMathSymbol("?", "badge"),
                onPress: () => openPlanSheet("workingOn"),
              })}
              {renderSettingCard({
                title: "Level",
                value: levelOption?.title ?? NOT_SET,
                leading: renderCardIcon(levelOption?.icon ?? "speedometer-outline"),
                onPress: () => openPlanSheet("level"),
              })}
            </View>

            {/* 4. Training Goals Section */}
            <Text
              style={[styles.sectionHeading, { color: secondaryText }]}
              accessibilityRole="header"
            >
              TRAINING GOALS
            </Text>
            <View style={styles.goalsList}>
              {renderSettingCard({
                title: "Time per day",
                value: `${formatDurationGoal(goals.sessionDurationMinutes)} · about ${goals.dailyQuestions} questions`,
                leading: renderCardIcon("timer-outline"),
                onPress: () => openPlanSheet("duration"),
                progress: {
                  label: `${todayProgress.questionsToday} of ${goals.dailyQuestions} questions today`,
                  ratio: todayProgress.questionsToday / goals.dailyQuestions,
                },
              })}
              {renderSettingCard({
                title: "Days per week",
                value: formatFrequencyGoal(goals.weeklyFrequencyDays),
                leading: renderCardIcon("calendar-outline"),
                onPress: () => openPlanSheet("frequency"),
                progress: {
                  label: `${todayProgress.daysTrainedThisWeek} of ${goals.weeklyFrequencyDays} days this week`,
                  ratio:
                    todayProgress.daysTrainedThisWeek / goals.weeklyFrequencyDays,
                },
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Activity Bottom Sheet: last 30 days */}
      <Modal
        visible={activitySheetVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeSheet(() => setActivitySheetVisible(false))}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetDismissArea}
            activeOpacity={1}
            onPress={() => closeSheet(() => setActivitySheetVisible(false))}
            accessible={false}
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
            <View style={styles.handleContainer}>
              <View
                style={[styles.grabHandle, { backgroundColor: secondaryText }]}
              />
            </View>

            {renderSheetHeader("Training activity", () =>
              closeSheet(() => setActivitySheetVisible(false)),
            )}

            <View style={styles.scrollWrapper}>
              <ScrollView
                style={styles.activityScrollArea}
                contentContainerStyle={styles.activityScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                bounces={true}
              >
                <Text
                  style={[styles.recentSessionsHeader, { color: secondaryText }]}
                  accessibilityRole="header"
                >
                  LAST 30 DAYS ({activitySummary.recentSessions.length})
                </Text>

                {activitySummary.recentSessions.length === 0 ? (
                  <View style={styles.emptySessionBox}>
                    <Text
                      style={[styles.emptySessionText, { color: secondaryText }]}
                    >
                      No workouts in the last 30 days.
                    </Text>
                  </View>
                ) : (
                  activitySummary.recentSessions.map((item) => {
                    const name = formatOperationName(item.operation);
                    const when = formatRelativeSessionDate(item.completedAt);
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.sessionItemRow,
                          { borderBottomColor: borderSubtle },
                        ]}
                        accessible
                        accessibilityLabel={`${name}, ${item.totalQuestions} questions, ${when}, ${item.accuracy} percent correct`}
                      >
                        <View style={styles.sessionLeftStack}>
                          <Text
                            style={[styles.sessionOpTitle, { color: primaryText }]}
                          >
                            {name}
                          </Text>
                          <Text
                            style={[
                              styles.sessionDetailSub,
                              { color: secondaryText },
                            ]}
                          >
                            {item.totalQuestions} questions · {when}
                          </Text>
                        </View>
                        <View style={styles.sessionRightPill}>
                          <Text
                            style={[
                              styles.sessionAccuracyText,
                              { color: accentStrong },
                            ]}
                          >
                            {item.accuracy}%
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.viewStatsCtaBtn, { backgroundColor: accent }]}
              onPress={() => {
                closeSheet(() => {
                  setActivitySheetVisible(false);
                  router.push("/(app)/statistics");
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="View full statistics"
            >
              <Text style={[styles.viewStatsCtaText, { color: onAccent }]}>
                View Full Statistics →
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Plan & Goal Selector Bottom Sheet */}
      <Modal
        visible={sheetType !== null}
        transparent
        animationType="none"
        onRequestClose={closePlanSheet}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetDismissArea}
            activeOpacity={1}
            onPress={closePlanSheet}
            accessible={false}
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

            {sheetType && (
              <>
                {renderSheetHeader(SHEET_COPY[sheetType].title, closePlanSheet)}
                <Text
                  style={[styles.sheetDescSubtitle, { color: secondaryText }]}
                >
                  {SHEET_COPY[sheetType].subtitle}
                </Text>
              </>
            )}

            <ScrollView
              style={styles.goalOptionsScroll}
              contentContainerStyle={styles.goalPillsWrapper}
              showsVerticalScrollIndicator={false}
              accessibilityRole={sheetType === "workingOn" ? undefined : "radiogroup"}
            >
              {renderSheetOptions()}
            </ScrollView>

            {sheetType === "workingOn" && (
              <TouchableOpacity
                style={[
                  styles.sheetSaveBtn,
                  { backgroundColor: accent },
                  !canSaveWorkingOn && styles.disabledBtn,
                ]}
                onPress={handleSaveWorkingOn}
                disabled={!canSaveWorkingOn}
                accessibilityRole="button"
                accessibilityLabel="Save"
                accessibilityState={{ disabled: !canSaveWorkingOn }}
              >
                <Text style={[styles.viewStatsCtaText, { color: onAccent }]}>
                  Save
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Edit Name Modal */}
      <Modal
        visible={editNameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNameVisible(false)}
      >
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
            <Text
              style={[styles.modalHeading, { color: primaryText }]}
              accessibilityRole="header"
            >
              Edit name
            </Text>
            <Text style={[styles.modalSubheading, { color: secondaryText }]}>
              What should we call you?
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              placeholderTextColor={secondaryText}
              maxLength={NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
              accessibilityLabel="Your name"
              accessibilityHint={`Up to ${NAME_MAX_LENGTH} characters`}
              style={[
                styles.modalInput,
                { backgroundColor: fillBg, color: primaryText },
              ]}
              autoFocus
            />
            <Text style={[styles.charCount, { color: secondaryText }]}>
              {nameInput.length}/{NAME_MAX_LENGTH}
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: fillBg }]}
                onPress={() => setEditNameVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.modalBtnText, { color: primaryText }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: accent },
                  !canSaveName && !isSavingName && styles.disabledBtn,
                ]}
                onPress={handleSaveName}
                disabled={!canSaveName}
                accessibilityRole="button"
                accessibilityLabel="Save name"
                accessibilityState={{ disabled: !canSaveName, busy: isSavingName }}
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color={onAccent} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: onAccent }]}>
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

const MIN_TAP = 44;

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
    ...typography.screenTitle,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  gearButton: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: MIN_TAP / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: PALETTE.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },
  // Offline banner
  offlineBannerWrap: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 52,
  },
  offlineBannerText: {
    ...typography.secondary,
    fontWeight: "600",
    flex: 1,
  },
  offlineRetryBtn: {
    minHeight: MIN_TAP,
    minWidth: 64,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineRetryText: {
    ...typography.button,
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
    shadowColor: PALETTE.dark,
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
    ...typography.screenTitle,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: PALETTE.scrim,
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
  },
  heroDetailsCol: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: MIN_TAP,
  },
  displayName: {
    ...typography.sectionHeading,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  displayEmail: {
    ...typography.secondary,
  },
  tierBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 8,
  },
  tierBadgeText: {
    ...typography.secondary,
    fontWeight: "600",
  },
  rankProgressBlock: {
    marginTop: 14,
  },
  rankProgressText: {
    ...typography.secondary,
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
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  heroStatLabel: {
    ...typography.secondary,
    letterSpacing: 0.4,
    textAlign: "center",
    marginBottom: 3,
  },
  heroStatValue: {
    ...typography.sectionHeading,
  },
  heroStatSeparator: {
    width: 1,
    alignSelf: "stretch",
  },
  // Training Activity Card
  activityOverviewCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: PALETTE.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  activityCardHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  activityCardHeading: {
    ...typography.button,
    fontSize: 17,
  },
  seeActivityBtn: {
    minHeight: MIN_TAP,
    justifyContent: "center",
    paddingLeft: 8,
  },
  seeActivityLink: {
    ...typography.secondary,
    fontWeight: "600",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  streakValue: {
    ...typography.sectionHeading,
  },
  streakHint: {
    ...typography.secondary,
    marginTop: 2,
  },
  lastSessionNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  lastSessionText: {
    ...typography.secondary,
    flex: 1,
  },
  // Plan & Goals Sections
  sectionHeading: {
    ...typography.secondary,
    fontWeight: "600",
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
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: PALETTE.dark,
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
  badgeSymbol: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  goalTextStack: {
    flex: 1,
    marginRight: 10,
  },
  goalItemTitle: {
    ...typography.secondary,
  },
  goalItemValue: {
    ...typography.body,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 6,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  goalItemSubtitle: {
    ...typography.secondary,
  },
  // Bottom Sheet Base
  sheetBackdrop: {
    flex: 1,
    backgroundColor: PALETTE.scrim,
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
    maxHeight: SCREEN_HEIGHT * 0.88,
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
    gap: 12,
    marginBottom: 6,
  },
  sheetMainTitle: {
    ...typography.sectionHeading,
    flex: 1,
  },
  sheetDescSubtitle: {
    ...typography.secondary,
    marginBottom: 16,
  },
  sheetCloseIcon: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: MIN_TAP / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  recentSessionsHeader: {
    ...typography.secondary,
    fontWeight: "600",
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
    ...typography.button,
  },
  sessionDetailSub: {
    ...typography.secondary,
    marginTop: 2,
  },
  sessionRightPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sessionAccuracyText: {
    ...typography.button,
  },
  emptySessionBox: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySessionText: {
    ...typography.body,
    textAlign: "center",
  },
  viewStatsCtaBtn: {
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  viewStatsCtaText: {
    ...typography.button,
  },
  goalOptionsScroll: {
    flexGrow: 0,
  },
  goalPillsWrapper: {
    gap: 8,
    paddingBottom: 12,
  },
  goalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionLeading: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  optionSymbol: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
  },
  optionTextStack: {
    flex: 1,
  },
  goalOptionText: {
    ...typography.button,
    fontSize: 16,
  },
  optionDesc: {
    ...typography.secondary,
    marginTop: 2,
  },
  sheetSaveBtn: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  // Modal Edit
  modalOverlay: {
    flex: 1,
    backgroundColor: PALETTE.scrim,
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
    ...typography.sectionHeading,
    marginBottom: 4,
  },
  modalSubheading: {
    ...typography.body,
    marginBottom: 16,
  },
  modalInput: {
    ...inputTypography("body"),
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  charCount: {
    ...typography.secondary,
    textAlign: "right",
    marginTop: 6,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    ...typography.button,
  },
});
