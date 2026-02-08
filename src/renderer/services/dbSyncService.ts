/**
 * Database Sync Service
 * Handles bidirectional synchronization between local files and PostgreSQL database
 * with chapter-level conflict detection
 */

import { Book, Chapter } from '../../shared/types';
import { databaseService, ChapterConflict, SyncResult } from './databaseService';
import { useBookStore } from '../stores/bookStore';

// Conflict resolution choices
export type ConflictResolution = 'keep_db' | 'keep_file' | 'keep_both';

export interface ConflictWithResolution extends ChapterConflict {
  resolution?: ConflictResolution;
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingConflicts: ConflictWithResolution[];
  error: string | null;
}

// Callback type for conflict resolution
export type ConflictResolver = (conflicts: ConflictWithResolution[]) => Promise<ConflictWithResolution[]>;

/**
 * Database Sync Service
 */
class DbSyncService {
  private state: SyncState = {
    isSyncing: false,
    lastSyncAt: null,
    pendingConflicts: [],
    error: null,
  };

  private conflictResolver: ConflictResolver | null = null;
  private currentUserId: string | null = null;

  /**
   * Set the current user ID for sync operations
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Set conflict resolver callback (called when conflicts need user input)
   */
  setConflictResolver(resolver: ConflictResolver): void {
    this.conflictResolver = resolver;
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Check if database is available
   */
  async isDatabaseAvailable(): Promise<boolean> {
    return databaseService.checkConnection();
  }

  /**
   * Perform full sync between store and database
   * This is the main entry point called during autosave
   */
  async syncBook(book: Book): Promise<SyncResult> {
    if (!this.currentUserId) {
      console.log('[DbSyncService] No user ID set, skipping database sync');
      return { success: true }; // Silent skip if no user
    }

    if (this.state.isSyncing) {
      console.log('[DbSyncService] Sync already in progress, skipping');
      return { success: false, error: 'Sync already in progress' };
    }

    this.state.isSyncing = true;
    this.state.error = null;

    try {
      // Check if database is available
      const isConnected = await this.isDatabaseAvailable();
      if (!isConnected) {
        console.log('[DbSyncService] Database not available, skipping sync');
        return { success: true }; // Silent skip if DB not available
      }

      // Check if book exists in database
      const bookExists = await databaseService.bookExists(book.id);

      if (!bookExists) {
        // Book doesn't exist in DB - create it
        console.log('[DbSyncService] Book not in DB, creating...');
        const bookId = await databaseService.createBook(this.currentUserId, book);
        if (bookId) {
          this.state.lastSyncAt = new Date();
          return { success: true };
        }
        return { success: false, error: 'Failed to create book in database' };
      }

      // Book exists - check for conflicts
      const conflicts = await this.detectConflicts(book);

      if (conflicts.length > 0) {
        // Handle conflicts
        const resolvedConflicts = await this.handleConflicts(conflicts, book);
        
        if (resolvedConflicts.some(c => !c.resolution)) {
          // Some conflicts unresolved
          this.state.pendingConflicts = resolvedConflicts;
          return {
            success: false,
            conflicts: resolvedConflicts,
            error: 'Unresolved conflicts',
          };
        }

        // Apply resolutions
        await this.applyConflictResolutions(book, resolvedConflicts);
      }

      // Sync to database
      const result = await databaseService.syncBookToDatabase(this.currentUserId, book);
      
      if (result.success) {
        this.state.lastSyncAt = new Date();
        this.state.pendingConflicts = [];
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.state.error = errorMessage;
      console.error('[DbSyncService] Sync failed:', error);
      return { success: false, error: errorMessage };
    } finally {
      this.state.isSyncing = false;
    }
  }

  /**
   * Detect conflicts between local book and database
   */
  async detectConflicts(book: Book): Promise<ConflictWithResolution[]> {
    const dbTimestamps = await databaseService.getChapterTimestamps(book.id);
    const conflicts: ConflictWithResolution[] = [];

    // Get DB chapter IDs
    const dbChapterIds = new Set(dbTimestamps.keys());
    const localChapterIds = new Set(book.chapters.map(c => c.id));

    // Check for chapters deleted locally but still in DB
    for (const dbChapterId of dbChapterIds) {
      if (!localChapterIds.has(dbChapterId)) {
        const dbTimestamp = dbTimestamps.get(dbChapterId);
        conflicts.push({
          chapterId: dbChapterId,
          chapterTitle: `Chapter (ID: ${dbChapterId.slice(0, 8)}...)`,
          type: 'deleted_locally',
          dbUpdatedAt: dbTimestamp?.toISOString(),
        });
      }
    }

    // Check for chapters deleted in DB but exist locally
    for (const chapter of book.chapters) {
      if (!dbChapterIds.has(chapter.id)) {
        // Chapter exists locally but not in DB
        // This could be a new chapter OR deleted from DB
        // We'll check if the book was previously synced
        if (this.state.lastSyncAt) {
          const chapterCreatedAt = new Date(chapter.createdAt);
          if (chapterCreatedAt < this.state.lastSyncAt) {
            // Chapter was created before last sync but not in DB = deleted from DB
            conflicts.push({
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              type: 'deleted_in_db',
              localUpdatedAt: chapter.updatedAt,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Handle detected conflicts
   */
  private async handleConflicts(
    conflicts: ConflictWithResolution[],
    book: Book
  ): Promise<ConflictWithResolution[]> {
    if (this.conflictResolver) {
      // Use custom resolver (UI dialog)
      return this.conflictResolver(conflicts);
    }

    // Default resolution: newest wins
    return conflicts.map(conflict => ({
      ...conflict,
      resolution: this.getDefaultResolution(conflict),
    }));
  }

  /**
   * Get default resolution based on timestamps
   */
  private getDefaultResolution(conflict: ConflictWithResolution): ConflictResolution {
    if (conflict.type === 'deleted_locally') {
      // Chapter deleted locally - keep local state (delete from DB)
      return 'keep_file';
    }
    
    if (conflict.type === 'deleted_in_db') {
      // Chapter deleted from DB - keep local state
      return 'keep_file';
    }

    // For both_modified, compare timestamps
    const dbTime = conflict.dbUpdatedAt ? new Date(conflict.dbUpdatedAt).getTime() : 0;
    const fileTime = conflict.localUpdatedAt ? new Date(conflict.localUpdatedAt).getTime() : 0;

    return dbTime > fileTime ? 'keep_db' : 'keep_file';
  }

  /**
   * Apply conflict resolutions to the book
   */
  private async applyConflictResolutions(
    book: Book,
    conflicts: ConflictWithResolution[]
  ): Promise<void> {
    const store = useBookStore.getState();

    for (const conflict of conflicts) {
      if (!conflict.resolution) continue;

      switch (conflict.resolution) {
        case 'keep_db':
          // Load chapter from DB and update store
          if (conflict.type === 'deleted_locally') {
            // Restore chapter from DB
            const dbBook = await databaseService.getBookById(book.id);
            if (dbBook) {
              const dbChapter = dbBook.chapters.find((c: Chapter) => c.id === conflict.chapterId);
              if (dbChapter) {
                store.importChapter(dbChapter);
              }
            }
          }
          break;

        case 'keep_file':
          // Keep local version - DB will be updated during sync
          // If chapter was deleted in DB, it will be re-created
          break;

        case 'keep_both':
          // Create a copy of the DB version with new ID
          if (conflict.type === 'deleted_locally' || conflict.type === 'both_modified') {
            const dbBook = await databaseService.getBookById(book.id);
            if (dbBook) {
              const dbChapter = dbBook.chapters.find((c: Chapter) => c.id === conflict.chapterId);
              if (dbChapter) {
                const copiedChapter: Chapter = {
                  ...dbChapter,
                  id: `${dbChapter.id}-db-copy`,
                  title: `${dbChapter.title} (DB Version)`,
                  order: book.chapters.length + 1,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                store.importChapter(copiedChapter);
              }
            }
          }
          break;
      }
    }
  }

  /**
   * Load book from database (pull)
   */
  async loadBookFromDatabase(bookId: string): Promise<Book | null> {
    try {
      return await databaseService.loadBookFromDatabase(bookId);
    } catch (error) {
      console.error('[DbSyncService] Failed to load book from DB:', error);
      return null;
    }
  }

  /**
   * Get list of books for current user
   */
  async getUserBooks(): Promise<Array<{ id: string; title: string; author: string; updatedAt: string }>> {
    if (!this.currentUserId) {
      return [];
    }
    
    try {
      return await databaseService.getBooksByUser(this.currentUserId);
    } catch (error) {
      console.error('[DbSyncService] Failed to get user books:', error);
      return [];
    }
  }

  /**
   * Compare book timestamps to determine sync direction
   */
  async compareTimestamps(book: Book): Promise<'db_newer' | 'file_newer' | 'same' | 'no_db'> {
    const dbUpdatedAt = await databaseService.getBookUpdatedAt(book.id);
    
    if (!dbUpdatedAt) {
      return 'no_db';
    }

    const fileUpdatedAt = new Date(book.updatedAt);
    const diff = dbUpdatedAt.getTime() - fileUpdatedAt.getTime();

    if (Math.abs(diff) < 1000) {
      // Within 1 second - consider same
      return 'same';
    }

    return diff > 0 ? 'db_newer' : 'file_newer';
  }

  /**
   * Perform initial sync on app startup
   * Compares timestamps and decides which version to use
   */
  async performInitialSync(book: Book): Promise<{
    action: 'use_file' | 'use_db' | 'conflict' | 'create_in_db';
    dbBook?: Book;
    conflicts?: ConflictWithResolution[];
  }> {
    if (!this.currentUserId) {
      return { action: 'use_file' };
    }

    const isConnected = await this.isDatabaseAvailable();
    if (!isConnected) {
      return { action: 'use_file' };
    }

    const comparison = await this.compareTimestamps(book);

    switch (comparison) {
      case 'no_db':
        // Book doesn't exist in DB - create it
        return { action: 'create_in_db' };

      case 'same':
        // No changes needed
        return { action: 'use_file' };

      case 'db_newer':
        // DB has newer version
        const dbBook = await this.loadBookFromDatabase(book.id);
        if (dbBook) {
          // Check for chapter-level conflicts
          const conflicts = await this.detectConflicts(book);
          if (conflicts.length > 0) {
            return { action: 'conflict', dbBook, conflicts };
          }
          return { action: 'use_db', dbBook };
        }
        return { action: 'use_file' };

      case 'file_newer':
        // File has newer version - sync to DB
        return { action: 'use_file' };

      default:
        return { action: 'use_file' };
    }
  }

  /**
   * Resolve pending conflicts with user choices
   */
  async resolveConflicts(
    book: Book,
    resolutions: Map<string, ConflictResolution>
  ): Promise<SyncResult> {
    const conflicts = this.state.pendingConflicts.map(conflict => ({
      ...conflict,
      resolution: resolutions.get(conflict.chapterId) || 'keep_file',
    }));

    await this.applyConflictResolutions(book, conflicts);
    this.state.pendingConflicts = [];

    // Re-sync after applying resolutions
    return this.syncBook(book);
  }

  /**
   * Force sync from database to local (overwrites local)
   */
  async forceSyncFromDatabase(bookId: string): Promise<Book | null> {
    const dbBook = await this.loadBookFromDatabase(bookId);
    if (dbBook) {
      const store = useBookStore.getState();
      store.setBook(dbBook);
      this.state.lastSyncAt = new Date();
    }
    return dbBook;
  }

  /**
   * Force sync from local to database (overwrites DB)
   */
  async forceSyncToDatabase(book: Book): Promise<boolean> {
    if (!this.currentUserId) {
      return false;
    }

    const result = await databaseService.syncBookToDatabase(this.currentUserId, book);
    if (result.success) {
      this.state.lastSyncAt = new Date();
    }
    return result.success;
  }

  /**
   * Delete a book from the database
   */
  async deleteBookFromDatabase(bookId: string): Promise<boolean> {
    return databaseService.deleteBook(bookId);
  }

  /**
   * Clear sync state (for logout)
   */
  clearState(): void {
    this.state = {
      isSyncing: false,
      lastSyncAt: null,
      pendingConflicts: [],
      error: null,
    };
    this.currentUserId = null;
  }
}

// Export singleton instance
export const dbSyncService = new DbSyncService();
