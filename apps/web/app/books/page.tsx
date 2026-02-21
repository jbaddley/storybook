import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getBooksByUserId } from '@/lib/books';

export default async function BooksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/');

  const books = await getBooksByUserId(session.user.id);

  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>Your books</h1>
      {books.length === 0 ? (
        <p>No books yet. Create one in the desktop app, or they will appear here once synced.</p>
      ) : (
        <ul style={{ listStyle: 'none', marginTop: '1rem' }}>
          {books.map((b) => (
            <li key={b.id} style={{ marginBottom: '0.75rem' }}>
              <Link
                href={`/books/${b.id}`}
                style={{ fontSize: '1.125rem', color: 'inherit' }}
              >
                {b.title}
              </Link>
              {b.author && (
                <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                  — {b.author}
                </span>
              )}
              <span style={{ color: '#999', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                {b._count.chapters} chapters · updated{' '}
                {new Date(b.updatedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
