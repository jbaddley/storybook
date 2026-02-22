import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// Dev-only: log redirect URI so you can confirm it matches Google Console
if (process.env.NODE_ENV === 'development' && process.env.NEXTAUTH_URL) {
  const redirectUri = `${process.env.NEXTAUTH_URL.replace(/\/$/, '')}/api/auth/callback/google`;
  console.log('[NextAuth] Redirect URI sent to Google:', redirectUri);
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
