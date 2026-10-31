import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CoachOperation } from '../../lib/coach';

interface OperationGlyphProps {
  type: CoachOperation;
  size: number;
  color: string;
}

/** The operation's sign. Ionicons has no ÷, so division is text. */
export function OperationGlyph({ type, size, color }: OperationGlyphProps) {
  switch (type) {
    case 'addition':
      return <Ionicons name="add" size={size} color={color} />;
    case 'subtraction':
      return <Ionicons name="remove" size={size} color={color} />;
    case 'multiplication':
      return <Ionicons name="close" size={size} color={color} />;
    case 'division':
      return (
        <Text
          style={[styles.division, { color, fontSize: size, lineHeight: Math.round(size * 1.15) }]}
          allowFontScaling={false}
        >
          ÷
        </Text>
      );
    case 'mixed':
    default:
      return <Ionicons name="shuffle" size={Math.round(size * 0.92)} color={color} />;
  }
}

const styles = StyleSheet.create({
  division: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
