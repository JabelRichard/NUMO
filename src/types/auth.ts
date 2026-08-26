import { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data?: any; error: any }>;
  verifyOtp: (email: string, token: string) => Promise<{ data?: any; error: any }>;
  resendOtp: (email: string) => Promise<{ data?: any; error: any }>;
  resetPasswordForEmail: (email: string) => Promise<{ data?: any; error: any }>;
  verifyPasswordResetOtp: (email: string, token: string) => Promise<{ data?: any; error: any }>;
  updateUserPassword: (newPassword: string) => Promise<{ data?: any; error: any }>;
  signOut: () => Promise<void>;
}