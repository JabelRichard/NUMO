import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { AuthBackground } from '../../src/components/AuthBackground';
import { useTheme } from '@/src/context/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { signInWithPassword } = useAuth();
  const { theme } = useTheme();

  const isCompact = height < 720;
  const isNarrow = width < 360;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const validateForm = () => {
    if (!email.trim()) {
      setErrorMsg('Email field is required.');
      return false;
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMsg('Password is required.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm() || loading) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await signInWithPassword(email.trim().toLowerCase(), password);

      if (error) {
        setErrorMsg(error.message || 'Invalid email or password.');
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <AuthBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + (isCompact ? 12 : 24), 20),
              paddingBottom: Math.max(insets.bottom + 16, 20),
              paddingHorizontal: isNarrow ? 18 : 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.formContainer}>
            {/* NUMO Brand Badge */}
            <View style={[styles.brandRow, isCompact && styles.brandRowCompact]}>
              <View
                style={[
                  styles.brandBadge,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(238, 88, 57, 0.2)'
                      : 'rgba(238, 88, 57, 0.12)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.brandBadgeText,
                    { color: theme.primary },
                    isCompact && styles.brandBadgeTextCompact,
                  ]}
                >
                  NUMO
                </Text>
              </View>
            </View>

            {/* Header */}
            <View style={[styles.header, isCompact && styles.headerCompact]}>
              <Text
                style={[
                  styles.title,
                  { color: theme.text },
                  isCompact && styles.titleCompact,
                ]}
              >
                Welcome back
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.subtext },
                  isCompact && styles.subtitleCompact,
                ]}
              >
                Log in to continue your training.
              </Text>
            </View>

            {/* Error Message Box */}
            {errorMsg ? (
              <View
                style={[
                  styles.errorContainer,
                  {
                    backgroundColor: theme.isDark ? 'rgba(217, 56, 56, 0.18)' : '#FDECEC',
                    borderColor: theme.isDark ? 'rgba(217, 56, 56, 0.35)' : '#F8C8C8',
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#D93838"
                  style={styles.errorIcon}
                />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Form Fields */}
            <View style={[styles.form, isCompact && styles.formCompact]}>
              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={theme.muted}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: theme.text },
                      isCompact && styles.inputCompact,
                    ]}
                    placeholder="Enter your email"
                    placeholderTextColor={theme.muted}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (errorMsg) setErrorMsg('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={theme.muted}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      styles.inputPasswordPadding,
                      { color: theme.text },
                      isCompact && styles.inputCompact,
                    ]}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (errorMsg) setErrorMsg('');
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                style={styles.forgotButton}
                activeOpacity={0.7}
                onPress={() => router.push('/(auth)/forgot-password' as any)}
              >
                <Text style={[styles.forgotText, { color: theme.primary }]}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.primary, shadowColor: theme.primary },
                isCompact && styles.submitButtonCompact,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Bottom Navigation */}
            <View style={[styles.footerRow, isCompact && styles.footerRowCompact]}>
              <Text style={[styles.footerText, { color: theme.subtext }]}>
                Don’t have an account?{' '}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/signup')}
                activeOpacity={0.7}
              >
                <Text style={[styles.linkText, { color: theme.primary }]}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6E6E6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 20,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandRowCompact: {
    marginBottom: 16,
  },
  brandBadge: {
    backgroundColor: 'rgba(238, 88, 57, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
  },
  brandBadgeText: {
    color: '#EE5839',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  brandBadgeTextCompact: {
    fontSize: 20,
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerCompact: {
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#636366',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  subtitleCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F8C8C8',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    color: '#D93838',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  form: {
    gap: 12,
  },
  formCompact: {
    gap: 8,
  },
  inputGroup: {
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 5,
    marginLeft: 4,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E2E7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 52,
    paddingLeft: 48,
    paddingRight: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  inputCompact: {
    height: 46,
    fontSize: 14,
  },
  inputPasswordPadding: {
    paddingRight: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    padding: 6,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -2,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  forgotText: {
    color: '#EE5839',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#EE5839',
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#EE5839',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonCompact: {
    minHeight: 46,
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  footerRowCompact: {
    marginTop: 12,
  },
  footerText: {
    color: '#636366',
    fontSize: 13,
    fontWeight: '500',
  },
  linkText: {
    color: '#EE5839',
    fontSize: 13,
    fontWeight: '800',
  },
});