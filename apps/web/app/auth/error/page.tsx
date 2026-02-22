import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: 'Error starting Google sign-in. Check that in apps/web/.env.local you have NEXTAUTH_URL set to the same URL you use in the browser (e.g. http://localhost:4050), and that Google Cloud Console has that exact callback: http://localhost:4050/api/auth/callback/google.',
  OAuthCallback: 'Error in the OAuth callback. Confirm GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, and that the redirect URI in Google Console matches NEXTAUTH_URL + /api/auth/callback/google.',
  OAuthCreateAccount: 'Could not create account. Try again.',
  EmailCreateAccount: 'Could not create account. Try again.',
  Callback: 'Error in the auth callback. Check server logs.',
  OAuthAccountNotLinked: 'This email is already linked to another sign-in method.',
  EmailSignin: 'Check your email for the sign-in link.',
  CredentialsSignin: 'Sign-in failed. Check your credentials.',
  SessionRequired: 'Please sign in to continue.',
  Default: 'Something went wrong during sign-in. Try again or check NEXTAUTH_URL and Google OAuth settings.',
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error ?? 'Default';
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default;

  return (
    <main style={{ padding: '2rem', maxWidth: 560, margin: '0 auto' }}>
      <h1>Sign-in error</h1>
      <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary, #666)' }}>
        {message}
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/" style={{ color: 'var(--color-link, #0070f3)' }}>
          ← Back to sign in
        </Link>
      </p>
    </main>
  );
}
