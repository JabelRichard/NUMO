import React, { useState, useMemo } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { AuthBackground } from '../../src/components/AuthBackground';
import { useTheme } from '@/src/context/ThemeContext';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { signUp } = useAuth();
  const { theme } = useTheme();
  const { source, fromDemo } = useLocalSearchParams<{ source?: string; fromDemo?: string }>();

  const isCompact = height < 720;
  const isNarrow = width < 360;
  const isFromDemo = source === 'demo' || fromDemo === 'true';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) return { label: 'Weak', color: '#FF3B30', progress: 0.33 };

    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (password.length >= 8 && hasLetters && hasNumbers && hasSpecial) {
      return { label: 'Strong', color: '#34C759', progress: 1 };
    }
    if (password.length >= 6 && hasLetters && hasNumbers) {
      return { label: 'Medium', color: '#FF9500', progress: 0.66 };
    }
    return { label: 'Weak', color: '#FF3B30', progress: 0.33 };
  }, [password]);

  const validateForm = () => {
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return false;
    }
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleSignup = async () => {
    if (!validateForm() || loading) return;

    setLoading(true);
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    try {
      const { data, error } = await signUp(cleanEmail, password, cleanFullName);

      // 1. Check explicit Supabase error return
      if (error) {
        const lowerMsg = (error.message || '').toLowerCase();
        if (
          lowerMsg.includes('already registered') ||
          lowerMsg.includes('user already exists') ||
          lowerMsg.includes('email already in use')
        ) {
          setErrorMsg('An account with this email already exists. Please log in.');
        } else {
          setErrorMsg(error.message || 'Failed to create account. Please try again.');
        }
        return;
      }

      // 2. Client-side check for existing email (Supabase returns empty identities array for existing users)
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setErrorMsg('An account with this email already exists. Please log in.');
        return;
      }

      // 3. New valid user -> route to 6-digit OTP confirmation screen
      router.push({
        pathname: '/(auth)/verify-otp' as any,
        params: { email: cleanEmail },
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
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
              paddingTop: Math.max(insets.top + (isCompact ? 10 : 20), 16),
              paddingBottom: Math.max(insets.bottom + 16, 20),
              paddingHorizontal: isNarrow ? 18 : 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.formContainer}>
            {/* Top Brand Pill */}
            <View style={[styles.brandRow, isCompact && styles.brandRowCompact]}>
              <View
                style={[
                  styles.brandBadge,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(238, 88, 57, 0.2)'
                      : 'rgba(236, 103, 60, 0.12)',
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
              <Text style={[styles.title, { color: theme.text }, isCompact && styles.titleCompact]}>
                {isFromDemo ? 'Save your progress' : 'Create your account'}
              </Text>
              <Text
                style={[styles.subtitle, { color: theme.subtext }, isCompact && styles.subtitleCompact]}
              >
                {isFromDemo
                  ? 'Create a free account to keep your results, track your progress, and build your streak.'
                  : 'Save your progress and keep improving every day.'}
              </Text>
            </View>

            {/* Error Container */}
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

            {/* Inputs Form */}
            <View style={[styles.form, isCompact && styles.formCompact]}>
              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Full name</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={theme.muted}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text }, isCompact && styles.inputCompact]}
                    placeholder="Enter your full name"
                    placeholderTextColor={theme.muted}
                    value={fullName}
                    onChangeText={(val) => {
                      setFullName(val);
                      if (errorMsg) setErrorMsg('');
                    }}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Email Address */}
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
                    size={18}
                    color={theme.muted}
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text }, isCompact && styles.inputCompact]}
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

              {/* Password */}
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
                    size={18}
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
                    placeholder="Create a password"
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
                      size={18}
                      color={theme.muted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Password Strength Indicator */}
                {passwordStrength && (
                  <View style={styles.strengthContainer}>
                    <View
                      style={[
                        styles.strengthBarBackground,
                        {
                          backgroundColor: theme.isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : '#E5E5EA',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.strengthBarFill,
                          {
                            width: `${passwordStrength.progress * 100}%`,
                            backgroundColor: passwordStrength.color,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.strengthLabel, { color: passwordStrength.color }]}
                    >
                      {passwordStrength.label}
                    </Text>
                  </View>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Confirm password</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
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
                    placeholder="Confirm your password"
                    placeholderTextColor={theme.muted}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (errorMsg) setErrorMsg('');
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={theme.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.primary, shadowColor: theme.primary },
                isCompact && styles.submitButtonCompact,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Link */}
          <View style={[styles.footerRow, isCompact && styles.footerRowCompact]}>
            <Text style={[styles.footerText, { color: theme.subtext }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
              <Text style={[styles.linkText, { color: theme.primary }]}>Log in</Text>
            </TouchableOpacity>
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
    marginBottom: 30,
  },
  brandRowCompact: {
    marginBottom: 10,
  },
  brandBadge: {
    backgroundColor: 'rgba(236, 103, 60, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
  },
  brandBadgeText: {
    color: '#EC673C',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  brandBadgeTextCompact: {
    fontSize: 20,
    letterSpacing: 1,
  },
  header: {
    marginBottom: 18,
    alignItems: 'center',
  },
  headerCompact: {
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    lineHeight: 32,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    color: '#636366',
    marginTop: 4,
    lineHeight: 18,
    textAlign: 'center',
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    lineHeight: 17,
  },
  form: {
    gap: 10,
  },
  formCompact: {
    gap: 6,
  },
  inputGroup: {
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
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
    left: 14,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 48,
    paddingLeft: 42,
    paddingRight: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  inputCompact: {
    height: 44,
    fontSize: 14,
  },
  inputPasswordPadding: {
    paddingRight: 46,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    padding: 6,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 4,
    gap: 8,
  },
  strengthBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 50,
    textAlign: 'right',
  },
  submitButton: {
    backgroundColor: '#EC673C',
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#EC673C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonCompact: {
    minHeight: 46,
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingBottom: 4,
  },
  footerRowCompact: {
    marginTop: 10,
  },
  footerText: {
    color: '#636366',
    fontSize: 13,
    fontWeight: '500',
  },
  linkText: {
    color: '#EC673C',
    fontSize: 13,
    fontWeight: '700',
  },
});