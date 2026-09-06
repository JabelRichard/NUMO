import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { useProtectedRoute } from '../src/hooks/useProtectedRoute';
import { AppSplashScreen } from '../src/components/AppSplashScreen';

// Import math engine test runner
import { runMathEngineTests } from '../src/lib/math/generatorTest';

if (__DEV__) {
  runMathEngineTests();
}

function RootLayoutNav() {
  const { isLoading } = useAuth();
  const { theme } = useTheme();

  const [minSplashDone, setMinSplashDone] = useState(false);
  const [forceDismiss, setForceDismiss] = useState(false);

  useEffect(() => {
    // 1. Splash visible for minimum 1.8s
    const minTimer = setTimeout(() => {
      setMinSplashDone(true);
    }, 1800);

    // 2. Fallback timeout
    const safetyTimer = setTimeout(() => {
      setForceDismiss(true);
    }, 4500);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  const isSplashDone = minSplashDone || forceDismiss;

  // Run protected route evaluation
  useProtectedRoute(isSplashDone);

  // CRITICAL FIX: Return ONLY the splash screen when loading.
  // This prevents the screen from splitting 50/50 with the Stack!
  if ((isLoading || !minSplashDone) && !forceDismiss) {
    return <AppSplashScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}