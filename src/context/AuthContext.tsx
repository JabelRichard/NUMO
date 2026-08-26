import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { AuthContextType, AuthState } from '../types/auth';
import { syncPendingDemoWorkout } from '../services/workoutService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

  useEffect(() => {
    // 1. Initial Session Check (on App Launch / Restart)
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          console.error('Error retrieving session:', error.message);
        }

        setState({
          session,
          user: session?.user ?? null,
          isLoading: false,
        });

        // Sync pending demo if already logged in or session restored
        if (session?.user?.id) {
          await syncPendingDemoWorkout(session.user.id);
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
      async (event, session) => {
        setState({
          session,
          user: session?.user ?? null,
          isLoading: false,
        });

        // Sync pending demo workout as soon as user signs up or logs in
        if (session?.user?.id && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          await syncPendingDemoWorkout(session.user.id);
        }
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

  // 1. Send Password Reset 6-Digit Code
  const resetPasswordForEmail = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );
    return { data, error };
  };

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

  // Logout Function
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
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