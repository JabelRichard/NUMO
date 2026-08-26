import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
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
        Enter your email address and we'll send you a 6-digit code to reset your password.
      </Text>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="mail-outline" size={18} color={theme.muted} style={styles.fieldIcon} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Enter your email"
          placeholderTextColor={theme.muted}
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
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send Code</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
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
    flex: 1,
    paddingLeft: 42,
    paddingRight: 14,
    fontSize: 15,
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
  backButton: {
    marginTop: 20,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
});