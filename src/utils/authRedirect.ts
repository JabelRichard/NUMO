// Reset-password links that open the app. Supabase can deliver them three ways:
//  - its own link ({{ .ConfirmationURL }} in the email) checks the token on the server,
//    then opens the redirect URL with the session after '#':
//      numo://reset-password#access_token=…&refresh_token=…&type=recovery
//  - a link straight to the app ({{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery),
//    which the app checks itself:
//      numo://reset-password?token_hash=…&type=recovery
//  - an expired or already used link comes back with an error instead:
//      numo://reset-password#error=access_denied&error_code=otp_expired&error_description=…

/** The app path that reset links open: numo://reset-password. */
export const RESET_PASSWORD_PATH = 'reset-password';

export type RecoveryLink =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'token_hash'; tokenHash: string }
  | { kind: 'error'; reason: 'expired' | 'invalid'; description: string | null };

/** Query and fragment parameters together; the fragment wins. Doesn't rely on URLSearchParams (partial in React Native). */
function urlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const query = queryAt >= 0 ? url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : '';
  const fragment = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  for (const part of [query, fragment]) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = eq >= 0 ? pair.slice(0, eq) : pair;
      const value = eq >= 0 ? pair.slice(eq + 1) : '';
      try {
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        params[key] = value;
      }
    }
  }
  return params;
}

/** True for numo://reset-password, exp://host:8081/--/reset-password and the like. */
function opensResetPassword(url: string): boolean {
  const beforeParams = url.split(/[?#]/)[0];
  return new RegExp(`(^|[/:])${RESET_PASSWORD_PATH}/?$`).test(beforeParams);
}

/**
 * Reads a reset-password link. Null for any other URL, including the reset-password
 * path with nothing to act on (e.g. a plain app link to the screen).
 */
export function parseRecoveryLink(url: string | null | undefined): RecoveryLink | null {
  if (!url) return null;
  const params = urlParams(url);
  if (!opensResetPassword(url) && params.type !== 'recovery') return null;

  if (params.error || params.error_code) {
    const text = `${params.error_code ?? ''} ${params.error_description ?? ''}`.toLowerCase();
    return {
      kind: 'error',
      reason: params.error_code === 'otp_expired' || text.includes('expired') ? 'expired' : 'invalid',
      description: params.error_description ?? null,
    };
  }
  if (params.access_token && params.refresh_token) {
    return { kind: 'session', accessToken: params.access_token, refreshToken: params.refresh_token };
  }
  if (params.token_hash) return { kind: 'token_hash', tokenHash: params.token_hash };
  return null;
}
