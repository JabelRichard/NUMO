import { Session, User } from '@supabase/supabase-js';
import type { RecoveryLink } from '../utils/authRedirect';

export type RecoveryLinkResult = { ok: true } | { ok: false; reason: 'expired' | 'invalid' };

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  /** A password reset is in progress: keep the user on the reset screen until it's saved. */
  isPasswordRecovery: boolean;
  /** Signs in with a reset link and starts recovery. */
  openRecoveryLink: (link: RecoveryLink) => Promise<RecoveryLinkResult>;
  /** Ends recovery once the new password is saved. */
  finishPasswordRecovery: () => void;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data?: any; error: any }>;
  verifyOtp: (email: string, token: string) => Promise<{ data?: any; error: any }>;
  resendOtp: (email: string) => Promise<{ data?: any; error: any }>;
  resetPasswordForEmail: (email: string) => Promise<{ data?: any; error: any }>;
  verifyPasswordResetOtp: (email: string, token: string) => Promise<{ data?: any; error: any }>;
  updateUserPassword: (newPassword: string) => Promise<{ data?: any; error: any }>;
  /** Also clears this person's data from the phone; unsynced workouts are kept unless discardUnsynced. */
  signOut: (options?: { discardUnsynced?: boolean; scope?: 'global' | 'local' }) => Promise<void>;
}