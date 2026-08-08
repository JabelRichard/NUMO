import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { useProtectedRoute } from '../src/hooks/useProtectedRoute';

// Import math engine test runner
import { runMathEngineTests } from '../src/lib/math/generatorTest';

// Execute test suite on boot in development mode
if (__DEV__) {
  runMathEngineTests();
}

function RootLayoutNav() {
  const { isLoading } = useAuth();
  
  // Attach the automated routing listener
  useProtectedRoute();

  // Prevent flash of unauthorized content while checking session state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EE5839" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EBEBEB',
  },
});