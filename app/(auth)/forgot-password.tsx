import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { PALETTE } from '@/src/constants/palette';
import { typography, inputTypography } from '@/src/constants/typography';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  // Set when a reset link didn't work (see useRecoveryLinks).
  const { notice } = useLocalSearchParams<{ notice?: 'expired' | 'invalid' }>();
  const { resetPasswordForEmail } = useAuth();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendCode = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await resetPasswordForEmail(cleanEmail);

      if (error) {
        setErrorMsg(error.message || 'Failed to send reset code.');
      } else {
        router.push({
          pathname: '/(auth)/reset-password' as any,
          params: { email: cleanEmail },
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Reset Password</Text>
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        Enter your email address and we&apos;ll email you a code or link to reset your password.
      </Text>

      {notice ? (
        <View
          style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.border }]}
          accessibilityRole="alert"
        >
          <Ionicons name="time-outline" size={18} color={theme.subtext} />
          <Text style={[styles.noticeText, { color: theme.text }]}>
            {notice === 'expired'
              ? 'That reset link has expired or was already used. Enter your email to get a new one.'
              : "That reset link didn't work. Enter your email to get a new one."}
          </Text>
        </View>
      ) : null}

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="mail-outline" size={18} color={theme.subtext} style={styles.fieldIcon} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Enter your email"
          placeholderTextColor={theme.subtext}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            if (errorMsg) setErrorMsg('');
          }}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
        onPress={handleSendCode}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.buttonText}>Send Code</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        // Opened from a reset link, there is no Login screen behind this one.
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))}
        style={styles.backButton}
      >
        <Text style={[styles.backText, { color: theme.subtext }]}>Back to Login</Text>
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
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  inputWrapper: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    height: 50,
    marginBottom: 16,
  },
  fieldIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  input: {
    ...inputTypography('body'),
    flex: 1,
    paddingLeft: 42,
    paddingRight: 14,
  },
  button: {
    width: '100%',
    maxWidth: 340,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  backButton: {
    marginTop: 20,
  },
  notice: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    ...typography.secondary,
    flex: 1,
  },
  backText: {
    ...typography.button,
  },
});