import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

export const AuthBackground = () => {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();

  const circleTopSize = width * 0.95;
  const circleBottomSize = width * 0.85;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Top Left Gradient Blob */}
      <View
        style={[
          styles.circle,
          {
            top: -width * 0.35,
            left: -width * 0.25,
            width: circleTopSize,
            height: circleTopSize,
            borderRadius: circleTopSize / 2,
            backgroundColor: '#F7A889',
            opacity: theme.isDark ? 0.25 : 0.65,
          },
        ]}
      />
      {/* Bottom Right Gradient Blob */}
      <View
        style={[
          styles.circle,
          {
            bottom: -width * 0.4,
            right: -width * 0.3,
            width: circleBottomSize,
            height: circleBottomSize,
            borderRadius: circleBottomSize / 2,
            backgroundColor: '#EE734B',
            opacity: theme.isDark ? 0.25 : 0.65,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
  },
});