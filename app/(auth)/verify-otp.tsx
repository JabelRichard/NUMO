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

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp, resendOtp } = useAuth();
  const { theme } = useTheme();

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(60);

  // 60-second countdown for resend button
useEffect(() => {
  let timer: ReturnType<typeof setTimeout>;
  if (countdown > 0) {
    timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
  }
  return () => clearTimeout(timer);
}, [countdown]);

  const handleVerify = async () => {
    if (!token || token.length < 6) {
      setErrorMsg('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await verifyOtp(email ?? '', token.trim());

      if (error) {
        setErrorMsg(error.message || 'Invalid or expired code.');
      } else {
        Alert.alert('Verified!', 'Your account has been confirmed.', [
          { text: 'Continue', onPress: () => router.replace('/(app)') },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    setErrorMsg('');

    try {
      const { error } = await resendOtp(email ?? '');

      if (error) {
        setErrorMsg(error.message || 'Failed to resend code.');
      } else {
        setCountdown(60);
        Alert.alert('Code Sent', 'A new 6-digit code has been sent to your email.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not resend verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Enter Verification Code</Text>
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        We sent a 6-digit code to {email}
      </Text>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
        ]}
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

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify Code</Text>}
      </TouchableOpacity>

      {/* Resend Section */}
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
            {resending
              ? 'Sending...'
              : countdown > 0
              ? `Resend in ${countdown}s`
              : 'Resend Code'}
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
    marginBottom: 24,
  },
  input: {
    width: '100%',
    maxWidth: 240,
    height: 56,
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    maxWidth: 240,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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