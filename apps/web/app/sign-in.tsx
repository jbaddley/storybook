'use client';

import { signIn } from 'next-auth/react';

export function SignIn() {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: '/books' })}
      style={{
        marginTop: '1rem',
        padding: '0.5rem 1rem',
        fontSize: '1rem',
        cursor: 'pointer',
      }}
    >
      Sign in with Google
    </button>
  );
}
