import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getBookWithChapters } from '@/lib/books';

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/');

  const { id: bookId } = await params;
  const book = await getBookWithChapters(bookId, session.user.id);
  if (!book) notFound();

  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <Link href="/books" style={{ display: 'inline-block', marginBottom: '1rem' }}>
        ← Back to books
      </Link>
      <h1>{book.title}</h1>
      {book.author && <p style={{ color: '#666', marginBottom: '1.5rem' }}>{book.author}</p>}
      <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Chapters</h2>
      {book.chapters.length === 0 ? (
        <p>No chapters yet.</p>
      ) : (
        <ul style={{ listStyle: 'none' }}>
          {book.chapters.map((ch) => (
            <li key={ch.id} style={{ marginBottom: '0.5rem' }}>
              <Link href={`/books/${book.id}/chapter/${ch.id}`}>
                {ch.order}. {ch.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
