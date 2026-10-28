import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDayKey } from '../utils/localDates';

/**
 * Today's local date. Updates at midnight while the screen is open, and when the app
 * comes back to the foreground on a new day.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refresh = () =>
      setToday((current) => (localDayKey(current) === localDayKey(new Date()) ? current : new Date()));

    const nextMidnight = new Date(today);
    nextMidnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(refresh, nextMidnight.getTime() - Date.now());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
