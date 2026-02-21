import JSZip from 'jszip';
import { Book, Chapter, DocumentTab, SBKManifest, createNewBook, createDefaultDocumentTabs, DEFAULT_TIPTAP_CONTENT, DEFAULT_BOOK_SETTINGS } from '../../shared/types';
import { databaseService } from './databaseService';

const SBK_VERSION = '1.2'; // Updated to support database export

class FileService {
  /**
   * Save a book to .sbk format (zipped archive)
   * Returns base64 encoded data
   */
  async saveBook(book: Book): Promise<string> {
    const zip = new JSZip();

    // Create manifest (include bookId so this file stays linked to the same DB book on save)
    const manifest: SBKManifest = {
      version: SBK_VERSION,
      title: book.title,
      author: book.author,
      description: book.description,
      chapterOrder: book.chapters.map((c) => c.id),
      createdAt: book.createdAt,
      updatedAt: new Date().toISOString(),
      bookId: book.id,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Save settings
    zip.file('settings.json', JSON.stringify(book.settings, null, 2));

    // Save metadata
    zip.file('metadata.json', JSON.stringify(book.metadata, null, 2));

    // Save chapters
    const chaptersFolder = zip.folder('chapters');
    if (chaptersFolder) {
      for (const chapter of book.chapters) {
        const chapterData = {
          id: chapter.id,
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
          wordCount: chapter.wordCount,
          purpose: chapter.purpose,
          comments: chapter.comments || [],
          notes: chapter.notes || [],
          originalContent: chapter.originalContent,
          originalWordCount: chapter.originalWordCount,
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
        };
        chaptersFolder.file(`${chapter.id}.json`, JSON.stringify(chapterData, null, 2));
      }
    }

    // Save extracted data
    const extractedFolder = zip.folder('extracted');
    if (extractedFolder) {
      extractedFolder.file('characters.json', JSON.stringify(book.extracted.characters, null, 2));
      extractedFolder.file('locations.json', JSON.stringify(book.extracted.locations, null, 2));
      extractedFolder.file('timeline.json', JSON.stringify(book.extracted.timeline, null, 2));
      extractedFolder.file('summaries.json', JSON.stringify(book.extracted.summaries || [], null, 2));
      // New: Story Craft Feedback
      extractedFolder.file('storycraft.json', JSON.stringify(book.extracted.storyCraftFeedback || [], null, 2));
      // New: Themes and Motifs
      extractedFolder.file('themes.json', JSON.stringify(book.extracted.themesAndMotifs || { themes: [], motifs: [], symbols: [], lastUpdated: new Date().toISOString() }, null, 2));
    }

    // Save document tabs
    const tabsFolder = zip.folder('tabs');
    if (tabsFolder && book.documentTabs) {
      for (const tab of book.documentTabs) {
        const tabData = {
          id: tab.id,
          title: tab.title,
          content: tab.content,
          icon: tab.icon,
          color: tab.color,
          isPermanent: tab.isPermanent,
          tabType: tab.tabType,
          createdAt: tab.createdAt,
          updatedAt: tab.updatedAt,
        };
        tabsFolder.file(`${tab.id}.json`, JSON.stringify(tabData, null, 2));
      }
    }

    // Save book outline (Markdown)
    if (book.outline && book.outline.content) {
      zip.file('outline.json', JSON.stringify({
        content: book.outline.content,
        updatedAt: book.outline.updatedAt,
      }, null, 2));
    }

    // Save songs
    const songs = book.songs ?? [];
    if (songs.length > 0) {
      zip.file('songs.json', JSON.stringify(songs, null, 2));
    }

    // Generate zip file
    const blob = await zip.generateAsync({ type: 'base64' });
    return blob;
  }

  /**
   * Load a book from .sbk format (base64 encoded zip)
   */
  async loadBook(base64Data: string): Promise<Book> {
    const zip = await JSZip.loadAsync(base64Data, { base64: true });

    // Read manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Invalid .sbk file: missing manifest.json');
    }
    const manifest: SBKManifest = JSON.parse(await manifestFile.async('string'));

    // Read settings and merge with defaults for backwards compatibility
    const settingsFile = zip.file('settings.json');
    const loadedSettings = settingsFile
      ? JSON.parse(await settingsFile.async('string'))
      : {};
    
    // Merge with defaults to ensure all new fields exist
    const settings = {
      ...DEFAULT_BOOK_SETTINGS,
      ...loadedSettings,
      // Ensure page size and margins have all required fields
      pageSize: {
        ...DEFAULT_BOOK_SETTINGS.pageSize,
        ...(loadedSettings.pageSize || {}),
      },
      margins: {
        ...DEFAULT_BOOK_SETTINGS.margins,
        ...(loadedSettings.margins || {}),
      },
    };

    // Read metadata
    const metadataFile = zip.file('metadata.json');
    const metadata = metadataFile
      ? JSON.parse(await metadataFile.async('string'))
      : { language: 'en', keywords: [] };

    // Read chapters
    const chapters: Chapter[] = [];
    const chaptersFolder = zip.folder('chapters');
    if (chaptersFolder) {
      for (const chapterId of manifest.chapterOrder) {
        const chapterFile = chaptersFolder.file(`${chapterId}.json`);
        if (chapterFile) {
          const chapterData = JSON.parse(await chapterFile.async('string'));
          const content = chapterData.content || DEFAULT_TIPTAP_CONTENT;
          const wordCount = chapterData.wordCount ?? 0;
          // Variation history is DB-only; do not load from file. Set original if missing.
          const originalContent = chapterData.originalContent ?? content;
          const originalWordCount = chapterData.originalWordCount ?? wordCount;
          chapters.push({
            id: chapterData.id,
            title: chapterData.title,
            content,
            order: chapterData.order,
            wordCount,
            purpose: chapterData.purpose,
            comments: chapterData.comments || [],
            notes: chapterData.notes || [],
            variations: [],
            originalContent,
            originalWordCount,
            createdAt: chapterData.createdAt,
            updatedAt: chapterData.updatedAt,
          });
        }
      }
    }

    // If no chapters found, create a default one
    if (chapters.length === 0) {
      const defaultContent = DEFAULT_TIPTAP_CONTENT;
      chapters.push({
        id: `chapter-${Date.now()}`,
        title: 'Chapter 1',
        content: defaultContent,
        order: 1,
        wordCount: 0,
        purpose: undefined,
        comments: [],
        notes: [],
        variations: [],
        originalContent: defaultContent,
        originalWordCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Read extracted data
    const extractedFolder = zip.folder('extracted');
    const extracted = {
      characters: [] as any[],
      locations: [] as any[],
      timeline: [] as any[],
      summaries: [] as any[],
      storyCraftFeedback: [] as any[],
      themesAndMotifs: {
        themes: [] as any[],
        motifs: [] as any[],
        symbols: [] as any[],
        lastUpdated: new Date().toISOString(),
      },
      lastExtracted: undefined as string | undefined,
    };

    if (extractedFolder) {
      const charactersFile = extractedFolder.file('characters.json');
      if (charactersFile) {
        extracted.characters = JSON.parse(await charactersFile.async('string'));
      }

      const locationsFile = extractedFolder.file('locations.json');
      if (locationsFile) {
        extracted.locations = JSON.parse(await locationsFile.async('string'));
      }

      const timelineFile = extractedFolder.file('timeline.json');
      if (timelineFile) {
        extracted.timeline = JSON.parse(await timelineFile.async('string'));
      }

      const summariesFile = extractedFolder.file('summaries.json');
      if (summariesFile) {
        extracted.summaries = JSON.parse(await summariesFile.async('string'));
      }

      // New: Story Craft Feedback
      const storyCraftFile = extractedFolder.file('storycraft.json');
      if (storyCraftFile) {
        extracted.storyCraftFeedback = JSON.parse(await storyCraftFile.async('string'));
      }

      // New: Themes and Motifs
      const themesFile = extractedFolder.file('themes.json');
      if (themesFile) {
        extracted.themesAndMotifs = JSON.parse(await themesFile.async('string'));
      }
    }

    // Read document tabs
    const tabsFolder = zip.folder('tabs');
    let documentTabs: DocumentTab[] = [];
    
    if (tabsFolder) {
      // Get all tab files
      const tabFiles = Object.keys(zip.files).filter(
        f => f.startsWith('tabs/') && f.endsWith('.json')
      );
      
      for (const filePath of tabFiles) {
        const tabFile = zip.file(filePath);
        if (tabFile) {
          try {
            const tabData = JSON.parse(await tabFile.async('string'));
            documentTabs.push({
              id: tabData.id,
              title: tabData.title,
              content: tabData.content || DEFAULT_TIPTAP_CONTENT,
              icon: tabData.icon,
              color: tabData.color,
              isPermanent: tabData.isPermanent,
              tabType: tabData.tabType,
              createdAt: tabData.createdAt,
              updatedAt: tabData.updatedAt,
            });
          } catch (e) {
            console.error('Error loading tab:', filePath, e);
          }
        }
      }
    }
    
    // If no document tabs found (older file format), create default ones
    if (documentTabs.length === 0) {
      documentTabs = createDefaultDocumentTabs();
    } else {
      // Migration: ensure all permanent tabs exist
      const now = new Date().toISOString();
      const permanentTabDefs: Array<{ id: string; title: string; icon: string; tabType: DocumentTab['tabType'] }> = [
        { id: 'characters-tab', title: 'Characters', icon: '👤', tabType: 'characters' },
        { id: 'locations-tab', title: 'Locations', icon: '📍', tabType: 'locations' },
        { id: 'timeline-tab', title: 'Timeline', icon: '📅', tabType: 'timeline' },
        { id: 'summaries-tab', title: 'Summaries', icon: '📝', tabType: 'summaries' },
        { id: 'storycraft-tab', title: 'Story Craft', icon: '🎭', tabType: 'storycraft' },
        { id: 'outliner-tab', title: 'Outliner', icon: '📋', tabType: 'outliner' },
        { id: 'themes-tab', title: 'Themes & Motifs', icon: '🎨', tabType: 'themes' },
        { id: 'plotanalysis-tab', title: 'Plot Analysis', icon: '🔍', tabType: 'plotanalysis' },
        { id: 'songs-tab', title: 'Songs', icon: '🎵', tabType: 'songs' },
      ];
      
      const missingTabs = permanentTabDefs
        .filter(pt => !documentTabs.some(et => et.tabType === pt.tabType))
        .map(pt => ({
          ...pt,
          content: DEFAULT_TIPTAP_CONTENT,
          isPermanent: true,
          createdAt: now,
          updatedAt: now,
        } as DocumentTab));
      
      if (missingTabs.length > 0) {
        console.log('[FileService] Adding missing permanent tabs:', missingTabs.map(t => t.title));
        documentTabs = [...documentTabs, ...missingTabs];
      }
    }
    
    // Migration: ensure extracted data has new fields
    if (!extracted.storyCraftFeedback) {
      extracted.storyCraftFeedback = [];
    }
    if (!extracted.themesAndMotifs) {
      extracted.themesAndMotifs = {
        themes: [],
        motifs: [],
        symbols: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Use linked book id from manifest when present so save syncs to the same DB row
    const bookId = manifest.bookId ?? `book-${Date.now()}`;

    // Read book outline if present
    let outline: Book['outline'] = null;
    const outlineFile = zip.file('outline.json');
    if (outlineFile) {
      try {
        const outlineData = JSON.parse(await outlineFile.async('string'));
        outline = {
          id: `outline-${bookId}`,
          bookId,
          content: outlineData.content ?? '',
          updatedAt: outlineData.updatedAt ?? new Date().toISOString(),
        };
      } catch {
        outline = null;
      }
    }

    // Read songs if present
    let songs: Book['songs'] = [];
    const songsFile = zip.file('songs.json');
    if (songsFile) {
      try {
        songs = JSON.parse(await songsFile.async('string'));
        if (!Array.isArray(songs)) songs = [];
      } catch {
        songs = [];
      }
    }

    // Construct book object
    const book: Book = {
      id: bookId,
      title: manifest.title,
      author: manifest.author,
      description: manifest.description,
      chapters,
      documentTabs,
      outline,
      metadata,
      settings,
      extracted,
      revisionPasses: [],
      chapterRevisionCompletions: [],
      songs,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
    };

    return book;
  }

  /**
   * Export a book from the database to .sbk format
   * @param bookId The ID of the book in the database
   * @returns Base64 encoded .sbk file data, or null if book not found
   */
  async exportBookFromDatabase(bookId: string): Promise<string | null> {
    try {
      // Load book from database
      const dbBook = await databaseService.getBookById(bookId);
      
      if (!dbBook) {
        console.error('[FileService] Book not found in database:', bookId);
        return null;
      }
      
      // Convert to standard format and save
      return await this.saveBook(dbBook);
    } catch (error) {
      console.error('[FileService] Error exporting book from database:', error);
      return null;
    }
  }

  /**
   * Export all books for a user from the database
   * @param userId The ID of the user
   * @returns Array of { bookId, title, data } objects
   */
  async exportAllBooksFromDatabase(userId: string): Promise<Array<{ bookId: string; title: string; data: string }>> {
    try {
      const books = await databaseService.getBooksByUser(userId);
      const exports: Array<{ bookId: string; title: string; data: string }> = [];
      
      for (const bookSummary of books) {
        const data = await this.exportBookFromDatabase(bookSummary.id);
        if (data) {
          exports.push({
            bookId: bookSummary.id,
            title: bookSummary.title,
            data,
          });
        }
      }
      
      return exports;
    } catch (error) {
      console.error('[FileService] Error exporting all books from database:', error);
      return [];
    }
  }

  /**
   * Import a book from .sbk file to database
   * @param base64Data The base64 encoded .sbk file
   * @param userId The ID of the user to assign the book to
   * @returns The book ID in the database, or null on failure
   */
  async importBookToDatabase(base64Data: string, userId: string): Promise<string | null> {
    try {
      // Load book from .sbk file
      const book = await this.loadBook(base64Data);
      
      // Save to database
      const bookId = await databaseService.createBook(userId, book);
      
      if (bookId) {
        console.log('[FileService] Imported book to database:', bookId);
        return bookId;
      }
      
      return null;
    } catch (error) {
      console.error('[FileService] Error importing book to database:', error);
      return null;
    }
  }
}

export const fileService = new FileService();

