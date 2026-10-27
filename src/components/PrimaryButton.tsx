import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { typography } from '@/src/constants/typography';
import { PALETTE } from '@/src/constants/palette';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  icon,
  style,
  textStyle,
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.button,
        {
          backgroundColor: theme.primary,
          shadowColor: theme.primary,
        },
        style,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: PALETTE.primary,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
    shadowColor: PALETTE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  text: {
    ...typography.button,
    color: PALETTE.onPrimary,
  },
});