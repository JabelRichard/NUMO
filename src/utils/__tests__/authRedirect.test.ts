import { parseRecoveryLink } from '../authRedirect';

describe('parseRecoveryLink', () => {
  it("reads the session from Supabase's own reset link", () => {
    const url = 'numo://reset-password#access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=recovery';
    expect(parseRecoveryLink(url)).toEqual({ kind: 'session', accessToken: 'AT', refreshToken: 'RT' });
  });

  it('works for the Expo Go form of the link', () => {
    const url = 'exp://192.168.1.20:8081/--/reset-password#access_token=AT&refresh_token=RT&type=recovery';
    expect(parseRecoveryLink(url)).toEqual({ kind: 'session', accessToken: 'AT', refreshToken: 'RT' });
  });

  it('reads a token_hash link that goes straight to the app', () => {
    expect(parseRecoveryLink('numo://reset-password?token_hash=abc123&type=recovery')).toEqual({
      kind: 'token_hash',
      tokenHash: 'abc123',
    });
  });

  it('reports an expired link', () => {
    const url =
      'numo://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseRecoveryLink(url)).toEqual({
      kind: 'error',
      reason: 'expired',
      description: 'Email link is invalid or has expired',
    });
  });

  it('reports other link errors as invalid', () => {
    const url = 'numo://reset-password?error=server_error&error_description=Something%20went%20wrong';
    expect(parseRecoveryLink(url)).toMatchObject({ kind: 'error', reason: 'invalid' });
  });

  it('ignores other links and the plain screen link', () => {
    expect(parseRecoveryLink(null)).toBeNull();
    expect(parseRecoveryLink('numo://statistics?from=profile')).toBeNull();
    expect(parseRecoveryLink('numo://reset-password')).toBeNull();
    expect(parseRecoveryLink('numo://reset-password?email=a%40b.com')).toBeNull();
    // Tokens on another path aren't a reset link.
    expect(parseRecoveryLink('numo://login#access_token=AT&refresh_token=RT')).toBeNull();
  });
});
