import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      book: { userId: session.user.id },
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

  return NextResponse.json({ ok: true });
}
