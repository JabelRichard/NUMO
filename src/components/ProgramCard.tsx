import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrainingProgram } from '../types/training';
import { useTheme } from '@/src/context/ThemeContext';

interface ProgramCardProps {
  program: TrainingProgram;
  onPress?: () => void;
  showDivider?: boolean;
}

export const ProgramCard: React.FC<ProgramCardProps> = ({
  program,
  onPress,
  showDivider = false,
}) => {
  const { theme } = useTheme();
  const { title, subtitle, symbol, iconName, progress, iconBgColor, isLocked } = program;

  return (
    <TouchableOpacity
      activeOpacity={isLocked ? 1 : 0.7}
      onPress={isLocked ? undefined : onPress}
      style={[styles.container, isLocked && styles.lockedContainer]}
    >
      <View style={styles.contentRow}>
        {/* Left Icon / Symbol Badge */}
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: isLocked
                ? theme.isDark
                  ? '#2C2C2E'
                  : '#E5E5EA'
                : iconBgColor || theme.primary,
            },
          ]}
        >
          {symbol ? (
            <Text
              style={[
                styles.symbolText,
                { color: theme.text },
                isLocked && { color: theme.muted },
              ]}
            >
              {symbol}
            </Text>
          ) : (
            <Ionicons
              name={iconName || 'help-outline'}
              size={20}
              color={isLocked ? theme.muted : theme.text}
            />
          )}
        </View>

        {/* Title and Subtitle Info */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: theme.text },
              isLocked && { color: theme.muted },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.muted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right Side: Progress % or Lock Badge */}
        {isLocked ? (
          <View
            style={[
              styles.lockBadge,
              { backgroundColor: theme.isDark ? '#2C2C2E' : '#E5E5EA' },
            ]}
          >
            <Ionicons name="lock-closed" size={14} color={theme.muted} />
            <Text style={[styles.lockText, { color: theme.muted }]}>SOON</Text>
          </View>
        ) : (
          <Text style={[styles.progressText, { color: theme.text }]}>
            {progress && progress > 0 ? `${progress}%` : 'Not started'}
          </Text>
        )}
      </View>

      {showDivider ? (
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lockedContainer: {
    opacity: 0.65,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  symbolText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  lockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginTop: 14,
  },
});