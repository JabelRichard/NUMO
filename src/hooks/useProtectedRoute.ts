import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getUserSettings } from '../services/settingsService';

export function useProtectedRoute() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [checkingSettings, setCheckingSettings] = useState(false);

  useEffect(() => {
    if (isLoading || checkingSettings) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = (segments as string[]).includes('onboarding');
    const currentPath = segments.join('/');

    // Allow unauthenticated demo sessions on training and results
    const isDemoAccessibleRoute =
      currentPath.includes('training') || 
      currentPath.includes('workout') || 
      currentPath.includes('results');

    async function evaluateRouting() {
      if (!session) {
        // 1. Unauthenticated user trying to access protected routes -> redirect to Welcome
        if (!inAuthGroup && !isDemoAccessibleRoute) {
          router.replace('/(auth)/welcome');
        }
      } else {
        // 2. Authenticated user: verify onboarding status
        try {
          setCheckingSettings(true);
          const settings = await getUserSettings(session.user.id);

          if (!settings.has_completed_onboarding) {
            // User hasn't finished onboarding yet -> send them to onboarding screen
            if (!isOnboarding) {
              router.replace('/(auth)/onboarding');
            }
          } else {
            // User has completed onboarding -> block auth & onboarding screens, allow main app
            if (inAuthGroup) {
              router.replace('/');
            }
          }
        } finally {
          setCheckingSettings(false);
        }
      }
    }

    evaluateRouting();
  }, [session, isLoading, segments]);
}