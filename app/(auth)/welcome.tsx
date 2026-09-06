import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const WORKOUT_STEPS = [
  { equation: '56 − 28', result: '= 28', time: '1.5s', step: 2 },
  { equation: '12 + 19', result: '= 31', time: '1.2s', step: 1 },
  { equation: '7 × 13', result: '= 91', time: '1.8s', step: 3 },
  { equation: '108 ÷ 12', result: '= 9', time: '1.4s', step: 4 },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);

  const isNarrow = width < 360;
  const isCompactHeight = height < 740;

  // Animation values
  const fadeEquation = useRef(new Animated.Value(0)).current;
  const fadeResult = useRef(new Animated.Value(0)).current;
  const translateYResult = useRef(new Animated.Value(6)).current;
  const fadeBadge = useRef(new Animated.Value(0)).current;
  const fadeCorrect = useRef(new Animated.Value(0)).current;
  const scalePhone = useRef(new Animated.Value(0.94)).current;
  const opacityPhone = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityPhone, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(scalePhone, {
        toValue: 1,
        friction: 7,
        tension: 35,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityPhone, scalePhone]);

  // Equation loop animation
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

      const sequence = Animated.sequence([
        Animated.timing(fadeEquation, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.delay(180),
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
        Animated.delay(140),
        Animated.spring(fadeBadge, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.delay(180),
        Animated.spring(fadeCorrect, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.delay(1600),
        Animated.parallel([
          Animated.timing(fadeEquation, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(fadeResult, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(fadeBadge, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(fadeCorrect, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
      ]);

      animationRef.current = sequence;
      sequence.start(() => {
        if (isMounted) {
          const nextIndex = (index + 1) % WORKOUT_STEPS.length;
          playWorkoutLoop(nextIndex);
        }
      });
    };

    playWorkoutLoop(0);

    return () => {
      isMounted = false;
      animationRef.current?.stop();
    };
  }, [fadeEquation, fadeResult, translateYResult, fadeBadge, fadeCorrect]);

  const currentOp = WORKOUT_STEPS[currentIndex];

  const handleOpenPrivacy = () => {
    Linking.openURL('https://yourdomain.com/privacy').catch(() => {});
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://yourdomain.com/terms').catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* BACKGROUND ABSTRACT SHAPES */}
      {/*<View style={styles.topOrangeBlob} pointerEvents="none" />
      <View style={styles.rightPurpleCircle} pointerEvents="none" />*/}
      {/*<View style={styles.bottomLeftPurpleBlob} pointerEvents="none" />
      <View style={styles.bottomRightYellowBlob} pointerEvents="none" />*/}

      {/* Decorative Sparkle Strokes (Left) */}
      <View style={styles.sparkleCluster} pointerEvents="none">
        <View style={[styles.sparkleRay, styles.sparkleOrange]} />
        <View style={[styles.sparkleRay, styles.sparkleYellow]} />
        <View style={[styles.sparkleRay, styles.sparklePurple]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* TOP BRAND BAR */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top > 0 ? 0 : 12, 4) }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandLogoDot} />
            <Text style={styles.brandLogoText}>NUMO</Text>
          </View>

          {/*<View style={styles.liveBadgePill}>
            <View style={styles.liveIndicatorDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>*/}
        </View>

        {/* CENTER FLOATING PHONE DEVICE */}
        <View style={styles.centerPhoneContainer}>
          <Animated.View
            style={[
              styles.phoneOuterFrame,
              {
                opacity: opacityPhone,
                transform: [{ scale: scalePhone }],
                height: isCompactHeight ? height * 0.44 : height * 0.46,
                width: Math.min(width * 0.78, 310),
              },
            ]}
          >
            {/* Dynamic Island Notch */}
            <View style={styles.dynamicIsland} />

            <View style={styles.phoneScreenContent}>
              {/* Inner Mental Math Card */}
              <View style={styles.mathCard}>
                <View style={styles.mathCardHeader}>
                  <Text style={styles.mathCardTag}>MENTAL MATH</Text>
                  <Animated.View
                    style={[
                      styles.correctPill,
                      {
                        opacity: fadeCorrect,
                        transform: [
                          {
                            scale: fadeCorrect.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.75, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.correctPillText}>✓ Correct</Text>
                  </Animated.View>
                </View>

                {/* Animated Equation Body */}
                <View style={styles.equationCenter}>
                  <Animated.Text style={[styles.equationText, { opacity: fadeEquation }]}>
                    {currentOp.equation}
                  </Animated.Text>
                  <Animated.Text
                    style={[
                      styles.resultText,
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
                      styles.speedPill,
                      {
                        opacity: fadeBadge,
                        transform: [
                          {
                            scale: fadeBadge.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.75, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="flash" size={10} color="#F6FE91" style={{ marginRight: 3 }} />
                    <Text style={styles.speedPillText}>{currentOp.time}</Text>
                  </Animated.View>
                </View>

                {/* Progress Round Dots */}
                <View style={styles.progressSection}>
                  <View style={styles.dotsRow}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((dot) => (
                      <View
                        key={dot}
                        style={[
                          styles.dotItem,
                          dot <= currentOp.step ? styles.dotItemActive : styles.dotItemInactive,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.roundText}>
                    Round 1 • Question {currentOp.step} of 10
                  </Text>
                </View>
              </View>

              {/* Bottom Phone Stats Bar */}
              <View style={styles.phoneStatsRow}>
                <View style={styles.phoneStatItem}>
                  <View style={styles.statLabelHeader}>
                    <Ionicons name="flash" size={11} color="#F6FE91" style={{ marginRight: 4 }} />
                    <Text style={styles.phoneStatLabel}>Pace</Text>
                  </View>
                  <Text style={styles.phoneStatValue}>1.4s</Text>
                </View>

                <View style={styles.phoneStatDivider} />

                <View style={styles.phoneStatItem}>
                  <Text style={styles.phoneStatLabel}>Accuracy</Text>
                  <Text style={styles.phoneStatValue}>100%</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* BOTTOM SECTION: HEADINGS & CALL TO ACTION */}
        <View
          style={[
            styles.bottomContent,
            { paddingBottom: Math.max(insets.bottom + 8, 20) },
          ]}
        >
          <View style={styles.textGroup}>
            <Text style={[styles.mainHeadline, isNarrow && { fontSize: 26, lineHeight: 32 }]}>
              Train your brain.{'\n'}
              <Text style={styles.gradientHighlight}>Master mental math.</Text>
            </Text>
            <Text style={styles.subHeadline}>
              Build lightning speed, accuracy, and confidence{'\n'}one workout at a time.
            </Text>
          </View>

          {/* Start Training Primary Button */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.startTrainingButton, isCompactHeight && { minHeight: 50 }]}
            onPress={() =>
              router.push({
                pathname: '/(app)/training',
                params: { mode: 'demo' },
              })
            }
          >
            <Text style={styles.startTrainingText}>Start Training</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Already have an account */}
          <View style={styles.accountRow}>
            <Text style={styles.accountPrompt}>Already have an account? </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginHighlight}>Log In</Text>
            </TouchableOpacity>
          </View>

          {/* Legal Links */}
          <View style={styles.legalFooterRow}>
            <TouchableOpacity onPress={handleOpenPrivacy} activeOpacity={0.7}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={handleOpenTerms} activeOpacity={0.7}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F12',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },

  /* BACKGROUND SHAPES */
  topOrangeBlob: {
    position: 'absolute',
    top: -90,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#EC673C',
    opacity: 0.95,
  },
  rightPurpleCircle: {
    position: 'absolute',
    top: '20%',
    right: -40,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#AFA2FE',
  },
  bottomLeftPurpleBlob: {
    position: 'absolute',
    bottom: -80,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#AFA2FE',
  },
  bottomRightYellowBlob: {
    position: 'absolute',
    bottom: -90,
    right: -60,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#F6FE91',
  },

  /* SPARKLE BURST (LEFT SIDE) */
  sparkleCluster: {
    position: 'absolute',
    top: '29%',
    left: 14,
    zIndex: 1,
    gap: 8,
  },
  sparkleRay: {
    height: 6,
    borderRadius: 3,
  },
  sparkleOrange: {
    width: 18,
    backgroundColor: '#EC673C',
    transform: [{ rotate: '32deg' }],
  },
  sparkleYellow: {
    width: 24,
    backgroundColor: '#F6FE91',
    transform: [{ rotate: '-8deg' }],
  },
  sparklePurple: {
    width: 20,
    backgroundColor: '#AFA2FE',
    transform: [{ rotate: '-34deg' }],
  },

  /* TOP BAR */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EC673C',
  },
  brandLogoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  liveBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EC673C',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  /* CENTER PHONE MOCKUP */
  centerPhoneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  phoneOuterFrame: {
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#16191E',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 12,
    alignItems: 'center',
  },
  dynamicIsland: {
    width: 68,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000000',
    marginTop: 8,
    alignSelf: 'center',
  },
  phoneScreenContent: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },

  /* MOCKUP MATH CARD */
  mathCard: {
    backgroundColor: '#1C2026',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  mathCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mathCardTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8E9993',
    letterSpacing: 0.8,
  },
  correctPill: {
    backgroundColor: '#EC673C',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  correctPillText: {
    color: '#0A0A0A',
    fontSize: 9,
    fontWeight: '900',
  },
  equationCenter: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  equationText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  resultText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#EC673C',
    marginTop: 2,
  },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  speedPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  progressSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 5,
  },
  dotItem: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotItemActive: {
    backgroundColor: '#EC673C',
  },
  dotItemInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  roundText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#8E9993',
  },

  /* MOCKUP STATS ROW */
  phoneStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1C2026',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  phoneStatItem: {
    alignItems: 'center',
  },
  statLabelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneStatLabel: {
    fontSize: 10,
    color: '#8E9993',
    fontWeight: '600',
  },
  phoneStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  phoneStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  /* BOTTOM CONTENT */
  bottomContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  textGroup: {
    alignItems: 'center',
    marginBottom: 18,
  },
  mainHeadline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  gradientHighlight: {
    color: '#EC673C',
  },
  subHeadline: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9993',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },
  startTrainingButton: {
    width: '100%',
    backgroundColor: '#EC673C',
    minHeight: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC673C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 14,
  },
  startTrainingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  accountPrompt: {
    color: '#8E9993',
    fontSize: 13,
    fontWeight: '500',
  },
  loginHighlight: {
    color: '#EC673C',
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  legalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legalLink: {
    color: '#EC673C',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: '#8E9993',
    fontSize: 10,
  },
});