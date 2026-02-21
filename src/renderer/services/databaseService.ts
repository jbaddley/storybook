/**
 * Database Service for Renderer Process
 * Communicates with main process via IPC for database operations
 */

import { Book, Chapter, ChapterVariation, RevisionPass, ChapterRevisionCompletion } from '../../shared/types';

// Type-safe accessor for electronAPI database methods
interface DatabaseElectronAPI {
  dbCheckConnection: () => Promise<boolean>;
  dbFindOrCreateUserByGoogle: (params: { 
    googleId: string; 
    email: string; 
    name: string; 
    picture?: string;
  }) => Promise<DbUser>;
  dbGetUserById: (userId: string) => Promise<DbUser | null>;
  dbGetBooksByUser: (userId: string) => Promise<DbBookSummary[]>;
  dbGetBookById: (bookId: string) => Promise<Book | null>;
  dbCreateBook: (params: { userId: string; book: Book }) => Promise<{ id: string }>;
  dbUpdateBook: (params: { bookId: string; book: Book }) => Promise<unknown>;
  dbDeleteBook: (bookId: string) => Promise<boolean>;
  dbGetBookUpdatedAt: (bookId: string) => Promise<Date | null>;
  dbBookExists: (bookId: string) => Promise<boolean>;
  dbGetChapterTimestamps: (bookId: string) => Promise<Record<string, string>>;
  dbSyncBookToDatabase: (params: { userId: string; book: Book }) => Promise<unknown>;
  dbLoadBookFromDatabase: (bookId: string) => Promise<Book | null>;
  dbGetRevisionDataForBook: (bookId: string) => Promise<{ revisionPasses: unknown[]; chapterRevisionCompletions: unknown[] } | null>;
  dbDetectChapterConflicts: (params: { bookId: string; localChapters: Chapter[] }) => Promise<ChapterConflict[]>;
  dbGetVariationsForChapter: (chapterId: string) => Promise<ChapterVariation[]>;
  dbAddChapterVariation: (chapterId: string, variation: ChapterVariation) => Promise<void>;
  dbDeleteChapterVariation: (variationId: string) => Promise<void>;
  dbCreateRevisionPass: (params: { bookId: string; title: string; date: string }) => Promise<RevisionPass>;
  dbSetChapterCompletedForRevision: (params: { chapterId: string; revisionId: string }) => Promise<void>;
  dbUnsetChapterCompletedForRevision: (params: { chapterId: string; revisionId: string }) => Promise<void>;
}

// Get the database-specific methods from electronAPI
const getDbApi = (): DatabaseElectronAPI => {
  return window.electronAPI as unknown as DatabaseElectronAPI;
};

// Type definitions for IPC responses
export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  googleId: string;
  picture?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbBookSummary {
  id: string;
  title: string;
  author: string;
  updatedAt: string;
  chapterCount?: number;
}

export interface ChapterConflict {
  chapterId: string;
  chapterTitle: string;
  type: 'deleted_in_db' | 'deleted_locally' | 'both_modified';
  dbUpdatedAt?: string;
  localUpdatedAt?: string;
}

export interface SyncResult {
  success: boolean;
  conflicts?: ChapterConflict[];
  error?: string;
}

/**
 * Database service singleton for renderer process
 */
class DatabaseService {
  private isConnected: boolean = false;

