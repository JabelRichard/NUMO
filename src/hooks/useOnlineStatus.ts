import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function isOfflineState(state: NetInfoState): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

/**
 * Tracks connectivity via NetInfo.
 * - `onReconnect` fires when the connection comes back after being offline.
 * - `recheck` re-queries NetInfo (for "Retry" buttons) and resolves to true when online.
 * - `setIsOffline` lets screens flag offline when a request fails with a network error.
 */
export function useOnlineStatus(onReconnect?: () => void) {
  const [isOffline, setIsOffline] = useState(false);
  const wasOfflineRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const applyState = useCallback((offline: boolean) => {
    const reconnected = wasOfflineRef.current && !offline;
    wasOfflineRef.current = offline;
    setIsOffline(offline);
    if (reconnected) onReconnectRef.current?.();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      applyState(isOfflineState(state));
    });
    return () => unsubscribe();
  }, [applyState]);

  const recheck = useCallback(async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    const offline = isOfflineState(state);
    wasOfflineRef.current = offline;
    setIsOffline(offline);
    return !offline;
  }, []);

  const markOffline = useCallback((offline: boolean) => {
    wasOfflineRef.current = offline;
    setIsOffline(offline);
  }, []);

  return { isOffline, setIsOffline: markOffline, recheck };
}
