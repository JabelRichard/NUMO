import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { getUserSettings, saveUserSettings } from '../services/settingsService';
import { supabase } from '../config/supabase';

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
          const userId = session.user.id;

          // 1. SYNC DRAFT: If the user just verified their email, apply the pending onboarding draft
          const draftStr = await AsyncStorage.getItem('@numo_onboarding_draft');
          if (draftStr) {
            try {
              const { settings, session: baselineSession } = JSON.parse(draftStr);

              // Update profiles table using your existing service
              await saveUserSettings(userId, {
                daily_question_goal: settings?.daily_question_goal ?? 10,
                goals: settings?.goals ?? ['speed'],
                has_completed_onboarding: true,
              });

              // Insert baseline workout stats into workout_sessions
              if (baselineSession) {
                await supabase.from('workout_sessions').insert({
                  user_id: userId,
                  operations: baselineSession.operations,
                  difficuty: baselineSession.difficuty,
                  total_questions: baselineSession.total_questions,
                  correct_answers: baselineSession.correct_answers,
                  incorrect_answers: baselineSession.incorrect_answers,
                  accuracy: baselineSession.accuracy,
                  avarage_time_per_question: baselineSession.avarage_time_per_question,
                });
              }

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