  /**
   * Check if database is connected
   */
  async checkConnection(): Promise<boolean> {
    try {
      const result = await getDbApi().dbCheckConnection();
      this.isConnected = result;
      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get connection status (cached)
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // ============================================
  // User Operations
  // ============================================

  /**
   * Find or create user by Google OAuth credentials
   */
  async findOrCreateUserByGoogle(
    googleId: string,
    email: string,
    name: string,
    picture?: string
  ): Promise<DbUser | null> {
    try {
      const result = await getDbApi().dbFindOrCreateUserByGoogle({
        googleId,
        email,
        name,
        picture,
      });
      return result;
    } catch (error) {
      console.error('[DatabaseService] findOrCreateUserByGoogle failed:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<DbUser | null> {
    try {
      return await getDbApi().dbGetUserById(userId);
    } catch (error) {
      console.error('[DatabaseService] getUserById failed:', error);
      return null;
    }
  }

  // ============================================
  // Book Operations
  // ============================================

  /**
   * Get all books for a user
   */
  async getBooksByUser(userId: string): Promise<DbBookSummary[]> {
    try {
      return await getDbApi().dbGetBooksByUser(userId);
    } catch (error) {
      console.error('[DatabaseService] getBooksByUser failed:', error);
      return [];
    }
  }

  /**
   * Get a book by ID with all relations
   */
  async getBookById(bookId: string): Promise<Book | null> {
    try {
      return await getDbApi().dbGetBookById(bookId);
    } catch (error) {
      console.error('[DatabaseService] getBookById failed:', error);
      return null;
    }
  }

  /**
   * Create a new book
   */
  async createBook(userId: string, book: Book): Promise<string | null> {
    try {
      const result = await getDbApi().dbCreateBook({ userId, book });
      // Main process returns the book id string directly
      if (typeof result === 'string') return result;
      return (result as { id?: string })?.id ?? null;
    } catch (error) {
      console.error('[DatabaseService] createBook failed:', error);
      return null;
    }
  }

  /**
   * Update a book
   */
  async updateBook(bookId: string, book: Book): Promise<boolean> {
    try {
      await getDbApi().dbUpdateBook({ bookId, book });
      return true;
    } catch (error) {
      console.error('[DatabaseService] updateBook failed:', error);
      return false;
    }
  }

  /**
   * Delete a book
   */
  async deleteBook(bookId: string): Promise<boolean> {
    try {
      return await getDbApi().dbDeleteBook(bookId);
    } catch (error) {
      console.error('[DatabaseService] deleteBook failed:', error);
      return false;
    }
  }

  /**
   * Get book's last updated timestamp
   */
  async getBookUpdatedAt(bookId: string): Promise<Date | null> {
    try {
      const result = await getDbApi().dbGetBookUpdatedAt(bookId);
      return result ? new Date(result) : null;
    } catch (error) {
      console.error('[DatabaseService] getBookUpdatedAt failed:', error);
      return null;
    }
  }

  /**
   * Check if a book exists in the database
   */
  async bookExists(bookId: string): Promise<boolean> {
    try {
      return await getDbApi().dbBookExists(bookId);
    } catch (error) {
      console.error('[DatabaseService] bookExists failed:', error);
      return false;
    }
  }

  // ============================================
  // Sync Operations
  // ============================================

  /**
   * Sync a book to the database
   */
  async syncBookToDatabase(userId: string, book: Book): Promise<SyncResult> {
    try {
      await getDbApi().dbSyncBookToDatabase({ userId, book });
      return {
        success: true,
        conflicts: [],
      };
    } catch (error) {
      console.error('[DatabaseService] syncBookToDatabase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load a book from the database
   */
  async loadBookFromDatabase(bookId: string): Promise<Book | null> {
    try {
      return await getDbApi().dbLoadBookFromDatabase(bookId);
    } catch (error) {
      console.error('[DatabaseService] loadBookFromDatabase failed:', error);
      return null;
    }
  }

  /**
   * Load only revision passes and completions for a book (e.g. after loading from file).
   */
  async getRevisionDataForBook(bookId: string): Promise<{
    revisionPasses: RevisionPass[];
    chapterRevisionCompletions: ChapterRevisionCompletion[];
  } | null> {
    try {
      const result = await getDbApi().dbGetRevisionDataForBook(bookId);
      return {
        revisionPasses: (result?.revisionPasses ?? []) as RevisionPass[],
        chapterRevisionCompletions: (result?.chapterRevisionCompletions ?? []) as ChapterRevisionCompletion[],
      };
    } catch (error) {
      console.error('[DatabaseService] getRevisionDataForBook failed:', error);
      return null;
    }
  }

  /**
   * Detect conflicts between DB and local chapters
   */
  async detectChapterConflicts(
    bookId: string,
    localChapters: Chapter[]
  ): Promise<ChapterConflict[]> {
    try {
      return await getDbApi().dbDetectChapterConflicts({
        bookId,
        localChapters,
      });
    } catch (error) {
      console.error('[DatabaseService] detectChapterConflicts failed:', error);
      return [];
    }
  }

  /**
   * Get chapter timestamps for conflict detection
   */
  async getChapterTimestamps(bookId: string): Promise<Map<string, Date>> {
    try {
      const result = await getDbApi().dbGetChapterTimestamps(bookId);
      const map = new Map<string, Date>();
      // Result comes as object from IPC, convert to Map
      if (result && typeof result === 'object') {
        for (const [id, timestamp] of Object.entries(result)) {
          map.set(id, new Date(timestamp));
        }
      }
      return map;
    } catch (error) {
      console.error('[DatabaseService] getChapterTimestamps failed:', error);
      return new Map();
    }
  }

  // ============================================
  // Chapter Variation Operations (DB-only)
  // ============================================

  /**
   * Get all variations for a chapter from the database
   */
  async getVariationsForChapter(chapterId: string): Promise<ChapterVariation[]> {
    try {
      const result = await getDbApi().dbGetVariationsForChapter(chapterId);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[DatabaseService] getVariationsForChapter failed:', error);
      return [];
    }
  }

  /**
   * Add a variation to a chapter in the database
   */
  async addChapterVariation(chapterId: string, variation: ChapterVariation): Promise<boolean> {
    try {
      await getDbApi().dbAddChapterVariation(chapterId, variation);
      return true;
    } catch (error) {
      console.error('[DatabaseService] addChapterVariation failed:', error);
      return false;
    }
  }

  /**
   * Delete a variation from the database
   */
  async deleteChapterVariation(variationId: string): Promise<boolean> {
    try {
      await getDbApi().dbDeleteChapterVariation(variationId);
      return true;
    } catch (error) {
      console.error('[DatabaseService] deleteChapterVariation failed:', error);
      return false;
    }
  }

  // ============================================
  // Revision Pass Operations
  // ============================================

  /**
   * Create a new revision pass for a book.
   * Returns { pass } on success, or { pass: null, error } on failure (e.g. BOOK_NOT_FOUND, or DB error message).
   */
  async createRevisionPass(
    bookId: string,
    params: { title: string; date: string }
  ): Promise<{ pass: RevisionPass | null; error?: string }> {
    try {
      const result = await getDbApi().dbCreateRevisionPass({
        bookId,
        title: params.title,
        date: params.date,
      });
      return { pass: result as RevisionPass };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create revision pass';
      console.error('[DatabaseService] createRevisionPass failed:', message);
      // Normalize so callers can check result.error === 'BOOK_NOT_FOUND' (Electron may wrap the message)
      const normalized = message.includes('BOOK_NOT_FOUND') ? 'BOOK_NOT_FOUND' : message;
      return { pass: null, error: normalized };
    }
  }

  /**
   * Mark a chapter as done for a revision pass
   */
  async setChapterCompletedForRevision(chapterId: string, revisionId: string): Promise<boolean> {
    try {
      await getDbApi().dbSetChapterCompletedForRevision({ chapterId, revisionId });
      return true;
    } catch (error) {
      console.error('[DatabaseService] setChapterCompletedForRevision failed:', error);
      return false;
    }
  }

  /**
   * Unmark a chapter as done for a revision pass
   */
  async unsetChapterCompletedForRevision(chapterId: string, revisionId: string): Promise<boolean> {
    try {
      await getDbApi().dbUnsetChapterCompletedForRevision({ chapterId, revisionId });
      return true;
    } catch (error) {
      console.error('[DatabaseService] unsetChapterCompletedForRevision failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
