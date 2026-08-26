import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { useTheme } from '@/src/context/ThemeContext';

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => {
  const { theme } = useTheme();

  return (
    <GlassCard style={styles.card} intensity={40}>
      <View style={styles.row}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
      </View>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  icon: {
    fontSize: 20,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});