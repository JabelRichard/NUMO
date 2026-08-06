import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export function useProtectedRoute() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Check if the current top-level segment is within (auth)
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // 1. User is NOT signed in and trying to access protected routes -> Redirect to Login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // 2. User IS signed in and trying to access Auth screens -> Redirect to Main App
      router.replace('/');
    }
  }, [session, isLoading, segments]);
}