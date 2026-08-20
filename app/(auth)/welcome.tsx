import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const WORKOUT_STEPS = [
  { equation: '12 + 19', result: '= 31', time: '1.2s', step: 1 },
  { equation: '56 − 28', result: '= 28', time: '1.5s', step: 2 },
  { equation: '7 × 13',  result: '= 91', time: '1.8s', step: 3 },
  { equation: '108 ÷ 12', result: '= 9',  time: '1.4s', step: 4 },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Animation values for workout step
  const fadeEquation = useRef(new Animated.Value(0)).current;
  const fadeResult = useRef(new Animated.Value(0)).current;
  const translateYResult = useRef(new Animated.Value(6)).current;
  const fadeBadge = useRef(new Animated.Value(0)).current;
  const fadeCorrect = useRef(new Animated.Value(0)).current;
  const scaleCard = useRef(new Animated.Value(1)).current;

  // Floating ambient background particles
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

      // Reset values
      fadeEquation.setValue(0);
      fadeResult.setValue(0);
      translateYResult.setValue(6);
      fadeBadge.setValue(0);
      fadeCorrect.setValue(0);

      Animated.sequence([
        // Step 1: Equation fades in
        Animated.timing(fadeEquation, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.delay(200),

        // Step 2: Answer slides/fades in
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

        // Step 3: Speed badge pops & subtle card pulse
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

        // Step 4: "✓ Correct" pill appears
        Animated.spring(fadeCorrect, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.delay(1400),

        // Step 5: Transition out for next workout question
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 1. Header Branding */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandLogo}>NUMO</Text>
        </View>

        {/* 2. Hero Proposition */}
        <View style={styles.textContainer}>
          <Text style={styles.heading}>Train your brain.{"\n"}Master mental math.</Text>
          <Text style={styles.subheading}>
            Build speed, accuracy, and confidence, one workout at a time.
          </Text>
        </View>

        {/* 3. Central Interactive Math Visual */}
        <View style={styles.showcaseSection}>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { top: -14, left: 14, transform: [{ translateY: floatUp }] },
            ]}
          >
            × 81
          </Animated.Text>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { top: 12, right: 10, transform: [{ translateY: floatDown }] },
            ]}
          >
            ÷ 144
          </Animated.Text>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { bottom: -12, left: 24, transform: [{ translateY: floatDown }] },
            ]}
          >
            + 27
          </Animated.Text>
          <Animated.Text
            style={[
              styles.floatingSymbol,
              { bottom: 2, right: 28, transform: [{ translateY: floatUp }] },
            ]}
          >
            − 16
          </Animated.Text>

          {/* Math Workout Card */}
          <Animated.View
            style={[
              styles.mathCard,
              { transform: [{ scale: scaleCard }] },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTag}>MENTAL MATH</Text>
              <Animated.View
                style={[
                  styles.correctBadge,
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
            <View style={styles.equationBody}>
              <Animated.Text
                style={[styles.equationText, { opacity: fadeEquation }]}
              >
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

        {/* 4. Concrete Value Card */}
        <View style={styles.valueCard}>
          <View style={styles.valueIconPill}>
            <Text style={styles.valueIconText}>⚡</Text>
          </View>
          <View style={styles.valueTextGroup}>
            <Text style={styles.valueTitle}>DAILY WORKOUTS</Text>
            <Text style={styles.valueBody}>
              10 questions • 2 mins • Personalized speed tracking
            </Text>
          </View>
        </View>

        {/* 5. Action Controls */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: '/(app)/training',
                params: { mode: 'demo' },
              })
            }
          >
            <Text style={styles.primaryButtonText}>Start Training →</Text>
          </TouchableOpacity>

          <View style={styles.loginPromptRow}>
            <Text style={styles.accountText}>Already have an account? </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginLinkText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6E6E6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  brandLogo: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#EC673C',
  },
  textContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  heading: {
    fontSize: 26,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  showcaseSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  floatingSymbol: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: '800',
    color: '#9CA3AF',
    zIndex: 1,
    opacity: 0.6,
  },
  mathCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#AFA2FE',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    zIndex: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  correctBadge: {
    backgroundColor: '#F6FE91',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  correctBadgeText: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '800',
  },
  equationBody: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  equationText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  resultText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F6FE91',
    marginTop: 2,
    marginBottom: 8,
  },
  speedBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  speedBadgeText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '800',
  },
  progressContainer: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.5,
  },
  valueCard: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  valueIconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF2EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  valueIconText: {
    fontSize: 16,
  },
  valueTextGroup: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EC673C',
    letterSpacing: 1,
    marginBottom: 2,
  },
  valueBody: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  actionContainer: {
    width: '100%',
    paddingBottom: 6,
  },
  primaryButton: {
    backgroundColor: '#F6FE91',
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#1F2937',
    fontSize: 17,
    fontWeight: '800',
  },
  loginPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  accountText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
  },
  loginLinkText: {
    color: '#EC673C',
    fontSize: 14,
    fontWeight: '800',
  },
});