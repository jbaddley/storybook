import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getBookWithChapters, getChapter } from '@/lib/books';
import { ChapterEditor } from './chapter-editor';

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/');

  const { id: bookId, chapterId } = await params;
  const [book, chapter] = await Promise.all([
    getBookWithChapters(bookId, session.user.id),
    getChapter(chapterId, session.user.id),
  ]);

  if (!book || !chapter || chapter.bookId !== bookId) notFound();

  const raw = chapter.content;
  const content =
    raw && typeof raw === 'object' && 'type' in raw && (raw as { type: string }).type === 'doc'
      ? (raw as { type: 'doc'; content?: unknown[] })
      : { type: 'doc' as const, content: [{ type: 'paragraph', content: [] }] };

  return (
    <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <Link href={`/books/${bookId}`} style={{ display: 'inline-block', marginBottom: '1rem' }}>
        ← {book.title}
      </Link>
      <h1>{chapter.title}</h1>
      <ChapterEditor
        chapterId={chapter.id}
        bookId={bookId}
        initialContent={content}
        initialTitle={chapter.title}
      />
    </main>
  );
}
