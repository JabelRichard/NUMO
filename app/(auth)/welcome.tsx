import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';

const WORKOUT_STEPS = [
  { equation: '12 + 19', result: '= 31', time: '1.2s', step: 1 },
  { equation: '56 − 28', result: '= 28', time: '1.5s', step: 2 },
  { equation: '7 × 13',  result: '= 91', time: '1.8s', step: 3 },
  { equation: '108 ÷ 12', result: '= 9',  time: '1.4s', step: 4 },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  const isCompact = height < 720;
  const isNarrow = width < 360;

  const fadeEquation = useRef(new Animated.Value(0)).current;
  const fadeResult = useRef(new Animated.Value(0)).current;
  const translateYResult = useRef(new Animated.Value(6)).current;
  const fadeBadge = useRef(new Animated.Value(0)).current;
  const fadeCorrect = useRef(new Animated.Value(0)).current;
  const scaleCard = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  useEffect(() => {
    let isMounted = true;

    const playWorkoutLoop = (index: number) => {
      if (!isMounted) return;
      setCurrentIndex(index);

      fadeEquation.setValue(0);
      fadeResult.setValue(0);
      translateYResult.setValue(6);
      fadeBadge.setValue(0);
      fadeCorrect.setValue(0);

      Animated.sequence([
        Animated.timing(fadeEquation, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(fadeResult, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(translateYResult, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(150),
        Animated.parallel([
          Animated.spring(fadeBadge, {
            toValue: 1,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(scaleCard, {
              toValue: 1.02,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(scaleCard, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(200),
        Animated.spring(fadeCorrect, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.parallel([
          Animated.timing(fadeEquation, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeResult, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeBadge, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeCorrect, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        if (isMounted) {
          const nextIndex = (index + 1) % WORKOUT_STEPS.length;
          playWorkoutLoop(nextIndex);
        }
      });
    };

    playWorkoutLoop(0);

    return () => {
      isMounted = false;
    };
  }, [fadeEquation, fadeResult, translateYResult, fadeBadge, fadeCorrect, scaleCard]);

  const currentOp = WORKOUT_STEPS[currentIndex];

  const floatUp = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const floatDown = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: isNarrow ? 18 : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Header Group */}
        <View style={styles.topGroup}>
          <View style={[styles.brandContainer, isCompact && styles.brandContainerCompact]}>
            <Text style={[styles.brandLogo, { color: theme.primary }, isCompact && styles.brandLogoCompact]}>NUMO</Text>
          </View>

          <View style={[styles.textContainer, isCompact && styles.textContainerCompact]}>
            <Text style={[styles.heading, { color: theme.text }, isCompact && styles.headingCompact]}>
              Train your brain.{"\n"}Master mental math.
            </Text>
            <Text style={[styles.subheading, { color: theme.subtext }, isCompact && styles.subheadingCompact]}>
              Build speed, accuracy, and confidence, one workout at a time.
            </Text>
          </View>
        </View>

        {/* Central Interactive Math Visual */}
        <View style={[styles.showcaseSection, isCompact && styles.showcaseSectionCompact]}>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { color: theme.muted, top: -10, left: 10, transform: [{ translateY: floatUp }] },
            ]}
          >
            × 81
          </Animated.Text>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { color: theme.muted, top: 8, right: 8, transform: [{ translateY: floatDown }] },
            ]}
          >
            ÷ 144
          </Animated.Text>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { color: theme.muted, bottom: -10, left: 16, transform: [{ translateY: floatDown }] },
            ]}
          >
            + 27
          </Animated.Text>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { color: theme.muted, bottom: 0, right: 18, transform: [{ translateY: floatUp }] },
            ]}
          >
            − 16
          </Animated.Text>

          {/* Math Card */}
          <Animated.View
            style={[
              styles.mathCard,
              { backgroundColor: theme.accentPurple },
              isCompact && styles.mathCardCompact,
              { transform: [{ scale: scaleCard }] },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTag}>MENTAL MATH</Text>
              <Animated.View
                style={[
                  styles.correctBadge,
                  { backgroundColor: theme.accentYellow },
                  {
                    opacity: fadeCorrect,
                    transform: [
                      {
                        scale: fadeCorrect.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.correctBadgeText}>✓ Correct</Text>
              </Animated.View>
            </View>

            {/* Dynamic Equation Area */}
            <View style={[styles.equationBody, isCompact && styles.equationBodyCompact]}>
              <Animated.Text
                style={[
                  styles.equationText,
                  isCompact && styles.equationTextCompact,
                  { opacity: fadeEquation },
                ]}
              >
                {currentOp.equation}
              </Animated.Text>

              <Animated.Text
                style={[
                  styles.resultText,
                  { color: theme.accentYellow },
                  isCompact && styles.resultTextCompact,
                  {
                    opacity: fadeResult,
                    transform: [{ translateY: translateYResult }],
                  },
                ]}
              >
                {currentOp.result}
              </Animated.Text>

              <Animated.View
                style={[
                  styles.speedBadge,
                  {
                    opacity: fadeBadge,
                    transform: [
                      {
                        scale: fadeBadge.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.speedBadgeText}>⚡ {currentOp.time}</Text>
              </Animated.View>
            </View>

            {/* Live Progress Dots Indicator */}
            <View style={styles.progressContainer}>
              <View style={styles.dotsRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((dotIndex) => (
                  <View
                    key={dotIndex}
                    style={[
                      styles.dot,
                      dotIndex <= currentOp.step ? styles.dotActive : styles.dotInactive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.progressText}>
                Question {currentOp.step} of 10
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Concrete Value Card */}
        <View style={[styles.valueCard, { backgroundColor: theme.card, borderColor: theme.border }, isCompact && styles.valueCardCompact]}>
          <View style={[styles.valueIconPill, { backgroundColor: theme.isDark ? 'rgba(238, 88, 57, 0.2)' : '#FFF2EB' }]}>
            <Text style={styles.valueIconText}>⚡</Text>
          </View>
          <View style={styles.valueTextGroup}>
            <Text style={[styles.valueTitle, { color: theme.primary }]}>DAILY WORKOUTS</Text>
            <Text style={[styles.valueBody, { color: theme.text }]}>
              10 questions • 2 mins • Speed tracking
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={[styles.actionContainer, isCompact && styles.actionContainerCompact]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.primaryButton, { backgroundColor: theme.accentYellow }, isCompact && styles.primaryButtonCompact]}
            onPress={() =>
              router.push({
                pathname: '/(app)/training',
                params: { mode: 'demo' },
              })
            }
          >
            <Text style={styles.primaryButtonText}>Start Training →</Text>
          </TouchableOpacity>

          <View style={[styles.loginPromptRow, isCompact && styles.loginPromptRowCompact]}>
            <Text style={[styles.accountText, { color: theme.subtext }]}>Already have an account? </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={[styles.loginLinkText, { color: theme.primary }]}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6E6E6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center', 
    gap: 28,
  },
  topGroup: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandContainerCompact: {
    marginBottom: 20,
  },
  brandLogo: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#EC673C',
  },
  brandLogoCompact: {
    fontSize: 24,
    letterSpacing: 3,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  textContainerCompact: {
    marginBottom: 2,
  },
  heading: {
    fontSize: 25,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 31,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headingCompact: {
    fontSize: 21,
    lineHeight: 26,
  },
  subheading: {
    fontSize: 13,
    fontWeight: '500',
    color: '#636366',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  subheadingCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  showcaseSection: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  showcaseSectionCompact: {
    marginVertical: 2,
  },
  floatingSymbol: {
    position: 'absolute',
    fontSize: 13,
    fontWeight: '800',
    color: '#9CA3AF',
    zIndex: 1,
    opacity: 0.6,
  },
  mathCard: {
    width: '100%',
    backgroundColor: '#AFA2FE',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    zIndex: 2,
  },
  mathCardCompact: {
    padding: 14,
    borderRadius: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  correctBadge: {
    backgroundColor: '#F6FE91',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  correctBadgeText: {
    color: '#1F2937',
    fontSize: 10,
    fontWeight: '800',
  },
  equationBody: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  equationBodyCompact: {
    paddingVertical: 4,
  },
  equationText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  equationTextCompact: {
    fontSize: 24,
  },
  resultText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F6FE91',
    marginTop: 2,
    marginBottom: 6,
  },
  resultTextCompact: {
    fontSize: 22,
    marginBottom: 4,
  },
  speedBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  speedBadgeText: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '800',
  },
  progressContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.5,
  },
  valueCard: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  valueCardCompact: {
    paddingVertical: 8,
  },
  valueIconPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF2EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  valueIconText: {
    fontSize: 14,
  },
  valueTextGroup: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EC673C',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  valueBody: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600',
  },
  actionContainer: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  actionContainerCompact: {},
  primaryButton: {
    backgroundColor: '#F6FE91',
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonCompact: {
    minHeight: 46,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '800',
  },
  loginPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginPromptRowCompact: {
    marginTop: 8,
  },
  accountText: {
    color: '#636366',
    fontSize: 13,
    fontWeight: '500',
  },
  loginLinkText: {
    color: '#EC673C',
    fontSize: 13,
    fontWeight: '800',
  },
});