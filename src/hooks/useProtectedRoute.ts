import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { getUserSettings, saveUserSettings } from '../services/settingsService';

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

    async function evaluateRouting() {
      try {
        if (!session) {
          // Guest user trying to access main app
          if (!inAuthGroup) {
            isNavigatingRef.current = true;
            router.replace('/(auth)/welcome');
          }
        } else {
          const userId = session.user.id;

          // 1. SYNC DRAFT: If the user just verified their email, apply the pending onboarding draft
          const draftStr = await AsyncStorage.getItem('@numo_onboarding_draft');
          if (draftStr) {
            try {
              const { settings } = JSON.parse(draftStr);

              // Update profiles table using your existing service
              await saveUserSettings(userId, {
                daily_question_goal: settings?.daily_question_goal ?? 10,
                goals: settings?.goals ?? ['everyday'],
                has_completed_onboarding: true,
                // Missing from drafts saved by older app versions; undefined keys are left untouched.
                comfort_level: settings?.comfort_level,
                friction_areas: settings?.friction_areas,
                friction_area: settings?.friction_area,
              });

              await AsyncStorage.removeItem('@numo_onboarding_draft');
              await AsyncStorage.setItem('@numo_onboarding_completed', 'true');
            } catch (syncErr) {
              console.error('Error applying onboarding draft post-verification:', syncErr);
            }
          }

          // 2. CHECK STATUS: Check local flag first, then Supabase settings
          const localCompleted = await AsyncStorage.getItem('@numo_onboarding_completed');
          const settings = await getUserSettings(userId);
          const hasCompleted = localCompleted === 'true' || Boolean(settings?.has_completed_onboarding);

          if (!hasCompleted) {
            if (!isOnboarding) {
              isNavigatingRef.current = true;
              router.replace('/(auth)/onboarding');
            }
          } else {
            // Already completed onboarding -> ensure they are out of the auth stack
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