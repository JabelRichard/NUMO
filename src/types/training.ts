import { Ionicons } from '@expo/vector-icons';

export interface TrainingProgram {
  id: string;
  title: string;
  subtitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  symbol?: string;
  progress?: number;
  iconBgColor?: string;
  isLocked?: boolean;
}