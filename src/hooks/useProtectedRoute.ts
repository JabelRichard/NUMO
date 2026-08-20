import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export function useProtectedRoute() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const currentPath = segments.join('/');

    // Allow unauthenticated demo sessions on training and results
    const isDemoAccessibleRoute =
      currentPath.includes('training') || 
      currentPath.includes('workout') || 
      currentPath.includes('results');

    if (!session && !inAuthGroup && !isDemoAccessibleRoute) {
      // 1. Unauthenticated user trying to access protected routes -> redirect to Welcome
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      // 2. Authenticated user trying to access Auth screens -> redirect to Main App
      router.replace('/');
    }
  }, [session, isLoading, segments]);
}