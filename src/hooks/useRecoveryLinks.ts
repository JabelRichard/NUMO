import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { parseRecoveryLink } from '../utils/authRedirect';

const LINK_PROBLEM = {
  expired: 'This reset link has expired or was already used.',
  invalid: "This reset link didn't work.",
};

/**
 * Handles password-reset links (numo://reset-password…), whether they start the app
 * or arrive while it's open. A good link signs the user in and opens "set new
 * password"; useProtectedRoute keeps them there until it's saved. A bad link explains
 * why and offers a new one. `ready`: the navigator is mounted (splash finished).
 */
export function useRecoveryLinks(ready: boolean) {
  const url = Linking.useURL();
  const router = useRouter();
  const { session, openRecoveryLink, resetPasswordForEmail } = useAuth();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !url || handledRef.current === url) return;
    const link = parseRecoveryLink(url);
    if (!link) return;
    handledRef.current = url;

    (async () => {
      const result = await openRecoveryLink(link);
      if (result.ok) {
        router.replace('/(auth)/reset-password');
        return;
      }

      // Signed out: ask for the email again on the "forgot password" screen.
      const email = session?.user?.email;
      if (!email) {
        router.replace({ pathname: '/(auth)/forgot-password', params: { notice: result.reason } });
        return;
      }

      // Still signed in (e.g. they opened an old link later): offer a new link right here.
      Alert.alert(LINK_PROBLEM[result.reason], `We can send a new reset link to ${email}.`, [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Send new link',
          onPress: async () => {
            const { error } = await resetPasswordForEmail(email);
            Alert.alert(
              error ? "Couldn't send the email" : 'Check your email',
              error ? error.message : `We sent a new reset link to ${email}.`
            );
          },
        },
      ]);
    })();
  }, [ready, url, session, openRecoveryLink, resetPasswordForEmail, router]);
}
