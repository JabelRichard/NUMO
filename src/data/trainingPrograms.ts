import { TrainingProgram } from '../types/training';

export const CORE_PROGRAMS: TrainingProgram[] = [
  {
    id: 'addition',
    title: 'Addition',
    symbol: '+',
    progress: 0,
    iconBgColor: '#AFA2FE',
    isLocked: false,
  },
  {
    id: 'subtraction',
    title: 'Subtraction',
    symbol: '−',
    progress: 0,
    iconBgColor: '#F6FE91',
    isLocked: false,
  },
  {
    id: 'multiplication',
    title: 'Multiplication',
    symbol: '×',
    progress: 0,
    iconBgColor: '#EC673C',
    isLocked: false,
  },
  {
    id: 'division',
    title: 'Division',
    symbol: '÷',
    progress: 0,
    iconBgColor: '#C4B5FD',
    isLocked: false,
  },
  {
    id: 'mixed',
    title: 'Mixed Challenge',
    iconName: 'shuffle',
    progress: 0,
    iconBgColor: '#EE5839',
    isLocked: false,
  },
];

export const FUTURE_PROGRAMS: TrainingProgram[] = [
  {
    id: 'speed_challenge',
    title: 'Speed Challenge',
    subtitle: 'Time attack mode for high precision under pressure',
    iconName: 'flash-outline',
    isLocked: true,
  },
  {
    id: 'memory_training',
    title: 'Memory Training',
    subtitle: 'Retain equations and sequence chains in working memory',
    iconName: 'shapes-outline',
    isLocked: true,
  },
  {
    id: 'competition_mode',
    title: 'Competition Mode',
    subtitle: 'Real-time 1v1 online mental math duels',
    iconName: 'trophy-outline',
    isLocked: true,
  },
  {
    id: 'ai_coach',
    title: 'AI Coach',
    subtitle: 'Targeted drills generated dynamically for weak points',
    iconName: 'sparkles-outline',
    isLocked: true,
  },
];