import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { AuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { readStoredSession, supabase } from '../config/supabase';
import { AuthContextType, AuthState, RecoveryLinkResult } from '../types/auth';
import { flushWorkoutOutbox } from '../services/workoutService';
import { clearLocalUserData } from '../services/localDataService';
import { RecoveryLink, RESET_PASSWORD_PATH } from '../utils/authRedirect';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Set while a password reset is in progress: from a valid reset code or link until
 * the new password is saved. The user is signed in during it, but stays on the reset
 * screen. Saved on the phone so closing the app midway doesn't let them skip it.
 */
export const PASSWORD_RECOVERY_KEY = '@numo_password_recovery';

/** Where reset emails send the user: numo://reset-password (exp://…/--/reset-password in Expo Go). */
export const resetPasswordRedirectUrl = () => Linking.createURL(RESET_PASSWORD_PATH);

const isExpiredError = (error: AuthError) =>
  error.code === 'otp_expired' || /expired|invalid/i.test(error.message);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Who was signed in, so their data can be cleared when the session ends.
  const lastUserIdRef = useRef<string | null>(null);

  const setPasswordRecovery = (active: boolean) => {
    setIsPasswordRecovery(active);
    const save = active
      ? AsyncStorage.setItem(PASSWORD_RECOVERY_KEY, 'true')
      : AsyncStorage.removeItem(PASSWORD_RECOVERY_KEY);
    save.catch(() => {});
  };

  useEffect(() => {
    // 1. Initial Session Check (on App Launch / Restart)
    const initializeAuth = async () => {
      try {
        let {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!session && error && isAuthRetryableFetchError(error)) {
          // Offline with an expired access token: the refresh couldn't reach the
          // server, but the session is still saved. Use it so the app (and offline
          // workouts) keep working; the next request online refreshes it.
          session = await readStoredSession();
        } else if (error) {
          console.error('Error retrieving session:', error.message);
        }

        // A reset left unfinished last time: back to the reset screen. Without a
        // session there is nothing to finish.
        const recovering = (await AsyncStorage.getItem(PASSWORD_RECOVERY_KEY).catch(() => null)) === 'true';
        if (recovering && session) setIsPasswordRecovery(true);
        else if (recovering) setPasswordRecovery(false);

        setState({
          session,
          user: session?.user ?? null,
          isLoading: false,
        });
        lastUserIdRef.current = session?.user?.id ?? null;

        // Retry any workouts that failed to save while offline
        if (session?.user?.id) {
          void flushWorkoutOutbox(session.user.id);
        }
      } catch (err) {
        console.error('Unexpected auth initialization error:', err);
        setState({
          session: null,
          user: null,
          isLoading: false,
        });
      }
    };

    initializeAuth();

    // 2. Real-time Subscription to Supabase Auth State Changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // The first state comes from initializeAuth above. INITIAL_SESSION repeats it,
        // except offline with an expired token, where it says "no session" and
        // would sign the user out of a session that is still saved.
        if (event === 'INITIAL_SESSION') return;

        // A valid reset code (or token_hash link) signs the user in with this event.
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
        if (event === 'SIGNED_OUT') setPasswordRecovery(false);

        setState({
          session,
          user: session?.user ?? null,
          isLoading: false,
        });

        // Retry queued workouts on sign-in. Deferred because awaiting Supabase
        // calls inside onAuthStateChange can deadlock the auth client.
        const userId = session?.user?.id;
        if (userId && event === 'SIGNED_IN') {
          setTimeout(() => {
            void flushWorkoutOutbox(userId);
          }, 0);
        }

        // However the session ended (sign-out, expired session), clear that
        // person's data from the phone. Unsynced workouts are kept.
        // The same when someone else signs in on top of it (e.g. a reset link for
        // another account opened on this phone).
        const previousUserId = lastUserIdRef.current;
        const switchedUser = !!userId && !!previousUserId && userId !== previousUserId;
        if ((event === 'SIGNED_OUT' || switchedUser) && previousUserId) {
          setTimeout(() => {
            void clearLocalUserData(previousUserId);
          }, 0);
        }
        lastUserIdRef.current = userId ?? null;
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Login Function
  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error };
  };

  // Signup Function (Triggers 6-digit code to email)
  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });
    return { data, error };
  };

  // Verify 6-digit OTP Token Function (Signup)
  const verifyOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'signup',
    });
    return { data, error };
  };

  // Resend 6-digit OTP Token Function (Signup)
  const resendOtp = async (email: string) => {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    return { data, error };
  };

  // 1. Send the reset email. It holds a 6-digit code and/or a link, depending on the
  // Supabase email template; a link opens redirectTo in the app.
  const resetPasswordForEmail = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: resetPasswordRedirectUrl(),
    });
    return { data, error };
  };

  /**
   * Opens a reset link: signs in with it and starts recovery, so the user lands on
   * "set new password" and stays there. Recovery is set before the session exists,
   * so nothing routes them to Home in between.
   */
  const openRecoveryLink = async (link: RecoveryLink): Promise<RecoveryLinkResult> => {
    if (link.kind === 'error') return { ok: false, reason: link.reason };

    setPasswordRecovery(true);
    const { error } =
      link.kind === 'session'
        ? await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
        : await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: 'recovery' });

    if (error) {
      setPasswordRecovery(false);
      return { ok: false, reason: isExpiredError(error) ? 'expired' : 'invalid' };
    }
    return { ok: true };
  };

  /** The new password is saved: recovery is over and the app opens normally. */
  const finishPasswordRecovery = () => setPasswordRecovery(false);

  // 2. Verify Password Reset 6-Digit Code
  const verifyPasswordResetOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'recovery',
    });
    return { data, error };
  };

  // 3. Update Password
  const updateUserPassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  };

  // Logout Function. Clears this person's data from the phone; unsynced workouts
  // are kept unless discardUnsynced is set (e.g. the account was deleted).
  // scope 'local' signs out this phone only (default: every device).
  const signOut = async (options?: { discardUnsynced?: boolean; scope?: 'global' | 'local' }) => {
    const userId = state.session?.user?.id ?? lastUserIdRef.current;
    setPasswordRecovery(false);
    try {
      await supabase.auth.signOut({ scope: options?.scope ?? 'global' });
    } finally {
      if (userId) await clearLocalUserData(userId, options);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isPasswordRecovery,
        openRecoveryLink,
        finishPasswordRecovery,
        signInWithPassword,
        signUp,
        verifyOtp,
        resendOtp,
        resetPasswordForEmail,
        verifyPasswordResetOtp,
        updateUserPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};