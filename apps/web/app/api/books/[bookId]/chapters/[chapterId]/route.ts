import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user && 'id' in session.user ? (session.user as { id: string }).id : null;
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Sign in again so your account is linked to the database.' },
      { status: 401 }
    );
  }

  const { bookId, chapterId } = await params;
  const body = await _req.json();
  const { content, title, wordCount } = body as {
    content?: object;
    title?: string;
    wordCount?: number;
  };

  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      bookId,
      book: { userId },
    },
  });

  if (!chapter) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
  }

  const data: { content?: object; title?: string; wordCount?: number; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (content !== undefined) data.content = content;
  if (title !== undefined) data.title = title;
  if (typeof wordCount === 'number') data.wordCount = wordCount;

  await prisma.chapter.update({
    where: { id: chapterId },
    data,
  });

  // Touch the book so desktop app sees DB as newer when checking for updates
  await prisma.book.update({
    where: { id: bookId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(`/books/${bookId}`);
  revalidatePath(`/books/${bookId}/chapter/${chapterId}`);

  return NextResponse.json({ ok: true });
}
