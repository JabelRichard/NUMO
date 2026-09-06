import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getUserSettings } from '../services/settingsService';

export function useProtectedRoute(isSplashDone: boolean = true) {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    // Only evaluate once splash is done and auth is known
    if (isLoading || !isSplashDone || isNavigatingRef.current) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = (segments as string[]).includes('onboarding');
    const currentPath = segments.join('/');

    const isDemoAccessibleRoute =
      currentPath.includes('training') ||
      currentPath.includes('workout') ||
      currentPath.includes('results');

    async function evaluateRouting() {
      try {
        if (!session) {
          // Guest user trying to access main app
          if (!inAuthGroup && !isDemoAccessibleRoute) {
            isNavigatingRef.current = true;
            router.replace('/(auth)/welcome');
          }
        } else {
          // Logged in user: Check onboarding
          const settings = await getUserSettings(session.user.id);

          if (!settings?.has_completed_onboarding) {
            if (!isOnboarding) {
              isNavigatingRef.current = true;
              router.replace('/(auth)/onboarding');
            }
          } else {
            if (inAuthGroup) {
              isNavigatingRef.current = true;
              router.replace('/(app)');
            }
          }
        }
      } catch (err) {
        console.error('Error during route protection:', err);
      } finally {
        setTimeout(() => {
          isNavigatingRef.current = false;
        }, 300);
      }
    }

    evaluateRouting();
  }, [session, isLoading, isSplashDone, segments]);
}