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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyPasswordResetOtp, updateUserPassword, resetPasswordForEmail } = useAuth();
  const { theme } = useTheme();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResetPassword = async () => {
    if (!token || token.length < 6) {
      setErrorMsg('Please enter the 6-digit reset code.');
      return;
    }
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
      // 1. Verify 6-digit recovery OTP
      const { error: otpError } = await verifyPasswordResetOtp(email ?? '', token.trim());
      if (otpError) throw otpError;

      // 2. Set new password
      const { error: updateError } = await updateUserPassword(newPassword);
      if (updateError) throw updateError;

      Alert.alert('Success', 'Password updated successfully! Please log in.', [
        { text: 'Log In', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setErrorMsg('');

    try {
      const { error } = await resetPasswordForEmail(email ?? '');
      if (error) {
        setErrorMsg(error.message || 'Failed to resend reset code.');
      } else {
        setCountdown(60);
        Alert.alert('Code Sent', 'A new 6-digit code has been sent to your email.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Set New Password</Text>
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        Enter the 6-digit code sent to {email} and your new password.
      </Text>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border, letterSpacing: 6 }]}
        placeholder="123456"
        placeholderTextColor={theme.muted}
        keyboardType="number-pad"
        maxLength={6}
        value={token}
        onChangeText={(val) => {
          setToken(val);
          if (errorMsg) setErrorMsg('');
        }}
        autoFocus
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
        placeholder="New password"
        placeholderTextColor={theme.muted}
        secureTextEntry
        value={newPassword}
        onChangeText={(val) => {
          setNewPassword(val);
          if (errorMsg) setErrorMsg('');
        }}
      />

      <TextInput
        style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
        placeholder="Confirm new password"
        placeholderTextColor={theme.muted}
        secureTextEntry
        value={confirmPassword}
        onChangeText={(val) => {
          setConfirmPassword(val);
          if (errorMsg) setErrorMsg('');
        }}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Update Password</Text>}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        <Text style={[styles.resendText, { color: theme.subtext }]}>Didn't receive the code? </Text>
        <TouchableOpacity onPress={handleResend} disabled={countdown > 0 || resending}>
          <Text
            style={[
              styles.resendLink,
              { color: theme.primary },
              (countdown > 0 || resending) && styles.resendDisabled,
            ]}
          >
            {resending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  input: {
    width: '100%',
    maxWidth: 320,
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 15,
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
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#D93838',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 13,
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  resendDisabled: {
    opacity: 0.5,
  },
});