import { OperationType } from '../lib/math/types';

export function formatQuestionGoal(count: number): string {
  return `${count} questions`;
}

export function formatDurationGoal(minutes: number): string {
  return `${minutes} min`;
}

export function formatFrequencyGoal(days: number): string {
  if (days >= 7) return 'Every day';
  return `${days} days a week`;
}

const OPERATION_NAMES: Record<OperationType, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  mixed: 'Mixed',
};

/** "mixed" → "Mixed", "multiplication" → "Multiplication". */
export function formatOperationName(operation: string | null | undefined): string {
  if (!operation) return 'Workout';
  return (
    OPERATION_NAMES[operation as OperationType] ??
    operation.charAt(0).toUpperCase() + operation.slice(1)
  );
}

export function formatRelativeSessionDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
