import { prisma } from './prisma';

export async function getBooksByUserId(userId: string) {
  return prisma.book.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      author: true,
      updatedAt: true,
      _count: { select: { chapters: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getBookWithChapters(bookId: string, userId: string) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: {
      id: true,
      title: true,
      author: true,
      chapters: {
        select: { id: true, title: true, order: true },
        orderBy: { order: 'asc' },
      },
    },
  });
  return book;
}

export async function getChapter(chapterId: string, userId: string) {
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      book: { userId },
    },
    select: {
      id: true,
      bookId: true,
      title: true,
      content: true,
      order: true,
      wordCount: true,
      updatedAt: true,
      book: { select: { id: true, title: true } },
    },
  });
  return chapter;
}
