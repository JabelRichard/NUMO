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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { AuthBackground } from '../../src/components/AuthBackground';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const { source, fromDemo } = useLocalSearchParams<{ source?: string; fromDemo?: string }>();

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

    try {
      const { error } = await signUp(email.trim().toLowerCase(), password, fullName.trim());

      if (error) {
        // Intercept and cleanly format duplicate email or rate limit errors from Supabase
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
      } else {
        Alert.alert(
          'Account Created',
          'Your account has been created successfully! Please check your email for a confirmation link before logging in.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AuthBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 16, 40),
              paddingBottom: Math.max(insets.bottom + 24, 32),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Subtle NUMO Brand Pill */}
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>NUMO</Text>
            </View>
          </View>

          {/* Dynamic Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isFromDemo ? 'Save your progress' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {isFromDemo
                ? 'Create a free account to keep your results, track your progress, and build your streak.'
                : 'Save your progress and keep improving every day.'}
            </Text>
          </View>

          {/* Error Message Box */}
          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={18} color="#D93838" style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#8E8E93"
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
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#8E8E93"
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
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
                <TextInput
                  style={[styles.input, styles.inputPasswordPadding]}
                  placeholder="Create a password"
                  placeholderTextColor="#8E8E93"
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
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {passwordStrength && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBarBackground}>
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
                  <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#8E8E93" style={styles.fieldIcon} />
                <TextInput
                  style={[styles.input, styles.inputPasswordPadding]}
                  placeholder="Confirm your password"
                  placeholderTextColor="#8E8E93"
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
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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

          {/* Footer: Route to Login */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
              <Text style={styles.linkText}>Log in</Text>
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
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
 brandRow: {
  alignItems: 'center', // centers the badge horizontally
  marginBottom: 84,
},
brandBadge: {
  backgroundColor: 'rgba(236, 103, 60, 0.12)',
  paddingHorizontal: 12,
  paddingVertical: 5,
  borderRadius: 12,
  alignItems: 'center',
},
  brandBadgeText: {
    color: '#EC673C',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#636366',
    marginTop: 6,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F8C8C8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
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
    gap: 14,
  },
  inputGroup: {
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: '#1C1C1E',
    marginBottom: 6,
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
    height: 50,
    paddingLeft: 42,
    paddingRight: 16,
    fontSize: 15,
    fontWeight: '400',
    color: '#1C1C1E',
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
    marginTop: 6,
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
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 20,
    shadowColor: '#EC673C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
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
  },
  footerText: {
    color: '#636366',
    fontSize: 14,
    fontWeight: '500',
  },
  linkText: {
    color: '#EC673C',
    fontSize: 14,
    fontWeight: '700',
  },
});