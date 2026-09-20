import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  useWindowDimensions,
  StatusBar,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const ORIGINAL_SLIDES = [
  { id: '1', image: require('../../assets/images/homescreen.png') },
  { id: '2', image: require('../../assets/images/workoutscreen.png') },
  { id: '3', image: require('../../assets/images/trainingscreen.png') },
  { id: '4', image: require('../../assets/images/resultsscreen.png') },
  { id: '5', image: require('../../assets/images/statisticsscreen.png') },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const totalOriginal = ORIGINAL_SLIDES.length;
  const initialIndex = totalOriginal; // Start centered in Set 2

  // Create 3 continuous sets: [Set 1, Set 2, Set 3]
  const loopedSlides = useMemo(() => {
    return [
      ...ORIGINAL_SLIDES.map((s, i) => ({ ...s, loopKey: `pre-${i}` })),
      ...ORIGINAL_SLIDES.map((s, i) => ({ ...s, loopKey: `mid-${i}` })),
      ...ORIGINAL_SLIDES.map((s, i) => ({ ...s, loopKey: `post-${i}` })),
    ];
  }, []);

  const [activeGlobalIndex, setActiveGlobalIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const activeIndexRef = useRef(initialIndex);
  const isInteractingRef = useRef(false);

  const isNarrow = width < 360;
  const isCompactHeight = height < 740;

  useEffect(() => {
    activeIndexRef.current = activeGlobalIndex;
  }, [activeGlobalIndex]);

  // CONTINUOUS FORWARD AUTO-SCROLL TIMER
  useEffect(() => {
    const timer = setInterval(() => {
      if (isInteractingRef.current) return;

      const nextIndex = activeIndexRef.current + 1;

      flatListRef.current?.scrollToOffset({
        offset: nextIndex * width,
        animated: true,
      });

      setActiveGlobalIndex(nextIndex);
    }, 3200);

    return () => clearInterval(timer);
  }, [width]);

  // SILENT OFFSET NORMALIZATION (ELIMINATES REWIND FLASH)
  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isInteractingRef.current = false;
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);

    // If advanced into Set 3, silently jump back to corresponding index in Set 2
    if (currentIndex >= totalOriginal * 2) {
      const resetIndex = currentIndex - totalOriginal;
      flatListRef.current?.scrollToOffset({
        offset: resetIndex * width,
        animated: false,
      });
      setActiveGlobalIndex(resetIndex);
      activeIndexRef.current = resetIndex;
    } 
    // If manually swiped backward into Set 1, silently jump forward to Set 2
    else if (currentIndex < totalOriginal) {
      const resetIndex = currentIndex + totalOriginal;
      flatListRef.current?.scrollToOffset({
        offset: resetIndex * width,
        animated: false,
      });
      setActiveGlobalIndex(resetIndex);
      activeIndexRef.current = resetIndex;
    } else {
      setActiveGlobalIndex(currentIndex);
      activeIndexRef.current = currentIndex;
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    if (currentIndex !== activeIndexRef.current && currentIndex >= 0) {
      setActiveGlobalIndex(currentIndex);
    }
  };

  // Map the active position back to 0-4 for pagination indicators
  const currentDotIndex = activeGlobalIndex % totalOriginal;

  const handleOpenPrivacy = () => {
    Linking.openURL('https://yourdomain.com/privacy').catch(() => {});
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://yourdomain.com/terms').catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <SafeAreaView style={styles.safeArea}>
        {/* TOP BRAND BAR */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top > 0 ? 0 : 12, 4) }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandLogoDot} />
            <Text style={styles.brandLogoText}>NUMO</Text>
          </View>
        </View>

        {/* CENTER AUTO-SLIDING PHONE MOCKUPS */}
        <View style={styles.centerSliderContainer}>
          <FlatList
            ref={flatListRef}
            data={loopedSlides}
            keyExtractor={(item) => item.loopKey}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            onScrollBeginDrag={() => {
              isInteractingRef.current = true;
            }}
            onScrollEndDrag={() => {
              setTimeout(() => {
                isInteractingRef.current = false;
              }, 1200);
            }}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={[styles.slideItemWrapper, { width }]}>
                <View
                  style={[
                    styles.imageFrame,
                    {
                      height: isCompactHeight ? height * 0.44 : height * 0.48,
                      width: Math.min(width * 0.76, 310),
                    },
                  ]}
                >
                  <Image
                    source={item.image}
                    style={styles.slideImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            )}
          />

          {/* POINTERS / PAGINATION DOTS (ALWAYS 5 DOTS) */}
          <View style={styles.paginationRow}>
            {ORIGINAL_SLIDES.map((_, idx) => {
              const isActive = idx === currentDotIndex;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  onPress={() => {
                    const targetIndex = totalOriginal + idx;
                    flatListRef.current?.scrollToOffset({
                      offset: targetIndex * width,
                      animated: true,
                    });
                    setActiveGlobalIndex(targetIndex);
                  }}
                  style={[
                    styles.paginationDot,
                    isActive ? styles.paginationDotActive : styles.paginationDotInactive,
                  ]}
                />
              );
            })}
          </View>
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

          {/* Start Training Primary Button -> Navigates to Onboarding */}
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.startTrainingButton, isCompactHeight && { minHeight: 50 }]}
            onPress={() => router.push('/(auth)/onboarding')}
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

  /* CENTER SLIDER */
  centerSliderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideItemWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },

  /* PAGINATION POINTERS */
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: '#EC673C',
  },
  paginationDotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
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