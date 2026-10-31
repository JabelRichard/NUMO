import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CoachOperation, COPY } from '../../lib/coach';
import { typography } from '../../constants/typography';
import { HOME_COLORS, PICK_TINTS } from './homeColors';
import { OperationGlyph } from './OperationGlyph';

interface PickCardProps {
  operation: CoachOperation;
  /** "Easy", "Mastered", "Your levels". */
  tag: string;
  mastered: boolean;
  isDark: boolean;
  cardColor: string;
  textColor: string;
  subtleColor: string;
  onPress: () => void;
}

/** One of the small "pick your own" cards: a one-time choice for the next workout. */
export function PickCard({
  operation,
  tag,
  mastered,
  isDark,
  cardColor,
  textColor,
  subtleColor,
  onPress,
}: PickCardProps) {
  const [tintLight, tintDark] = PICK_TINTS[operation];
  const tagColor = mastered ? (isDark ? HOME_COLORS.green : HOME_COLORS.masteredText) : subtleColor;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardColor }]}
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={COPY.pickLabel(operation, tag)}
    >
      <View style={[styles.icon, { backgroundColor: isDark ? tintDark : tintLight }]}>
        <OperationGlyph type={operation} size={24} color={textColor} />
      </View>
      <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
        {COPY.pickShortName(operation)}
      </Text>
      <Text style={[styles.tag, { color: tagColor }, mastered && styles.tagMastered]} numberOfLines={1}>
        {tag}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 44,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '600',
  },
  tag: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 1,
  },
  tagMastered: {
    fontWeight: '600',
  },
});
