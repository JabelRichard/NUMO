import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { flushWorkoutOutbox } from '../services/workoutService';
import { isOfflineState } from './useOnlineStatus';

/**
 * Uploads workouts saved offline as soon as it can: when the connection comes back
 * and when the app returns to the foreground, whatever screen is open. Screens also
 * upload when they load; concurrent attempts share one run.
 */
export function useWorkoutAutoSync(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const sync = () => void flushWorkoutOutbox(userId);

    let wasOffline = false;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const offline = isOfflineState(state);
      if (wasOffline && !offline) sync();
      wasOffline = offline;
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });

    return () => {
      unsubscribeNet();
      appState.remove();
    };
  }, [userId]);
}
