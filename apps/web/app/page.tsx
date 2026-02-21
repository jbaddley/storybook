import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SignIn } from './sign-in';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect('/books');
  }
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>Storybook Editor</h1>
      <p>Edit your books online. Sign in to get started.</p>
      <SignIn />
    </main>
  );
}
