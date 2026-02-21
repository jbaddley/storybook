/**
 * Database Service for Main Process
 * Handles all Prisma operations for the Electron main process
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  Book,
  BookOutline,
  Chapter,
  ChapterComment,
  ChapterVariation,
  DocumentTab,
  Character,
  Location,
  Song,
  TimelineEvent,
  ChapterSummary,
  StoryCraftChapterFeedback,
  StoryPromise,
  PromiseKept,
  Theme,
  Motif,
  Symbol,
  ThemesAndMotifs,
  PlotErrorAnalysis,
  ChapterPlotAnalysis,
  PlotError,
  PlotErrorRole,
  PlotErrorType,
  PlotErrorSeverity,
  TipTapContent,
  DEFAULT_TIPTAP_CONTENT,
  RevisionPass,
  ChapterRevisionCompletion,
} from '../shared/types';

// Helper to convert to Prisma JSON type
function toJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

// Singleton Prisma client
let prisma: PrismaClient | null = null;

/**
 * Initialize Prisma client
 */
export function initDatabase(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

/**
 * Get Prisma client instance
 */
export function getDatabase(): PrismaClient {
  if (!prisma) {
    return initDatabase();
  }
  return prisma;
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// ============================================
// User Operations
// ============================================

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  googleId: string;
  picture?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function findOrCreateUserByGoogle(params: {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}): Promise<DbUser> {
  const db = getDatabase();
  
  const user = await db.user.upsert({
    where: { googleId: params.googleId },
    update: {
      email: params.email,
      name: params.name,
      picture: params.picture,
    },
    create: {
      email: params.email,
      name: params.name,
      googleId: params.googleId,
      picture: params.picture,
    },
  });
  
  return user as DbUser;
}

export async function getUserById(userId: string): Promise<DbUser | null> {
  const db = getDatabase();
  return db.user.findUnique({ where: { id: userId } });
}

export async function getUserByGoogleId(googleId: string): Promise<DbUser | null> {
  const db = getDatabase();
  return db.user.findUnique({ where: { googleId } });
}

// Note: User tokens are no longer stored in the database
// OAuth tokens are managed by the googleAuthService in localStorage

// ============================================
// Book Operations
// ============================================

export interface DbBookWithRelations {
  id: string;
  userId: string;
  title: string;
  author: string;
  description: string;
  settings: any;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  chapters: any[];
  documentTabs: any[];
  characters: any[];
  locations: any[];
  timelineEvents: any[];
  summaries: any[];
  themes: any[];
  motifs: any[];
  symbols: any[];
  plotErrorAnalysis?: any | null;
  outline?: { id: string; bookId: string; content: string; updatedAt: Date } | null;
  songs?: any[];
  revisionPasses?: Array<{
    id: string;
    bookId: string;
    revisionNumber: number;
    title: string;
    date: Date;
    completions: Array<{ id: string; chapterId: string; revisionId: string; completedAt: Date | null }>;
  }>;
}

export async function createBook(
  userId: string,
  book: Book
): Promise<string> {
  const db = getDatabase();

  // Idempotent: if book already exists (e.g. from a previous sync or race), return its id
  const existing = await db.book.findUnique({
    where: { id: book.id },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const dbBook = await db.book.create({
    data: {
      id: book.id,
      userId,
      title: book.title,
      author: book.author,
      description: book.description,
      settings: toJson(book.settings),
      metadata: toJson(book.metadata),
      createdAt: new Date(book.createdAt),
      updatedAt: new Date(book.updatedAt),
    },
  });

  // Dedupe chapters by id so we never insert the same chapter id twice (avoids unique constraint)
  const seenChapterIds = new Set<string>();
  const chaptersToCreate = book.chapters.filter((ch) => {
    if (seenChapterIds.has(ch.id)) return false;
    seenChapterIds.add(ch.id);
    return true;
  });

  if (chaptersToCreate.length > 0) {
    for (const chapter of chaptersToCreate) {
      await createChapter(dbBook.id, chapter);
    }
  }

  // Create document tabs
  if (book.documentTabs.length > 0) {
    await db.documentTab.createMany({
      data: book.documentTabs.map(tab => ({
        id: tab.id,
        bookId: dbBook.id,
        title: tab.title,
        content: toJson(tab.content),
        icon: tab.icon,
        color: tab.color,
        isPermanent: tab.isPermanent,
        tabType: tab.tabType,
        createdAt: new Date(tab.createdAt),
        updatedAt: new Date(tab.updatedAt),
      })),
    });
  }

  // Create extracted data
  await saveExtractedData(dbBook.id, book.extracted);

  // Create book outline if present – skip if table not yet migrated
  if (book.outline && book.outline.content) {
    try {
      await upsertBookOutline(dbBook.id, book.outline.content);
    } catch {
      // book_outlines table may not exist yet
    }
  }

  // Create songs
  const songs = book.songs ?? [];
  if (songs.length > 0) {
    await db.song.createMany({
      data: songs.map(s => ({
        id: s.id,
        bookId: dbBook.id,
        title: s.title,
        description: s.description ?? null,
        lyrics: s.lyrics ?? null,
        style: s.style ?? '',
        genre: s.genre ?? '',
        characters: toJson(s.characters ?? []),
        tempo: s.tempo ?? '',
        key: s.key ?? '',
        instruments: toJson(s.instruments ?? []),
      })),
    });
  }

  return dbBook.id;
}

export async function getBooksByUser(userId: string): Promise<DbBookWithRelations[]> {
  const db = getDatabase();
  
  return db.book.findMany({
    where: { userId },
    include: {
      chapters: {
        include: {
          comments: true,
          notes: true,
          variations: { orderBy: { generatedAt: 'desc' } },
          storyCraftFeedback: {
            include: {
              promisesMade: true,
              promisesKept: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      documentTabs: true,
      characters: true,
      locations: true,
      timelineEvents: { orderBy: { order: 'asc' } },
      summaries: true,
      themes: true,
      motifs: true,
      symbols: true,
      plotErrorAnalysis: {
        include: {
          chapterAnalyses: true,
          errors: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getBookById(bookId: string): Promise<DbBookWithRelations | null> {
  const db = getDatabase();
  
  return db.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: {
        include: {
          comments: true,
          notes: true,
          variations: { orderBy: { generatedAt: 'desc' } },
          storyCraftFeedback: {
            include: {
              promisesMade: true,
              promisesKept: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
      documentTabs: true,
      characters: true,
      locations: true,
      timelineEvents: { orderBy: { order: 'asc' } },
      summaries: true,
      themes: true,
      motifs: true,
      symbols: true,
      plotErrorAnalysis: {
        include: {
          chapterAnalyses: true,
          errors: true,
        },
      },
      revisionPasses: {
        orderBy: { revisionNumber: 'asc' },
        include: { completions: true },
      },
      songs: true,
      // Outline loaded separately in loadBookFromDatabase so app works if migration not yet run
    },
  });
}

export async function updateBook(
  bookId: string,
  updates: Partial<Pick<Book, 'title' | 'author' | 'description' | 'settings' | 'metadata'>>
): Promise<void> {
  const db = getDatabase();
  
  // Convert settings and metadata to JSON format if present
  const data: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.author !== undefined) data.author = updates.author;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.settings !== undefined) data.settings = toJson(updates.settings);
  if (updates.metadata !== undefined) data.metadata = toJson(updates.metadata);
  
  await db.book.update({
    where: { id: bookId },
    data,
  });
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = getDatabase();
  await db.book.delete({ where: { id: bookId } });
}

export async function getBookUpdatedAt(bookId: string): Promise<Date | null> {
  const db = getDatabase();
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { updatedAt: true },
  });
  return book?.updatedAt || null;
}

// ============================================
// Chapter Operations
// ============================================

async function createChapter(bookId: string, chapter: Chapter): Promise<void> {
  const db = getDatabase();

  // Skip if chapter already exists (e.g. from a previous partial create or race)
  const existing = await db.chapter.findUnique({
    where: { id: chapter.id },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  const dbChapter = await db.chapter.create({
    data: {
      id: chapter.id,
      bookId,
      title: chapter.title,
      content: toJson(chapter.content),
      order: chapter.order,
      wordCount: chapter.wordCount,
      purpose: chapter.purpose ?? undefined,
      originalContent: chapter.originalContent ? toJson(chapter.originalContent) : undefined,
      originalWordCount: chapter.originalWordCount,
      variationAppliedAt: chapter.variationAppliedAt ? new Date(chapter.variationAppliedAt) : undefined,
      createdAt: new Date(chapter.createdAt),
      updatedAt: new Date(chapter.updatedAt),
    },
  });
  
  // Create comments
  if (chapter.comments && chapter.comments.length > 0) {
    await db.chapterComment.createMany({
      data: chapter.comments.map(comment => ({
        id: comment.id,
        chapterId: dbChapter.id,
        text: comment.text,
        type: comment.type,
        category: comment.category,
        resolved: comment.resolved,
        createdBy: comment.createdBy,
        targetText: comment.targetText,
        createdAt: new Date(comment.createdAt),
      })),
    });
  }
  
  // Create variations if any (e.g. when loading book from DB that has variations)
  const variationsToCreate = chapter.variations ?? [];
  for (const v of variationsToCreate) {
    await db.chapterVariation.create({
      data: {
        id: v.id,
        chapterId: dbChapter.id,
        content: toJson(v.content),
        prompt: v.prompt,
        basedOnStoryCraft: v.basedOnStoryCraft,
        wordCount: v.wordCount,
        generatedAt: new Date(v.generatedAt),
        changeReport: v.changeReport ? toJson(v.changeReport) : undefined,
        sourceVariationId: v.sourceVariationId || undefined,
        settings: v.settings ? toJson(v.settings) : undefined,
      },
    });
  }
}

export async function getVariationsForChapter(chapterId: string): Promise<ChapterVariation[]> {
  const db = getDatabase();
  const rows = await db.chapterVariation.findMany({
    where: { chapterId },
    orderBy: { generatedAt: 'desc' },
  });
  return rows.map(row => ({
    id: row.id,
    content: row.content as unknown as TipTapContent,
    prompt: row.prompt,
    basedOnStoryCraft: row.basedOnStoryCraft,
    wordCount: row.wordCount,
    generatedAt: row.generatedAt.toISOString(),
    changeReport: row.changeReport as unknown as ChapterVariation['changeReport'],
    sourceVariationId: row.sourceVariationId || undefined,
    settings: row.settings as unknown as ChapterVariation['settings'],
  }));
}

export async function addChapterVariation(chapterId: string, variation: ChapterVariation): Promise<void> {
  const db = getDatabase();
  await db.chapterVariation.create({
    data: {
      id: variation.id,
      chapterId,
      content: toJson(variation.content),
      prompt: variation.prompt,
      basedOnStoryCraft: variation.basedOnStoryCraft,
      wordCount: variation.wordCount,
      generatedAt: new Date(variation.generatedAt),
      changeReport: variation.changeReport ? toJson(variation.changeReport) : undefined,
      sourceVariationId: variation.sourceVariationId || undefined,
      settings: variation.settings ? toJson(variation.settings) : undefined,
    },
  });
}

export async function deleteChapterVariation(variationId: string): Promise<void> {
  const db = getDatabase();
  await db.chapterVariation.delete({ where: { id: variationId } });
}

export async function upsertChapter(bookId: string, chapter: Chapter): Promise<void> {
  const db = getDatabase();
  
  // Upsert the chapter
  await db.chapter.upsert({
    where: { id: chapter.id },
    update: {
      title: chapter.title,
      content: toJson(chapter.content),
      order: chapter.order,
      wordCount: chapter.wordCount,
      purpose: chapter.purpose ?? null,
      originalContent: chapter.originalContent ? toJson(chapter.originalContent) : undefined,
      originalWordCount: chapter.originalWordCount,
      variationAppliedAt: chapter.variationAppliedAt ? new Date(chapter.variationAppliedAt) : null,
      updatedAt: new Date(chapter.updatedAt),
    },
    create: {
      id: chapter.id,
      bookId,
      title: chapter.title,
      content: toJson(chapter.content),
      order: chapter.order,
      wordCount: chapter.wordCount,
      purpose: chapter.purpose ?? undefined,
      originalContent: chapter.originalContent ? toJson(chapter.originalContent) : undefined,
      originalWordCount: chapter.originalWordCount,
      variationAppliedAt: chapter.variationAppliedAt ? new Date(chapter.variationAppliedAt) : undefined,
      createdAt: new Date(chapter.createdAt),
      updatedAt: new Date(chapter.updatedAt),
    },
  });
  
  // Sync comments - delete all and recreate
  await db.chapterComment.deleteMany({ where: { chapterId: chapter.id } });
  if (chapter.comments && chapter.comments.length > 0) {
    await db.chapterComment.createMany({
      data: chapter.comments.map(comment => ({
        id: comment.id,
        chapterId: chapter.id,
        text: comment.text,
        type: comment.type,
        category: comment.category,
        resolved: comment.resolved,
        createdBy: comment.createdBy,
        targetText: comment.targetText,
        createdAt: new Date(comment.createdAt),
      })),
    });
  }
  
  // Sync notes - delete all and recreate
  await db.chapterNote.deleteMany({ where: { chapterId: chapter.id } });
  if (chapter.notes && chapter.notes.length > 0) {
    await db.chapterNote.createMany({
      data: chapter.notes.map(note => ({
        id: note.id,
        chapterId: chapter.id,
        text: note.text,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt || note.createdAt),
      })),
    });
  }
  
  // Do not sync variations here — they are DB-only and managed via addChapterVariation / getVariationsForChapter
}

export async function deleteChapter(chapterId: string): Promise<void> {
  const db = getDatabase();
  await db.chapter.delete({ where: { id: chapterId } });
}

export async function getChapterUpdatedAt(chapterId: string): Promise<Date | null> {
  const db = getDatabase();
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    select: { updatedAt: true },
  });
  return chapter?.updatedAt || null;
}

export async function getChaptersByBookId(bookId: string): Promise<any[]> {
  const db = getDatabase();
  return db.chapter.findMany({
    where: { bookId },
    include: {
      comments: true,
      notes: true,
      variations: { orderBy: { generatedAt: 'desc' } },
      storyCraftFeedback: {
        include: {
          promisesMade: true,
          promisesKept: true,
        },
      },
    },
    orderBy: { order: 'asc' },
  });
}

// ============================================
// Document Tab Operations
// ============================================

export async function upsertDocumentTab(bookId: string, tab: DocumentTab): Promise<void> {
  const db = getDatabase();
  
  await db.documentTab.upsert({
    where: { id: tab.id },
    update: {
      title: tab.title,
      content: toJson(tab.content),
      icon: tab.icon,
      color: tab.color,
      isPermanent: tab.isPermanent,
      tabType: tab.tabType,
      updatedAt: new Date(tab.updatedAt),
    },
    create: {
      id: tab.id,
      bookId,
      title: tab.title,
      content: toJson(tab.content),
      icon: tab.icon,
      color: tab.color,
      isPermanent: tab.isPermanent,
      tabType: tab.tabType,
      createdAt: new Date(tab.createdAt),
      updatedAt: new Date(tab.updatedAt),
    },
  });
}

export async function deleteDocumentTab(tabId: string): Promise<void> {
  const db = getDatabase();
  await db.documentTab.delete({ where: { id: tabId } });
}

// ============================================
// Book Outline Operations
// ============================================

export async function getBookOutline(bookId: string): Promise<BookOutline | null> {
  const db = getDatabase();
  const row = await db.bookOutline.findUnique({
    where: { bookId },
  });
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.bookId,
    content: row.content,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertBookOutline(bookId: string, content: string): Promise<BookOutline> {
  const db = getDatabase();
  const row = await db.bookOutline.upsert({
    where: { bookId },
    update: { content, updatedAt: new Date() },
    create: {
      bookId,
      content,
    },
  });
  return {
    id: row.id,
    bookId: row.bookId,
    content: row.content,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ============================================
// StoryCraft Feedback Operations
// ============================================

export async function upsertStoryCraftFeedback(
  chapterId: string,
  chapterTitle: string,
  feedback: StoryCraftChapterFeedback
): Promise<void> {
  const db = getDatabase();
  
  // Upsert the feedback
  const dbFeedback = await db.storyCraftFeedback.upsert({
    where: { chapterId },
    update: {
      chapterTitle,
      assessment: toJson(feedback.assessment),
      checklist: toJson(feedback.checklist),
      summary: feedback.summary,
      lastUpdated: new Date(feedback.lastUpdated),
    },
    create: {
      chapterId,
      chapterTitle,
      assessment: toJson(feedback.assessment),
      checklist: toJson(feedback.checklist),
      summary: feedback.summary,
      generatedAt: new Date(feedback.generatedAt),
      lastUpdated: new Date(feedback.lastUpdated),
    },
  });
  
  // Sync promises made
  await db.storyPromise.deleteMany({ where: { feedbackId: dbFeedback.id } });
  if (feedback.promisesMade && feedback.promisesMade.length > 0) {
    await db.storyPromise.createMany({
      data: feedback.promisesMade.map(promise => ({
        id: promise.id,
        feedbackId: dbFeedback.id,
        type: promise.type,
        description: promise.description,
        context: promise.context,
        chapterId: promise.chapterId,
        chapterTitle: promise.chapterTitle,
      })),
    });
  }
  
  // Sync promises kept
  await db.promiseKept.deleteMany({ where: { feedbackId: dbFeedback.id } });
  if (feedback.promisesKept && feedback.promisesKept.length > 0) {
    await db.promiseKept.createMany({
      data: feedback.promisesKept.map(kept => ({
        feedbackId: dbFeedback.id,
        promiseId: kept.promiseId,
        promiseDescription: kept.promiseDescription,
        howKept: kept.howKept,
        chapterWherePromised: kept.chapterWherePromised,
        chapterTitleWherePromised: kept.chapterTitleWherePromised,
      })),
    });
  }
}

export async function deleteStoryCraftFeedback(chapterId: string): Promise<void> {
  const db = getDatabase();
  
  // Find the feedback record
  const feedback = await db.storyCraftFeedback.findUnique({
    where: { chapterId },
  });
  
  if (feedback) {
    // Delete promises made and kept first (foreign key constraints)
    await db.storyPromise.deleteMany({ where: { feedbackId: feedback.id } });
    await db.promiseKept.deleteMany({ where: { feedbackId: feedback.id } });
    
    // Delete the feedback record
    await db.storyCraftFeedback.delete({
      where: { chapterId },
    });
  }
}

// ============================================
// Extracted Data Operations
// ============================================

async function saveExtractedData(bookId: string, extracted: Book['extracted']): Promise<void> {
  const db = getDatabase();
  
  // Characters
  if (extracted.characters.length > 0) {
    await db.character.createMany({
      data: extracted.characters.map(char => ({
        id: char.id,
        bookId,
        name: char.name,
        aliases: toJson(char.aliases),
        description: char.description,
        firstAppearance: char.firstAppearance,
        mentions: toJson(char.mentions),
      })),
    });
  }
  
  // Locations
  if (extracted.locations.length > 0) {
    await db.location.createMany({
      data: extracted.locations.map(loc => ({
        id: loc.id,
        bookId,
        name: loc.name,
        description: loc.description,
        type: loc.type,
        mentions: toJson(loc.mentions),
      })),
    });
  }
  
  // Timeline events
  if (extracted.timeline.length > 0) {
    await db.timelineEvent.createMany({
      data: extracted.timeline.map(event => ({
        id: event.id,
        bookId,
        description: event.description,
        date: event.date,
        sortDate: event.sortDate,
        dateType: event.dateType,
        eventType: event.eventType,
        chapterId: event.chapter,
        chapterTitle: event.chapterTitle,
        order: event.order,
        chronologicalOrder: event.chronologicalOrder,
      })),
    });
  }
  
  // Summaries
  if (extracted.summaries.length > 0) {
    await db.chapterSummary.createMany({
      data: extracted.summaries.map(summary => ({
        bookId,
        chapterId: summary.chapterId,
        summary: summary.summary,
        keyPoints: toJson(summary.keyPoints),
        generatedAt: new Date(summary.generatedAt),
      })),
    });
  }
  
  // StoryCraft feedback - handled per chapter
  if (extracted.storyCraftFeedback.length > 0) {
    for (const feedback of extracted.storyCraftFeedback) {
      await upsertStoryCraftFeedback(feedback.chapterId, feedback.chapterTitle, feedback);
    }
  }
  
  // Themes and Motifs
  const themesAndMotifs = extracted.themesAndMotifs;
  if (themesAndMotifs) {
    if (themesAndMotifs.themes.length > 0) {
      await db.theme.createMany({
        data: themesAndMotifs.themes.map(theme => ({
          id: theme.id,
          bookId,
          name: theme.name,
          type: theme.type,
          description: theme.description,
          chapterAppearances: toJson(theme.chapterAppearances),
          evolutionNotes: theme.evolutionNotes,
        })),
      });
    }
    
    if (themesAndMotifs.motifs.length > 0) {
      await db.motif.createMany({
        data: themesAndMotifs.motifs.map(motif => ({
          id: motif.id,
          bookId,
          name: motif.name,
          description: motif.description,
          chapterAppearances: toJson(motif.chapterAppearances),
        })),
      });
    }
    
    if (themesAndMotifs.symbols.length > 0) {
      await db.symbol.createMany({
        data: themesAndMotifs.symbols.map(symbol => ({
          id: symbol.id,
          bookId,
          name: symbol.name,
          meaning: symbol.meaning,
          chapterAppearances: toJson(symbol.chapterAppearances),
        })),
      });
    }
  }

  // Plot Error Analysis
  if (extracted.plotErrorAnalysis) {
    await savePlotErrorAnalysis(bookId, extracted.plotErrorAnalysis);
  }
}

export async function syncExtractedData(bookId: string, extracted: Book['extracted']): Promise<void> {
  const db = getDatabase();
  
  // Delete all existing extracted data
  await db.character.deleteMany({ where: { bookId } });
  await db.location.deleteMany({ where: { bookId } });
  await db.timelineEvent.deleteMany({ where: { bookId } });
  await db.chapterSummary.deleteMany({ where: { bookId } });
  await db.theme.deleteMany({ where: { bookId } });
  await db.motif.deleteMany({ where: { bookId } });
  await db.symbol.deleteMany({ where: { bookId } });
  
  // Delete plot error analysis
  await db.plotErrorAnalysis.deleteMany({ where: { bookId } });
  
  // Note: StoryCraft feedback is linked to chapters, not deleted here
  
  // Recreate
  await saveExtractedData(bookId, extracted);
}

// ============================================
// Full Book Sync Operations
// ============================================

export async function syncBookToDatabase(userId: string, book: Book): Promise<void> {
  const db = getDatabase();
  
  // Check if book exists
  const existingBook = await db.book.findUnique({ where: { id: book.id } });
  
  if (existingBook) {
    // Update book metadata
    await db.book.update({
      where: { id: book.id },
      data: {
        title: book.title,
        author: book.author,
        description: book.description,
        settings: toJson(book.settings),
        metadata: toJson(book.metadata),
        updatedAt: new Date(book.updatedAt),
      },
    });
    
    // Get existing chapter IDs
    const existingChapters = await db.chapter.findMany({
      where: { bookId: book.id },
      select: { id: true },
    });
    const existingChapterIds = new Set(existingChapters.map(c => c.id));
    const newChapterIds = new Set(book.chapters.map(c => c.id));
    
    // Delete removed chapters
    const chaptersToDelete = [...existingChapterIds].filter(id => !newChapterIds.has(id));
    if (chaptersToDelete.length > 0) {
      await db.chapter.deleteMany({
        where: { id: { in: chaptersToDelete } },
      });
    }
    
    // Upsert chapters
    for (const chapter of book.chapters) {
      await upsertChapter(book.id, chapter);
    }
    
    // Get existing tab IDs
    const existingTabs = await db.documentTab.findMany({
      where: { bookId: book.id },
      select: { id: true },
    });
    const existingTabIds = new Set(existingTabs.map(t => t.id));
    const newTabIds = new Set(book.documentTabs.map(t => t.id));
    
    // Delete removed tabs
    const tabsToDelete = [...existingTabIds].filter(id => !newTabIds.has(id));
    if (tabsToDelete.length > 0) {
      await db.documentTab.deleteMany({
        where: { id: { in: tabsToDelete } },
      });
    }
    
    // Upsert document tabs
    for (const tab of book.documentTabs) {
      await upsertDocumentTab(book.id, tab);
    }
    
    // Upsert book outline (Markdown) – skip if table not yet migrated
    if (book.outline) {
      try {
        await upsertBookOutline(book.id, book.outline.content);
      } catch {
        // book_outlines table may not exist yet
      }
    }

    // Sync songs (replace all)
    await db.song.deleteMany({ where: { bookId: book.id } });
    const songs = book.songs ?? [];
    if (songs.length > 0) {
      await db.song.createMany({
        data: songs.map(s => ({
          id: s.id,
          bookId: book.id,
          title: s.title,
          description: s.description ?? null,
          lyrics: s.lyrics ?? null,
          style: s.style ?? '',
          genre: s.genre ?? '',
          characters: toJson(s.characters ?? []),
          tempo: s.tempo ?? '',
          key: s.key ?? '',
          instruments: toJson(s.instruments ?? []),
        })),
      });
    }
    
    // Sync extracted data
    await syncExtractedData(book.id, book.extracted);
  } else {
    // Create new book
    await createBook(userId, book);
  }
}

// ============================================
// Convert DB Models to App Types
// ============================================

export async function dbBookToAppBook(dbBook: DbBookWithRelations): Promise<Book> {
  const chapters: Chapter[] = dbBook.chapters.map(ch => ({
    id: ch.id,
    title: ch.title,
    content: ch.content as TipTapContent,
    order: ch.order,
    wordCount: ch.wordCount,
    purpose: (ch as any).purpose ?? undefined,
    comments: ch.comments.map((comment: any) => ({
      id: comment.id,
      text: comment.text,
      type: comment.type as ChapterComment['type'],
      category: comment.category as ChapterComment['category'],
      resolved: comment.resolved,
      createdBy: comment.createdBy as 'user' | 'ai',
      targetText: comment.targetText,
      createdAt: comment.createdAt.toISOString(),
    })),
    notes: (ch.notes || []).map((note: any) => ({
      id: note.id,
      text: note.text,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    variations: (ch.variations || []).map((v: any) => ({
      id: v.id,
      content: v.content as TipTapContent,
      prompt: v.prompt,
      basedOnStoryCraft: v.basedOnStoryCraft,
      wordCount: v.wordCount,
      generatedAt: v.generatedAt.toISOString(),
      changeReport: v.changeReport as ChapterVariation['changeReport'],
      sourceVariationId: v.sourceVariationId || undefined,
      settings: v.settings as ChapterVariation['settings'],
    })),
    originalContent: (ch.originalContent ?? ch.content) as TipTapContent,
    originalWordCount: ch.originalWordCount ?? ch.wordCount ?? 0,
    variationAppliedAt: ch.variationAppliedAt?.toISOString(),
    createdAt: ch.createdAt.toISOString(),
    updatedAt: ch.updatedAt.toISOString(),
  }));

  const documentTabs: DocumentTab[] = dbBook.documentTabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    content: tab.content as TipTapContent,
    icon: tab.icon || undefined,
    color: tab.color || undefined,
    isPermanent: tab.isPermanent,
    tabType: tab.tabType as DocumentTab['tabType'],
    createdAt: tab.createdAt.toISOString(),
    updatedAt: tab.updatedAt.toISOString(),
  }));

  const characters: Character[] = dbBook.characters.map(char => ({
    id: char.id,
    name: char.name,
    aliases: char.aliases as string[],
    description: char.description || undefined,
    firstAppearance: char.firstAppearance,
    mentions: char.mentions as any[],
  }));

  const locations: Location[] = dbBook.locations.map(loc => ({
    id: loc.id,
    name: loc.name,
    description: loc.description || undefined,
    type: loc.type || undefined,
    mentions: loc.mentions as any[],
  }));

  const songs: Song[] = (dbBook.songs ?? []).map(s => ({
    id: s.id,
    title: s.title,
    description: s.description ?? undefined,
    lyrics: s.lyrics ?? undefined,
    style: s.style ?? '',
    genre: s.genre ?? '',
    characters: (s.characters as string[]) ?? [],
    tempo: s.tempo ?? '',
    key: s.key ?? '',
    instruments: (s.instruments as string[]) ?? [],
  }));

  const timeline: TimelineEvent[] = dbBook.timelineEvents.map(event => ({
    id: event.id,
    description: event.description,
    date: event.date || undefined,
    sortDate: event.sortDate || undefined,
    dateType: event.dateType as TimelineEvent['dateType'],
    eventType: event.eventType as TimelineEvent['eventType'],
    chapter: event.chapterId,
    chapterTitle: event.chapterTitle || undefined,
    order: event.order,
    chronologicalOrder: event.chronologicalOrder || undefined,
  }));

  const summaries: ChapterSummary[] = dbBook.summaries.map(summary => ({
    chapterId: summary.chapterId,
    summary: summary.summary,
    keyPoints: summary.keyPoints as string[],
    generatedAt: summary.generatedAt.toISOString(),
  }));

  // Build StoryCraft feedback from chapters
  const storyCraftFeedback: StoryCraftChapterFeedback[] = dbBook.chapters
    .filter((ch: any) => ch.storyCraftFeedback)
    .map((ch: any) => {
      const fb = ch.storyCraftFeedback;
      return {
        chapterId: fb.chapterId,
        chapterTitle: fb.chapterTitle,
        assessment: fb.assessment,
        checklist: fb.checklist as any[],
        summary: fb.summary || undefined,
        promisesMade: fb.promisesMade?.map((p: any) => ({
          id: p.id,
          type: p.type as StoryPromise['type'],
          description: p.description,
          context: p.context,
          chapterId: p.chapterId,
          chapterTitle: p.chapterTitle,
        })),
        promisesKept: fb.promisesKept?.map((k: any) => ({
          promiseId: k.promiseId,
          promiseDescription: k.promiseDescription,
          howKept: k.howKept,
          chapterWherePromised: k.chapterWherePromised,
          chapterTitleWherePromised: k.chapterTitleWherePromised,
        })),
        generatedAt: fb.generatedAt.toISOString(),
        lastUpdated: fb.lastUpdated.toISOString(),
      };
    });

  const themesAndMotifs: ThemesAndMotifs = {
    themes: dbBook.themes.map(theme => ({
      id: theme.id,
      name: theme.name,
      type: theme.type as 'major' | 'minor',
      description: theme.description,
      chapterAppearances: theme.chapterAppearances as any[],
      evolutionNotes: theme.evolutionNotes,
    })),
    motifs: dbBook.motifs.map(motif => ({
      id: motif.id,
      name: motif.name,
      description: motif.description,
      chapterAppearances: motif.chapterAppearances as any[],
    })),
    symbols: dbBook.symbols.map(symbol => ({
      id: symbol.id,
      name: symbol.name,
      meaning: symbol.meaning,
      chapterAppearances: symbol.chapterAppearances as any[],
    })),
    lastUpdated: new Date().toISOString(),
  };

  // Load plot error analysis (always check, even if relation wasn't included)
  let plotErrorAnalysis: PlotErrorAnalysis | null = null;
  try {
    plotErrorAnalysis = await getPlotErrorAnalysis(dbBook.id);
  } catch (error) {
    // Analysis might not exist, which is fine
    console.log('[dbBookToAppBook] No plot error analysis found for book:', dbBook.id);
  }

  // Map revision passes and flat list of completions
  const revisionPasses: RevisionPass[] = (dbBook.revisionPasses || []).map((rp: any) => ({
    id: rp.id,
    bookId: rp.bookId,
    revisionNumber: rp.revisionNumber,
    title: rp.title,
    date: rp.date.toISOString(),
  }));
  const chapterRevisionCompletions: ChapterRevisionCompletion[] = (dbBook.revisionPasses || []).flatMap(
    (rp: any) => (rp.completions || []).map((c: any) => ({
      id: c.id,
      chapterId: c.chapterId,
      revisionId: c.revisionId,
      completedAt: c.completedAt?.toISOString(),
    }))
  );

  const outline: BookOutline | null = dbBook.outline
    ? {
        id: dbBook.outline.id,
        bookId: dbBook.outline.bookId,
        content: dbBook.outline.content,
        updatedAt: dbBook.outline.updatedAt.toISOString(),
      }
    : null;

  return {
    id: dbBook.id,
    title: dbBook.title,
    author: dbBook.author,
    description: dbBook.description,
    chapters,
    documentTabs,
    outline,
    metadata: dbBook.metadata,
    settings: dbBook.settings,
    revisionPasses,
    chapterRevisionCompletions,
    songs,
    extracted: {
      characters,
      locations,
      timeline,
      summaries,
      storyCraftFeedback,
      themesAndMotifs,
      plotErrorAnalysis: plotErrorAnalysis || undefined,
      lastExtracted: undefined,
    },
    createdAt: dbBook.createdAt.toISOString(),
    updatedAt: dbBook.updatedAt.toISOString(),
  };
}

// ============================================
// Plot Error Analysis Operations
// ============================================

export async function savePlotErrorAnalysis(
  bookId: string,
  analysis: PlotErrorAnalysis
): Promise<void> {
  const db = getDatabase();
  
  // Delete existing analysis if any
  await db.plotErrorAnalysis.deleteMany({ where: { bookId } });
  
  // Create new analysis
  const dbAnalysis = await db.plotErrorAnalysis.create({
    data: {
      id: analysis.id,
      bookId,
      modelUsed: analysis.modelUsed,
      generatedAt: new Date(analysis.generatedAt),
    },
  });
  
  // Create chapter analyses
  if (analysis.chapterAnalyses.length > 0) {
    await db.chapterPlotAnalysis.createMany({
      data: analysis.chapterAnalyses.map(ca => ({
        id: ca.id,
        analysisId: dbAnalysis.id,
        chapterId: ca.chapterId,
        chapterTitle: ca.chapterTitle,
        proposedTitle: ca.proposedTitle || null,
        roles: toJson(ca.roles),
        plotSummary: ca.plotSummary || null,
        chapterTheme: ca.chapterTheme || null,
        order: ca.order,
      })),
    });
  }
  
  // Create errors
  if (analysis.errors.length > 0) {
    await db.plotError.createMany({
      data: analysis.errors.map(error => ({
        id: error.id,
        analysisId: dbAnalysis.id,
        type: error.type,
        severity: error.severity,
        description: error.description,
        context: error.context || null,
        affectedChapters: toJson(error.affectedChapters),
        chapterIds: toJson(error.affectedChapters), // For querying
      })),
    });
  }
}

export async function getPlotErrorAnalysis(bookId: string): Promise<PlotErrorAnalysis | null> {
  const db = getDatabase();
  
  const dbAnalysis = await db.plotErrorAnalysis.findUnique({
    where: { bookId },
    include: {
      chapterAnalyses: true,
      errors: true,
    },
  });
  
  if (!dbAnalysis) {
    return null;
  }
  
  return {
    id: dbAnalysis.id,
    bookId: dbAnalysis.bookId,
    modelUsed: dbAnalysis.modelUsed,
    generatedAt: dbAnalysis.generatedAt.toISOString(),
    lastUpdated: dbAnalysis.lastUpdated.toISOString(),
    chapterAnalyses: dbAnalysis.chapterAnalyses.map(ca => ({
      id: ca.id,
      analysisId: ca.analysisId,
      chapterId: ca.chapterId,
      chapterTitle: ca.chapterTitle,
      proposedTitle: ca.proposedTitle || undefined,
      roles: ca.roles as PlotErrorRole[],
      plotSummary: ca.plotSummary || undefined,
      chapterTheme: ca.chapterTheme || undefined,
      order: ca.order,
    })),
    errors: dbAnalysis.errors.map(error => ({
      id: error.id,
      analysisId: error.analysisId,
      type: error.type as PlotErrorType,
      severity: error.severity as PlotErrorSeverity,
      description: error.description,
      context: error.context || undefined,
      affectedChapters: error.affectedChapters as string[],
    })),
  };
}

export async function updatePlotErrorAnalysis(
  bookId: string,
  analysis: PlotErrorAnalysis
): Promise<void> {
  // For now, just save (which deletes and recreates)
  // Could be optimized to do incremental updates
  await savePlotErrorAnalysis(bookId, analysis);
}

export async function deletePlotErrorAnalysis(bookId: string): Promise<void> {
  const db = getDatabase();
  await db.plotErrorAnalysis.deleteMany({ where: { bookId } });
}

// ============================================
// Conflict Detection
// ============================================

export interface ChapterConflict {
  chapterId: string;
  chapterTitle: string;
  type: 'deleted_in_db' | 'deleted_in_file' | 'both_modified';
  dbUpdatedAt?: Date;
  fileUpdatedAt?: Date;
}

export async function detectChapterConflicts(
  bookId: string,
  fileChapters: Chapter[]
): Promise<ChapterConflict[]> {
  const db = getDatabase();
  const conflicts: ChapterConflict[] = [];
  
  const dbChapters = await db.chapter.findMany({
    where: { bookId },
    select: { id: true, title: true, updatedAt: true },
  });
  
  const dbChapterMap = new Map(dbChapters.map(c => [c.id, c]));
  const fileChapterMap = new Map(fileChapters.map(c => [c.id, c]));
  
  // Check for chapters in DB but not in file (deleted in file)
  for (const [id, dbChapter] of dbChapterMap) {
    if (!fileChapterMap.has(id)) {
      conflicts.push({
        chapterId: id,
        chapterTitle: dbChapter.title,
        type: 'deleted_in_file',
        dbUpdatedAt: dbChapter.updatedAt,
      });
    }
  }
  
  // Check for chapters in file but not in DB (deleted in DB or new)
  for (const [id, fileChapter] of fileChapterMap) {
    const dbChapter = dbChapterMap.get(id);
    if (!dbChapter) {
      // This could be a new chapter or deleted from DB
      // We'll treat it as deleted from DB if the book exists
      const exists = await db.book.findUnique({ where: { id: bookId } });
      if (exists) {
        conflicts.push({
          chapterId: id,
          chapterTitle: fileChapter.title,
          type: 'deleted_in_db',
          fileUpdatedAt: new Date(fileChapter.updatedAt),
        });
      }
    }
  }
  
  return conflicts;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a book exists in the database
 */
export async function bookExists(bookId: string): Promise<boolean> {
  const db = getDatabase();
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  });
  return book !== null;
}

// ============================================
// Revision Pass Operations
// ============================================

export async function createRevisionPass(
  bookId: string,
  params: { title: string; date: Date }
): Promise<RevisionPass> {
  const db = getDatabase();
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { id: true },
  });
  if (!book) {
    throw new Error('BOOK_NOT_FOUND');
  }
  const existing = await db.revisionPass.findMany({
    where: { bookId },
    select: { revisionNumber: true },
    orderBy: { revisionNumber: 'desc' },
    take: 1,
  });
  const revisionNumber = existing.length > 0 ? existing[0].revisionNumber + 1 : 1;
  const created = await db.revisionPass.create({
    data: {
      bookId,
      revisionNumber,
      title: params.title,
      date: params.date,
    },
  });
  return {
    id: created.id,
    bookId: created.bookId,
    revisionNumber: created.revisionNumber,
    title: created.title,
    date: created.date.toISOString(),
  };
}

export async function setChapterCompletedForRevision(
  chapterId: string,
  revisionId: string
): Promise<void> {
  const db = getDatabase();
  await db.chapterRevisionCompletion.upsert({
    where: {
      chapterId_revisionId: { chapterId, revisionId },
    },
    create: {
      chapterId,
      revisionId,
      completedAt: new Date(),
    },
    update: {
      completedAt: new Date(),
    },
  });
}

export async function unsetChapterCompletedForRevision(
  chapterId: string,
  revisionId: string
): Promise<void> {
  const db = getDatabase();
  await db.chapterRevisionCompletion.deleteMany({
    where: { chapterId, revisionId },
  });
}

/**
 * Get chapter timestamps for conflict detection
 */
export async function getChapterTimestamps(bookId: string): Promise<Record<string, string>> {
  const db = getDatabase();
  const chapters = await db.chapter.findMany({
    where: { bookId },
    select: { id: true, updatedAt: true },
  });
  
  const timestamps: Record<string, string> = {};
  for (const chapter of chapters) {
    timestamps[chapter.id] = chapter.updatedAt.toISOString();
  }
  return timestamps;
}

/**
 * Load only revision passes and completions for a book (e.g. after loading book from file).
 */
export async function getRevisionDataForBook(bookId: string): Promise<{
  revisionPasses: RevisionPass[];
  chapterRevisionCompletions: ChapterRevisionCompletion[];
}> {
  const db = getDatabase();
  const passes = await db.revisionPass.findMany({
    where: { bookId },
    orderBy: { revisionNumber: 'asc' },
    include: { completions: true },
  });
  const revisionPasses: RevisionPass[] = passes.map((rp) => ({
    id: rp.id,
    bookId: rp.bookId,
    revisionNumber: rp.revisionNumber,
    title: rp.title,
    date: rp.date.toISOString(),
  }));
  const chapterRevisionCompletions: ChapterRevisionCompletion[] = passes.flatMap((rp) =>
    (rp.completions || []).map((c: { id: string; chapterId: string; revisionId: string; completedAt: Date | null }) => ({
      id: c.id,
      chapterId: c.chapterId,
      revisionId: c.revisionId,
      completedAt: c.completedAt?.toISOString(),
    }))
  );
  return { revisionPasses, chapterRevisionCompletions };
}

/**
 * Load a book from database and convert to App format.
 * Outline is loaded separately so the app still works if the book_outlines migration has not been run.
 */
export async function loadBookFromDatabase(bookId: string): Promise<Book | null> {
  const dbBook = await getBookById(bookId);
  if (!dbBook) return null;
  let outlineRow: DbBookWithRelations['outline'] = null;
  try {
    const outline = await getBookOutline(bookId);
    if (outline) {
      outlineRow = {
        id: outline.id,
        bookId: outline.bookId,
        content: outline.content,
        updatedAt: new Date(outline.updatedAt),
      } as DbBookWithRelations['outline'];
    }
  } catch {
    // book_outlines table may not exist yet (migration not run)
  }
  const dbBookWithOutline: DbBookWithRelations = { ...dbBook, outline: outlineRow };
  return await dbBookToAppBook(dbBookWithOutline);
}
