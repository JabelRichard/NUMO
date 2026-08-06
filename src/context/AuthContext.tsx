import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { AuthContextType, AuthState } from '../types/auth';

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
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error retrieving session:', error.message);
        }
        setState({
          session,
          user: session?.user ?? null,
          isLoading: false,
        });
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
      (_event, session) => {
        setState({
          session,
          user: session?.user ?? null,
          isLoading: false,
        });
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

  // Signup Function
  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });
    return { error };
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