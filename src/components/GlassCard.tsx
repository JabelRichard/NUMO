import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, View } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: BlurViewProps['tint'];
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 50,
  tint = 'light',
}) => {
  return (
    <View style={[styles.container, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      {/* Semi-transparent tint layer for glass depth */}
      <View style={styles.contentLayer}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  contentLayer: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    padding: 20,
  },
});