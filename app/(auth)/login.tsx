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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { AuthBackground } from '../../src/components/AuthBackground';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword } = useAuth();

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
    if (!emailRegex.test(email)) {
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
    if (!validateForm()) return;

    setLoading(true);
    setErrorMsg('');

    const { error } = await signInWithPassword(email, password);

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <AuthBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Login</Text>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#A0A0A0"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { paddingRight: 40 }]}
                placeholder="Enter your email password"
                placeholderTextColor="#A0A0A0"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#7E7E7E"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forget password</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or Login with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Icons Placeholder */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialCircle}>
              <Text style={styles.socialIconText}></Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialCircle}>
              <Text style={[styles.socialIconText, { color: '#EA4335' }]}>G</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialCircle}>
              <Text style={[styles.socialIconText, { color: '#1877F2' }]}>f</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation to Signup */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don’t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.linkText}>Sign up</Text>
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
    backgroundColor: '#EBEBEB',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 120,
    paddingBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#000',
    marginBottom: 32,
  },
  errorText: {
    color: '#D93838',
    marginBottom: 16,
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#F2F2F2',
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#000',
  },
  eyeIcon: {
    position: 'absolute',
    right: 18,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: '#EE5839',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#EE5839',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    shadowColor: '#EE5839',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#BCBCBC',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#828282',
    fontSize: 14,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 36,
  },
  socialCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E4E4E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#828282',
    fontSize: 14,
  },
  linkText: {
    color: '#EE5839',
    fontSize: 14,
    fontWeight: '600',
  },
});