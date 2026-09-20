import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface OfflineNoticeProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function OfflineNotice({ onRetry, isRetrying = false }: OfflineNoticeProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme } = useTheme();

  const isDark = theme.isDark;
  const isNarrow = width < 360;

  const screenBg = isDark ? '#0A0F0B' : '#F1ECE9';
  const textColor = theme.text;
  const textSubtle = theme.muted;
  const accentGreen = '#BCE3AA';
  const bottomBarPadding = Math.max(insets.bottom, 16) + 85;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: screenBg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.contentContainer}>
        {/* Center Stage: Icon + Text */}
        <View style={styles.centerStage}>
          {/* Dashed Ring Container */}
          <View style={styles.iconOutlineRing}>
            <View style={[styles.iconInnerCircle, { backgroundColor: isDark ? 'rgba(188, 227, 170, 0.12)' : 'rgba(188, 227, 170, 0.3)' }]}>
              <Ionicons name="cloud-offline-outline" size={42} color={accentGreen} />
            </View>
          </View>

          <Text style={[styles.title, { color: textColor }]}>App can't connect</Text>

          <Text style={[styles.subtitle, { color: textSubtle }, isNarrow && styles.subtitleNarrow]}>
            Try checking your internet connection or restarting the app. Tap reload once you're back online.
          </Text>
        </View>

        {/* Bottom Button Action */}
        <View style={[styles.actionWrapper, { paddingBottom: bottomBarPadding }]}>
          <TouchableOpacity
            style={[styles.reloadButton, { backgroundColor: accentGreen }]}
            activeOpacity={0.85}
            onPress={onRetry}
            disabled={isRetrying}
          >
            <Text style={styles.reloadButtonText}>
              {isRetrying ? 'Checking connection...' : 'Reload'}
            </Text>
            {!isRetrying && <Ionicons name="refresh" size={20} color="#0A0F0B" />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOutlineRing: {
    width: 110,
    height: 110,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: '#BCE3AA',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconInnerCircle: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  subtitleNarrow: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  actionWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  reloadButton: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  reloadButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A0F0B',
    letterSpacing: 0.5,
  },
});