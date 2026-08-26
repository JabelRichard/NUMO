import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface KeypadProps {
  onKeyPress: (val: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const CustomNumericKeypad: React.FC<KeypadProps> = ({
  onKeyPress,
  onDelete,
  onSubmit,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={styles.grid}>
      {keys.map((key) => (
        <TouchableOpacity
          key={key}
          style={[styles.keyButton, { backgroundColor: theme.card }]}
          activeOpacity={0.7}
          disabled={disabled}
          onPress={() => onKeyPress(key)}
        >
          <Text style={[styles.keyText, { color: theme.text }]}>{key}</Text>
        </TouchableOpacity>
      ))}

      {/* Delete / Backspace Key */}
      <TouchableOpacity
        style={[styles.keyButton, { backgroundColor: theme.card }]}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={onDelete}
      >
        <Ionicons name="backspace-outline" size={20} color={theme.text} />
      </TouchableOpacity>

      {/* Zero Key */}
      <TouchableOpacity
        style={[styles.keyButton, { backgroundColor: theme.card }]}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => onKeyPress('0')}
      >
        <Text style={[styles.keyText, { color: theme.text }]}>0</Text>
      </TouchableOpacity>

      {/* Submit Checkmark Key */}
      <TouchableOpacity
        style={[styles.keyButton, styles.submitKeyButton, { backgroundColor: theme.primary }]}
        activeOpacity={0.8}
        disabled={disabled}
        onPress={onSubmit}
      >
        <Ionicons name="checkmark" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  keyButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
  },
  submitKeyButton: {
    backgroundColor: '#EE5839',
  },
});