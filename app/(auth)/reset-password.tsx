import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/src/config/supabase';
import { PALETTE } from '@/src/constants/palette';
import { typography, inputTypography } from '@/src/constants/typography';

/** Supabase errors in plain words. */
function resetErrorText(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case 'otp_expired':
      return "That code has expired or isn't right. Check the newest email, or send a new code.";
    case 'same_password':
      return 'Choose a password that is different from your old one.';
    case 'weak_password':
      return error.message || 'Choose a stronger password.';
    case 'over_email_send_rate_limit':
      return 'Too many emails sent. Please wait a minute and try again.';
    default:
      return error.message || 'Something went wrong. Please try again.';
  }
}

/**
 * Reset password, in steps:
 *  1. Code: the 6-digit code from the email (arriving from "Forgot password").
 *     A valid code signs the user in and starts recovery.
 *  2. New password: shown once recovery has started, by a code or a reset link.
 *     The user stays here (useProtectedRoute) until the new password is saved,
 *     then lands in the app, signed in. Cancel signs out instead.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const {
    session,
    isPasswordRecovery,
    verifyPasswordResetOtp,
    updateUserPassword,
    resetPasswordForEmail,
    finishPasswordRecovery,
    signOut,
  } = useAuth();
  const { theme } = useTheme();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const email = session?.user?.email ?? emailParam ?? '';
  const step: 'opening' | 'password' | 'code' = isPasswordRecovery
    ? session
      ? 'password'
      : 'opening'
    : 'code';

  // An error belongs to the step it happened on, so it's gone when the step changes.
  const [error, setError] = useState<{ step: typeof step; text: string } | null>(null);
  const errorMsg = error?.step === step ? error.text : '';
  const setErrorMsg = (text: string) => setError(text ? { step, text } : null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Step 1: a valid code signs in and starts recovery; the screen moves to step 2.
  const handleVerifyCode = async () => {
    if (token.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit code from the email.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await verifyPasswordResetOtp(email, token.trim());
      if (error) setErrorMsg(resetErrorText(error));
    } catch (err: any) {
      setErrorMsg(resetErrorText(err ?? {}));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: save the new password. Only then does the app open.
  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await updateUserPassword(newPassword);
      if (error) {
        setErrorMsg(resetErrorText(error));
        return;
      }
      // Whoever knew the old password may still be signed in elsewhere: sign out
      // every other device. This phone stays signed in.
      supabase.auth.signOut({ scope: 'others' }).catch(() => {});

      finishPasswordRecovery();
      router.replace('/(app)');
      Alert.alert('Password updated', "You're signed in with your new password. Other devices were signed out.");
    } catch (err: any) {
      setErrorMsg(resetErrorText(err ?? {}));
    } finally {
      setLoading(false);
    }
  };

  // Leaving without a new password: sign out of this phone (the reset signed them in).
  const handleCancel = async () => {
    try {
      await signOut({ scope: 'local' });
    } finally {
      router.replace('/(auth)/login');
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending || !email) return;
    setResending(true);
    setErrorMsg('');
    try {
      const { error } = await resetPasswordForEmail(email);
      if (error) {
        setErrorMsg(resetErrorText(error));
      } else {
        setCountdown(60);
        Alert.alert('Email sent', `We sent a new reset code to ${email}.`);
      }
    } catch (err: any) {
      setErrorMsg(resetErrorText(err ?? {}));
    } finally {
      setResending(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }];
  const errorText = errorMsg ? (
    <Text style={styles.errorText} accessibilityRole="alert">
      {errorMsg}
    </Text>
  ) : null;

  if (step === 'opening') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primaryText} />
        <Text style={[styles.subtitle, { color: theme.subtext, marginTop: 16 }]}>Opening your reset link…</Text>
      </View>
    );
  }

  if (step === 'password') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          Set a new password
        </Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          {email ? `Choose a new password for ${email}.` : 'Choose a new password.'}
        </Text>

        {errorText}

        <TextInput
          style={inputStyle}
          placeholder="New password (at least 6 characters)"
          placeholderTextColor={theme.subtext}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          value={newPassword}
          onChangeText={(val) => {
            setNewPassword(val);
            if (errorMsg) setErrorMsg('');
          }}
          autoFocus
        />
        <TextInput
          style={inputStyle}
          placeholder="Confirm new password"
          placeholderTextColor={theme.subtext}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          value={confirmPassword}
          onChangeText={(val) => {
            setConfirmPassword(val);
            if (errorMsg) setErrorMsg('');
          }}
          onSubmitEditing={handleSavePassword}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
          onPress={handleSavePassword}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.buttonText}>Save new password</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCancel} disabled={loading} style={styles.linkButton} accessibilityRole="button">
          <Text style={[styles.linkText, { color: theme.subtext }]}>Cancel and sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Step 1: the code. Without an email (e.g. opened directly), start from "Forgot password".
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        Reset your password
      </Text>
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        {email
          ? `Enter the 6-digit code we sent to ${email}, or tap the link in that email.`
          : 'Request a reset email first, then come back here.'}
      </Text>

      {errorText}

      {email ? (
        <>
          <TextInput
            style={[inputStyle, { letterSpacing: 6 }]}
            placeholder="123456"
            placeholderTextColor={theme.subtext}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={token}
            onChangeText={(val) => {
              setToken(val);
              if (errorMsg) setErrorMsg('');
            }}
            onSubmitEditing={handleVerifyCode}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={[styles.resendText, { color: theme.subtext }]}>Didn&apos;t get it? </Text>
            <TouchableOpacity onPress={handleResend} disabled={countdown > 0 || resending} accessibilityRole="button">
              <Text
                style={[
                  styles.resendLink,
                  { color: theme.primaryText },
                  (countdown > 0 || resending) && styles.resendDisabled,
                ]}
              >
                {resending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Send a new code'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => router.replace('/(auth)/forgot-password')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Get a reset email</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.linkButton} accessibilityRole="button">
        <Text style={[styles.linkText, { color: theme.subtext }]}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.screenTitle,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.secondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  input: {
    ...inputTypography('body'),
    width: '100%',
    maxWidth: 320,
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    maxWidth: 320,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.button,
    color: PALETTE.onPrimary,
  },
  errorText: {
    ...typography.secondary,
    color: '#D93838',
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: 320,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    ...typography.secondary,
  },
  resendLink: {
    ...typography.secondary,
    fontWeight: '600',
  },
  resendDisabled: {
    opacity: 0.5,
  },
  linkButton: {
    marginTop: 20,
  },
  linkText: {
    ...typography.button,
  },
});
