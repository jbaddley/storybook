import JSZip from 'jszip';
import { Book, Chapter, DocumentTab, SBKManifest, createNewBook, createDefaultDocumentTabs, DEFAULT_TIPTAP_CONTENT, DEFAULT_BOOK_SETTINGS } from '../../shared/types';

const SBK_VERSION = '1.1'; // Updated to include documentTabs

class FileService {
  /**
   * Save a book to .sbk format (zipped archive)
   * Returns base64 encoded data
   */
  async saveBook(book: Book): Promise<string> {
    const zip = new JSZip();

    // Create manifest
    const manifest: SBKManifest = {
      version: SBK_VERSION,
      title: book.title,
      author: book.author,
      description: book.description,
      chapterOrder: book.chapters.map((c) => c.id),
      createdAt: book.createdAt,
      updatedAt: new Date().toISOString(),
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
          chapters.push({
            id: chapterData.id,
            title: chapterData.title,
            content: chapterData.content || DEFAULT_TIPTAP_CONTENT,
            order: chapterData.order,
            wordCount: chapterData.wordCount || 0,
            createdAt: chapterData.createdAt,
            updatedAt: chapterData.updatedAt,
          });
        }
      }
    }

    // If no chapters found, create a default one
    if (chapters.length === 0) {
      chapters.push({
        id: `chapter-${Date.now()}`,
        title: 'Chapter 1',
        content: DEFAULT_TIPTAP_CONTENT,
        order: 1,
        wordCount: 0,
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
    }

    // Construct book object
    const book: Book = {
      id: `book-${Date.now()}`,
      title: manifest.title,
      author: manifest.author,
      description: manifest.description,
      chapters,
      documentTabs,
      metadata,
      settings,
      extracted,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
    };

    return book;
  }
}

export const fileService = new FileService();

