import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const AuthBackground = () => {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Top Left Gradient Blob */}
      <View style={styles.topCircle} />
      {/* Bottom Right Gradient Blob */}
      <View style={styles.bottomCircle} />
    </View>
  );
};

const styles = StyleSheet.create({
  topCircle: {
    position: 'absolute',
    top: -width * 0.35,
    left: -width * 0.25,
    width: width * 0.95,
    height: width * 0.95,
    borderRadius: (width * 0.95) / 2,
    backgroundColor: '#F7A889',
    opacity: 0.65,
  },
  bottomCircle: {
    position: 'absolute',
    bottom: -width * 0.4,
    right: -width * 0.3,
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: (width * 0.85) / 2,
    backgroundColor: '#EE734B',
    opacity: 0.65,
  },
});