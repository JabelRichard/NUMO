import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';

interface KeypadProps {
  onKeyPress: (val: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

// Generous hit slop to eliminate missed taps between circles
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export const CustomNumericKeypad: React.FC<KeypadProps> = ({
  onKeyPress,
  onDelete,
  onSubmit,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const triggerHaptic = (type: 'light' | 'medium' | 'selection') => {
    if (Platform.OS === 'web') return;
    try {
      if (type === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (type === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.selectionAsync();
      }
    } catch {
      // Graceful fallback if haptics unavailable
    }
  };

  const handleDigitPress = (num: string) => {
    triggerHaptic('light');
    onKeyPress(num);
  };

  const handleDeletePress = () => {
    triggerHaptic('selection');
    onDelete();
  };

  const handleSubmitPress = () => {
    triggerHaptic('medium');
    onSubmit();
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {/* Digits 1-9 */}
        {digits.map((digit) => (
          <View key={digit} style={styles.circleSlot}>
            <TouchableOpacity
              style={[styles.circleButton, { backgroundColor: theme.card }]}
              activeOpacity={0.65}
              disabled={disabled}
              hitSlop={HIT_SLOP}
              onPress={() => handleDigitPress(digit)}
            >
              <Text style={[styles.digitText, { color: theme.text }]}>{digit}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Delete Key */}
        <View style={styles.circleSlot}>
          <TouchableOpacity
            style={[styles.circleButton, { backgroundColor: theme.card }]}
            activeOpacity={0.65}
            disabled={disabled}
            hitSlop={HIT_SLOP}
            onPress={handleDeletePress}
          >
            <Ionicons name="backspace-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Zero Key */}
        <View style={styles.circleSlot}>
          <TouchableOpacity
            style={[styles.circleButton, { backgroundColor: theme.card }]}
            activeOpacity={0.65}
            disabled={disabled}
            hitSlop={HIT_SLOP}
            onPress={() => handleDigitPress('0')}
          >
            <Text style={[styles.digitText, { color: theme.text }]}>0</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Key */}
        <View style={styles.circleSlot}>
          <TouchableOpacity
            style={[styles.circleButton, styles.submitCircle]}
            activeOpacity={0.75}
            disabled={disabled}
            hitSlop={HIT_SLOP}
            onPress={handleSubmitPress}
          >
            <Ionicons name="checkmark" size={28} color="#0A0F0B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  circleSlot: {
    width: '28%', // Holds 3 circles per row with clean negative space
    aspectRatio: 1, // Ensures perfect 1:1 circle bounding box
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButton: {
    width: '100%',
    height: '100%',
    borderRadius: 999, // Guarantees smooth circular radius
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  digitText: {
    fontSize: 27,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  submitCircle: {
    backgroundColor: '#BCE3AA',
  },
});