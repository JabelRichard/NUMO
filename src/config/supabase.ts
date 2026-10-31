import { createClient, Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Custom storage adapter using Expo SecureStore for Native and localStorage for Web
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * The session saved on this device, read without trying to refresh it. Offline with
 * an expired access token, getSession() can't refresh and reports no session, even
 * though this saved one (and its refresh token) is still valid for later.
 * Null when nothing usable is saved.
 */
export async function readStoredSession(): Promise<Session | null> {
  try {
    // The key the auth client saves under (by default sb-<project ref>-auth-token).
    const key = (supabase.auth as unknown as { storageKey: string }).storageKey;
    const raw = await ExpoSecureStoreAdapter.getItem(key);
    const stored = raw ? JSON.parse(raw) : null;
    return stored?.access_token && stored?.refresh_token && stored?.user ? (stored as Session) : null;
  } catch {
    return null;
  }
}