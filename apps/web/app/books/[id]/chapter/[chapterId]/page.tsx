import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getBookWithChapters, getChapter } from '@/lib/books';
import { ChapterEditor } from './chapter-editor';

export const dynamic = 'force-dynamic';

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; chapterId: string }>;
  searchParams: Promise<{ debug?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/');

  const { id: bookId, chapterId } = await params;
  const { debug } = await searchParams;
  const [book, chapter] = await Promise.all([
    getBookWithChapters(bookId, session.user.id),
    getChapter(chapterId, session.user.id),
  ]);

  if (!book || !chapter || chapter.bookId !== bookId) notFound();

  const chapters = book.chapters;
  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  // Normalize raw DB value (object or JSON string, possibly double-encoded) to a TipTap doc and whether it has any text
  function hasAnyText(nodes: unknown[]): boolean {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const n = node as { type?: string; content?: unknown[]; text?: string };
      if (n.type === 'text' && typeof n.text === 'string' && n.text.trim().length > 0) return true;
      if (Array.isArray(n.content) && hasAnyText(n.content)) return true;
    }
    return false;
  }
  function toDoc(raw: unknown): { doc: { type: 'doc'; content: unknown[] }; hasText: boolean } {
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'string') parsed = JSON.parse(parsed) as unknown;
      } catch {
        parsed = null;
      }
    }
    const obj = parsed && typeof parsed === 'object' ? (parsed as { type?: string; content?: unknown[] }) : null;
    // Use any non-empty content array (DB may store doc with or without type, or wrapper shape)
    let contentArray: unknown[] = Array.isArray(obj?.content) ? obj.content : [];
    // Prisma/DB may return the content array at top level (no .content wrapper)
    if (contentArray.length === 0 && Array.isArray(parsed)) contentArray = parsed as unknown[];
    const doc = {
      type: 'doc' as const,
      content: contentArray.length > 0 ? contentArray : [{ type: 'paragraph' as const, content: [] as unknown[] }],
    };
    return { doc, hasText: hasAnyText(doc.content) };
  }

  const primary = toDoc(chapter.content);
  const fallback = chapter.originalContent != null ? toDoc(chapter.originalContent) : null;
  const content = primary.hasText ? primary.doc : (fallback?.hasText ? fallback.doc : primary.doc);
  const showDebug = debug === '1' || (!primary.hasText && !fallback?.hasText);

  return (
    <main className="chapter-page-layout">
      <header className="chapter-page-header">
        <Link href={`/books/${bookId}`} style={{ display: 'inline-block', marginBottom: '1rem' }}>
          ← {book.title}
        </Link>
        <div className="chapter-nav-row">
          {prevChapter ? (
            <Link href={`/books/${bookId}/chapter/${prevChapter.id}`} className="chapter-nav-btn chapter-nav-prev">
              ← Prev chapter
            </Link>
          ) : (
            <span className="chapter-nav-btn chapter-nav-disabled" aria-hidden>← Prev chapter</span>
          )}
          <h1 className="chapter-title">{chapter.title}</h1>
          {nextChapter ? (
            <Link href={`/books/${bookId}/chapter/${nextChapter.id}`} className="chapter-nav-btn chapter-nav-next">
              Next chapter →
            </Link>
          ) : (
            <span className="chapter-nav-btn chapter-nav-disabled" aria-hidden>Next chapter →</span>
          )}
        </div>
        {showDebug && (
          <details style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }} open={!primary.hasText && !fallback?.hasText}>
            <summary>Debug: raw content from DB</summary>
            <p style={{ marginBottom: '0.25rem' }}><strong>content</strong> (current):</p>
            <pre style={{ overflow: 'auto', maxHeight: 200, background: '#f5f5f5', padding: '0.5rem', marginBottom: '0.5rem' }}>
              {chapter.content == null ? 'null' : JSON.stringify(chapter.content, null, 2)}
            </pre>
            <p style={{ marginBottom: '0.25rem' }}><strong>originalContent</strong> (fallback when current is empty):</p>
            <pre style={{ overflow: 'auto', maxHeight: 200, background: '#f5f5f5', padding: '0.5rem' }}>
              {chapter.originalContent != null ? JSON.stringify(chapter.originalContent, null, 2) : 'null'}
            </pre>
          </details>
        )}
      </header>
      <ChapterEditor
        key={chapter.id}
        chapterId={chapter.id}
        bookId={bookId}
        initialContent={content}
        initialTitle={chapter.title}
      />
    </main>
  );
}
