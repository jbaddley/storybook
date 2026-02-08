import { create } from 'zustand';
import { 
  Book, 
  Chapter, 
  ChapterComment,
  ChapterNote,
  ChapterVariation,
  DocumentTab,
  Character,
  Location,
  TimelineEvent,
  AISuggestion, 
  ChapterSummary, 
  StoryCraftChapterFeedback,
  StoryPromise,
  ThemesAndMotifs,
  Theme,
  Motif,
  Symbol,
  PlotErrorAnalysis,
  BackgroundTask,
  Toast,
  createNewBook, 
  createNewChapter,
  createNewDocumentTab,
  createDefaultDocumentTabs,
  generateId,
  TipTapContent,
  DEFAULT_TIPTAP_CONTENT
} from '../../shared/types';

interface SyncStatus {
  isSyncing: boolean;
  direction: 'push' | 'pull' | null;
  progress: string;
  error: string | null;
  success: string | null;
  timestamp: number | null;
}

/** Content editor page theme: light (white page) or dark (dark page) */
export type ContentEditorTheme = 'light' | 'dark';

export interface PanelSettings {
  showChaptersPanel: boolean;
  showAIPanel: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
}

interface UIState extends PanelSettings {
  zoom: number;
  isSettingsOpen: boolean;
  isDirty: boolean;
  currentFilePath: string | null;
  activeDocumentTabId: string | null; // null means viewing a chapter
  syncStatus: SyncStatus;
  currentUserId: string | null; // Current logged-in user ID from database
  isDbConnected: boolean; // Whether database connection is active
  /** Content editor page appearance: light (default) or dark */
  contentEditorTheme: ContentEditorTheme;
  /** Active tab in the AI panel: actions | chat | comments | notes */
  aiPanelTab: 'actions' | 'chat' | 'comments' | 'notes';
  /** When set, chat opens with this as the first user message and sends to LLM (e.g. from Comments "Send to Chat"). */
  pendingChatMessage: string | null;
  /** When set, chat opens with this text in the input only (e.g. from Editor "Add to chat") – user can edit before sending. */
  chatInputPreFill: string | null;
}

interface AIState {
  suggestions: AISuggestion[];
  summaries: Map<string, ChapterSummary>;
  isAnalyzing: boolean;
  isExtracting: boolean;
  /** Chapter ID currently running story craft analysis (single re-run or extract) */
  storyCraftRunningChapterId: string | null;
}

interface BookState {
  book: Book;
  activeChapterId: string | null;
  /** In-dialog pending variation draft (not yet added to chapter.variations) */
  pendingChapterVariation: Record<string, ChapterVariation>;
  ui: UIState;
  ai: AIState;
  
  // Book actions
  setBook: (book: Book) => void;
  updateBookMetadata: (updates: Partial<Book>) => void;
  newBook: () => void;
  
  // Chapter actions
  setActiveChapter: (chapterId: string) => void;
  addChapter: () => void;
  importChapter: (chapter: Chapter) => void;
  importFromGoogleDocs: (chapters: Chapter[], googleDocsSource: { documentId: string; documentName: string }) => void;
  setGoogleDocsExport: (exportInfo: { documentId: string; documentName: string; webViewLink: string; folderId?: string; folderPath?: string }) => void;
  deleteChapter: (chapterId: string) => void;
  insertChapterAt: (position: number) => void;
  updateChapter: (chapterId: string, updates: Partial<Chapter>) => void;
  updateChapterContent: (chapterId: string, content: TipTapContent) => void;
  reorderChapters: (sourceIndex: number, destinationIndex: number) => void;
  renumberChapters: () => void;
  
  // Comment actions
  addComment: (chapterId: string, comment: ChapterComment) => void;
  updateComment: (chapterId: string, commentId: string, updates: Partial<ChapterComment>) => void;
  deleteComment: (chapterId: string, commentId: string) => void;
  resolveComment: (chapterId: string, commentId: string) => void;
  clearChapterComments: (chapterId: string) => void;
  
  // Note actions
  addNote: (chapterId: string, note: ChapterNote) => void;
  updateNote: (chapterId: string, noteId: string, updates: Partial<ChapterNote>) => void;
  deleteNote: (chapterId: string, noteId: string) => void;
  
  // UI actions
  toggleChaptersPanel: () => void;
  toggleAIPanel: () => void;
  setPanelSettings: (settings: Partial<PanelSettings>) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setSettingsOpen: (open: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setCurrentFilePath: (path: string | null) => void;
  setCurrentUserId: (userId: string | null) => void;
  setDbConnected: (connected: boolean) => void;
  setContentEditorTheme: (theme: ContentEditorTheme) => void;
  setAIPanelTab: (tab: 'actions' | 'chat' | 'comments' | 'notes') => void;
  setPendingChatMessage: (msg: string | null) => void;
  setChatInputPreFill: (msg: string | null) => void;
  
  // Sync actions
  setSyncStatus: (status: Partial<SyncStatus>) => void;
  clearSyncStatus: () => void;
  
  // AI actions
  setSuggestions: (suggestions: AISuggestion[]) => void;
  clearSuggestions: () => void;
  addSummary: (summary: ChapterSummary) => void;
  setAISummaries: (summaries: Map<string, ChapterSummary>) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setExtracting: (extracting: boolean) => void;
  setStoryCraftRunningChapterId: (chapterId: string | null) => void;
  
  // Document Tab actions
  setActiveDocumentTab: (tabId: string | null) => void;
  addDocumentTab: (title: string) => void;
  deleteDocumentTab: (tabId: string) => void;
  updateDocumentTab: (tabId: string, updates: Partial<DocumentTab>) => void;
  updateDocumentTabContent: (tabId: string, content: TipTapContent) => void;
  
  // Extraction actions (with merging)
  addOrUpdateCharacter: (character: Omit<Character, 'id'>, chapterId: string, chapterTitle: string) => void;
  addOrUpdateLocation: (location: Omit<Location, 'id'>, chapterId: string, chapterTitle: string) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, 'id'>) => void;
  reorganizeTimeline: () => void;
  clearExtractedData: (type?: 'characters' | 'locations' | 'timeline') => void;
  
  // Edit extracted data
  updateCharacter: (id: string, updates: Partial<Omit<Character, 'id'>>) => void;
  deleteCharacter: (id: string) => void;
  updateLocation: (id: string, updates: Partial<Omit<Location, 'id'>>) => void;
  deleteLocation: (id: string) => void;
  updateTimelineEvent: (id: string, updates: Partial<Omit<TimelineEvent, 'id'>>) => void;
  deleteTimelineEvent: (id: string) => void;
  updateSummary: (chapterId: string, updates: { summary?: string; keyPoints?: string[] }) => void;
  deleteSummary: (chapterId: string) => void;
  
  // Story Craft Feedback actions
  addOrUpdateStoryCraftFeedback: (feedback: StoryCraftChapterFeedback) => void;
  replaceStoryCraftFeedback: (chapterId: string, feedback: StoryCraftChapterFeedback) => void;
  updateStoryCraftChecklist: (chapterId: string, checklistItemId: string, isCompleted: boolean) => void;
  deleteStoryCraftFeedback: (chapterId: string) => void;
  getStoryCraftFeedback: (chapterId: string) => StoryCraftChapterFeedback | undefined;
  getAllPromisesMade: (beforeChapterOrder: number) => Array<{
    id: string;
    type: string;
    description: string;
    context: string;
    chapterId: string;
    chapterTitle: string;
  }>;
  
  // Themes and Motifs actions
  updateThemesAndMotifs: (data: Partial<ThemesAndMotifs>) => void;
  addOrUpdateTheme: (theme: Omit<Theme, 'id'> & { id?: string }) => void;
  addOrUpdateMotif: (motif: Omit<Motif, 'id'> & { id?: string }) => void;
  addOrUpdateSymbol: (symbol: Omit<Symbol, 'id'> & { id?: string }) => void;
  getThemesAndMotifs: () => ThemesAndMotifs;
  
  // Plot Error Analysis actions
  setPlotErrorAnalysis: (analysis: PlotErrorAnalysis) => void;
  updatePlotErrorAnalysis: (updates: Partial<PlotErrorAnalysis>) => void;
  clearPlotErrorAnalysis: () => void;
  getPlotErrorAnalysis: () => PlotErrorAnalysis | null;
  
  // Chapter Variation actions
  setChapterVariation: (chapterId: string, variation: ChapterVariation) => void; // In-dialog pending draft
  applyVariation: (chapterId: string, variationId?: string) => void; // Apply by id from list, or apply pending
  discardVariation: (chapterId: string) => void;
  getChapterVariation: (chapterId: string) => ChapterVariation | undefined; // Pending draft
  getChapterVariations: (chapterId: string) => ChapterVariation[];
  addChapterVariation: (chapterId: string, variation: ChapterVariation) => void;
  restoreOriginal: (chapterId: string) => void;
  clearOriginal: (chapterId: string) => void;
  hasOriginal: (chapterId: string) => boolean;
  
  // Computed
  getActiveChapter: () => Chapter | undefined;
  getChapterById: (id: string) => Chapter | undefined;
  getSortedChapters: () => Chapter[];
  getActiveDocumentTab: () => DocumentTab | undefined;
  getDocumentTabById: (id: string) => DocumentTab | undefined;
  getSortedTimeline: () => TimelineEvent[];
  
  // Background task actions
  backgroundTasks: BackgroundTask[];
  addBackgroundTask: (task: Omit<BackgroundTask, 'id' | 'startedAt'>) => string;
  updateBackgroundTask: (id: string, updates: Partial<BackgroundTask>) => void;
  removeBackgroundTask: (id: string) => void;
  getBackgroundTask: (id: string) => BackgroundTask | undefined;
  
  // Toast notification actions
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const initialBook = createNewBook();

const LAST_CHAPTER_BY_BOOK_KEY = 'storybook-last-chapter-by-book';

function getLastChapterByBook(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_CHAPTER_BY_BOOK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function setLastChapterForBook(bookId: string, chapterId: string): void {
  const map = getLastChapterByBook();
  map[bookId] = chapterId;
  try {
    localStorage.setItem(LAST_CHAPTER_BY_BOOK_KEY, JSON.stringify(map));
  } catch {
    // ignore quota or other errors
  }
}

export const useBookStore = create<BookState>((set, get) => ({
  book: initialBook,
  activeChapterId: initialBook.chapters[0]?.id || null,
  pendingChapterVariation: {},
  ui: {
    showChaptersPanel: true,
    showAIPanel: true,
    leftPanelWidth: 280,
    rightPanelWidth: 400,
    zoom: 100,
    isSettingsOpen: false,
    isDirty: false,
    currentFilePath: null,
    activeDocumentTabId: null,
    syncStatus: {
      isSyncing: false,
      direction: null,
      progress: '',
      error: null,
      success: null,
      timestamp: null,
    },
    currentUserId: null,
    isDbConnected: false,
    contentEditorTheme: 'light',
    aiPanelTab: 'actions',
    pendingChatMessage: null,
    chatInputPreFill: null,
  },
  ai: {
    suggestions: [],
    summaries: new Map(),
    isAnalyzing: false,
    isExtracting: false,
    storyCraftRunningChapterId: null,
  },
  
  // Background tasks and toasts
  backgroundTasks: [],
  toasts: [],

  // Book actions
  setBook: (book) => {
    // Ensure all permanent document tabs exist (for backwards compatibility)
    const now = new Date().toISOString();
    const permanentTabs = [
      { id: 'characters-tab', title: 'Characters', icon: '👤', tabType: 'characters' as const },
      { id: 'locations-tab', title: 'Locations', icon: '📍', tabType: 'locations' as const },
      { id: 'timeline-tab', title: 'Timeline', icon: '📅', tabType: 'timeline' as const },
      { id: 'summaries-tab', title: 'Summaries', icon: '📝', tabType: 'summaries' as const },
      { id: 'storycraft-tab', title: 'Story Craft', icon: '🎭', tabType: 'storycraft' as const },
      { id: 'themes-tab', title: 'Themes & Motifs', icon: '🎨', tabType: 'themes' as const },
    ];
    
    const existingTabs = book.documentTabs || [];
    const missingTabs = permanentTabs.filter(pt => 
      !existingTabs.some(et => et.tabType === pt.tabType)
    );
    
    const updatedDocumentTabs = [
      ...existingTabs,
      ...missingTabs.map(pt => ({
        ...pt,
        content: DEFAULT_TIPTAP_CONTENT,
        isPermanent: true,
        createdAt: now,
        updatedAt: now,
      })),
    ];
    
    // Ensure extracted data has new fields
    const updatedExtracted = {
      ...book.extracted,
      storyCraftFeedback: book.extracted.storyCraftFeedback || [],
      themesAndMotifs: book.extracted.themesAndMotifs || {
        themes: [],
        motifs: [],
        symbols: [],
        lastUpdated: now,
      },
      plotErrorAnalysis: book.extracted.plotErrorAnalysis || undefined,
    };
    
    const lastChapterMap = getLastChapterByBook();
    const lastChapterId = book.id ? lastChapterMap[book.id] : undefined;
    const hasChapter = lastChapterId && book.chapters.some((c) => c.id === lastChapterId);
    const activeChapterId = hasChapter ? lastChapterId! : (book.chapters[0]?.id || null);

    set({
      book: {
        ...book,
        documentTabs: updatedDocumentTabs,
        extracted: updatedExtracted,
      },
      activeChapterId,
      ui: { ...get().ui, isDirty: false }
    });
  },

  updateBookMetadata: (updates) => {
    set((state) => ({
      book: { 
        ...state.book, 
        ...updates, 
        updatedAt: new Date().toISOString() 
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  newBook: () => {
    const book = createNewBook();
    set({ 
      book, 
      activeChapterId: book.chapters[0]?.id || null,
      ui: { ...get().ui, isDirty: false, currentFilePath: null }
    });
  },

  // Chapter actions
  setActiveChapter: (chapterId) => {
    const bookId = get().book.id;
    if (bookId) setLastChapterForBook(bookId, chapterId);
    set({ activeChapterId: chapterId });
  },

  addChapter: () => {
    set((state) => {
      const newOrder = state.book.chapters.length + 1;
      const newChapter = createNewChapter(newOrder);
      return {
        book: {
          ...state.book,
          chapters: [...state.book.chapters, newChapter],
          updatedAt: new Date().toISOString(),
        },
        activeChapterId: newChapter.id,
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  insertChapterAt: (position: number) => {
    set((state) => {
      // Create new chapter with temporary order
      const newChapter = createNewChapter(position + 1);
      
      // Get sorted chapters and insert at position
      const sortedChapters = [...state.book.chapters].sort((a, b) => a.order - b.order);
      sortedChapters.splice(position, 0, newChapter);
      
      // Renumber all chapters
      sortedChapters.forEach((chapter, index) => {
        chapter.order = index + 1;
        // Update title to reflect new order if it's a default "Chapter X" title
        if (chapter.id === newChapter.id) {
          chapter.title = `Chapter ${index + 1}`;
        }
      });
      
      return {
        book: {
          ...state.book,
          chapters: sortedChapters,
          updatedAt: new Date().toISOString(),
        },
        activeChapterId: newChapter.id,
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  importChapter: (chapter: Chapter) => {
    set((state) => {
      // Assign correct order number
      const newOrder = state.book.chapters.length + 1;
      const importedChapter = {
        ...chapter,
        order: newOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        book: {
          ...state.book,
          chapters: [...state.book.chapters, importedChapter],
          updatedAt: new Date().toISOString(),
        },
        activeChapterId: importedChapter.id,
        ui: { ...state.ui, isDirty: true, activeDocumentTabId: null }
      };
    });
  },

  importFromGoogleDocs: (chapters: Chapter[], googleDocsSource: { documentId: string; documentName: string }) => {
    set((state) => {
      const now = new Date().toISOString();
      return {
        book: {
          ...state.book,
          chapters,
          metadata: {
            ...state.book.metadata,
            googleDocsSource: {
              documentId: googleDocsSource.documentId,
              documentName: googleDocsSource.documentName,
              lastImported: now,
            },
          },
          updatedAt: now,
        },
        activeChapterId: chapters.length > 0 ? chapters[0].id : null,
        ui: { ...state.ui, isDirty: true, activeDocumentTabId: null }
      };
    });
  },

  setGoogleDocsExport: (exportInfo: { documentId: string; documentName: string; webViewLink: string; folderId?: string; folderPath?: string }) => {
    set((state) => {
      const now = new Date().toISOString();
      return {
        book: {
          ...state.book,
          metadata: {
            ...state.book.metadata,
            googleDocsExport: {
              documentId: exportInfo.documentId,
              documentName: exportInfo.documentName,
              webViewLink: exportInfo.webViewLink,
              folderId: exportInfo.folderId,
              folderPath: exportInfo.folderPath,
              lastExported: now,
            },
          },
          updatedAt: now,
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  deleteChapter: (chapterId) => {
    set((state) => {
      const chapters = state.book.chapters.filter((c) => c.id !== chapterId);
      
      // Reorder remaining chapters
      chapters.forEach((chapter, index) => {
        chapter.order = index + 1;
      });
      
      // Update active chapter if needed
      let newActiveId = state.activeChapterId;
      if (state.activeChapterId === chapterId) {
        newActiveId = chapters[0]?.id || null;
      }

      return {
        book: {
          ...state.book,
          chapters,
          updatedAt: new Date().toISOString(),
        },
        activeChapterId: newActiveId,
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  updateChapter: (chapterId, updates) => {
    set((state) => ({
      book: {
        ...state.book,
        chapters: state.book.chapters.map((chapter) =>
          chapter.id === chapterId
            ? { ...chapter, ...updates, updatedAt: new Date().toISOString() }
            : chapter
        ),
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  updateChapterContent: (chapterId, content) => {
    set((state) => {
      // Calculate word count from content
      const wordCount = countWords(content);
      
      return {
        book: {
          ...state.book,
          chapters: state.book.chapters.map((chapter) =>
            chapter.id === chapterId
              ? { 
                  ...chapter, 
                  content, 
                  wordCount,
                  updatedAt: new Date().toISOString() 
                }
              : chapter
          ),
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  reorderChapters: (sourceIndex, destinationIndex) => {
    set((state) => {
      const chapters = [...state.book.chapters];
      const [removed] = chapters.splice(sourceIndex, 1);
      chapters.splice(destinationIndex, 0, removed);
      
      // Update order values
      chapters.forEach((chapter, index) => {
        chapter.order = index + 1;
      });

      return {
        book: {
          ...state.book,
          chapters,
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  renumberChapters: () => {
    set((state) => {
      // Sort chapters by their current order
      const sortedChapters = [...state.book.chapters].sort((a, b) => a.order - b.order);
      
      // Update each chapter's title and order, and update heading in content if it exists
      const updatedChapters = sortedChapters.map((chapter, index) => {
        const newOrder = index + 1;
        const newTitle = `Chapter ${newOrder}`;
        
        // Update the chapter content - find and replace chapter headings
        let updatedContent = chapter.content;
        if (chapter.content && chapter.content.content) {
          let foundHeading = false;
          const newContent = chapter.content.content.map((node) => {
            // Only update the first matching heading
            if (foundHeading) return node;
            
            // Check if this is a heading node (h1, h2, etc.)
            if (node.type === 'heading' && node.content) {
              const headingText = node.content.map((c: any) => c.text || '').join('');
              const trimmedText = headingText.trim().toLowerCase();
              
              // Match any heading that:
              // - Starts with "chapter" followed by a number (e.g., "Chapter 4", "Chapter 12")
              // - Or exactly matches the current chapter title
              const isChapterHeading = /^chapter\s+\d+/i.test(trimmedText) || 
                                       /^chapter\d+/i.test(trimmedText) ||
                                       trimmedText === chapter.title.toLowerCase();
              
              if (isChapterHeading) {
                foundHeading = true;
                // Replace the heading text with the new chapter title
                return {
                  ...node,
                  content: [{ type: 'text', text: newTitle }]
                };
              }
            }
            return node;
          });
          updatedContent = { ...chapter.content, content: newContent };
        }
        
        return {
          ...chapter,
          title: newTitle,
          order: newOrder,
          content: updatedContent,
          updatedAt: new Date().toISOString(),
        };
      });

      return {
        book: {
          ...state.book,
          chapters: updatedChapters,
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  // Comment actions
  addComment: (chapterId: string, comment: ChapterComment) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          return {
            ...chapter,
            comments: [...(chapter.comments || []), comment],
            updatedAt: new Date().toISOString(),
          };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  updateComment: (chapterId: string, commentId: string, updates: Partial<ChapterComment>) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          const comments = (chapter.comments || []).map((comment) =>
            comment.id === commentId ? { ...comment, ...updates } : comment
          );
          return { ...chapter, comments, updatedAt: new Date().toISOString() };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  deleteComment: (chapterId: string, commentId: string) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          const comments = (chapter.comments || []).filter((c) => c.id !== commentId);
          return { ...chapter, comments, updatedAt: new Date().toISOString() };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  resolveComment: (chapterId: string, commentId: string) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          const comments = (chapter.comments || []).map((comment) =>
            comment.id === commentId ? { ...comment, resolved: true } : comment
          );
          return { ...chapter, comments, updatedAt: new Date().toISOString() };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  clearChapterComments: (chapterId: string) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          return { ...chapter, comments: [], updatedAt: new Date().toISOString() };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  // Note actions
  addNote: (chapterId: string, note: ChapterNote) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          return {
            ...chapter,
            notes: [...(chapter.notes || []), note],
            updatedAt: new Date().toISOString(),
          };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  updateNote: (chapterId: string, noteId: string, updates: Partial<ChapterNote>) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          const notes = (chapter.notes || []).map((note) =>
            note.id === noteId ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
          );
          return { ...chapter, notes, updatedAt: new Date().toISOString() };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  deleteNote: (chapterId: string, noteId: string) => {
    set((state) => {
      const chapters = state.book.chapters.map((chapter) => {
        if (chapter.id === chapterId) {
          const notes = (chapter.notes || []).filter((n) => n.id !== noteId);
          return { ...chapter, notes, updatedAt: new Date().toISOString() };
        }
        return chapter;
      });
      return {
        book: { ...state.book, chapters, updatedAt: new Date().toISOString() },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  // UI actions
  toggleChaptersPanel: () => {
    set((state) => ({
      ui: { ...state.ui, showChaptersPanel: !state.ui.showChaptersPanel }
    }));
  },

  toggleAIPanel: () => {
    set((state) => ({
      ui: { ...state.ui, showAIPanel: !state.ui.showAIPanel }
    }));
  },

  setPanelSettings: (settings) => {
    set((state) => ({
      ui: { ...state.ui, ...settings }
    }));
  },

  setLeftPanelWidth: (width) => {
    set((state) => ({
      ui: { ...state.ui, leftPanelWidth: Math.min(500, Math.max(180, width)) }
    }));
  },

  setRightPanelWidth: (width) => {
    set((state) => ({
      ui: { ...state.ui, rightPanelWidth: Math.min(600, Math.max(280, width)) }
    }));
  },

  setZoom: (zoom) => {
    set((state) => ({
      ui: { ...state.ui, zoom: Math.min(200, Math.max(50, zoom)) }
    }));
  },

  zoomIn: () => {
    set((state) => ({
      ui: { ...state.ui, zoom: Math.min(200, state.ui.zoom + 10) }
    }));
  },

  zoomOut: () => {
    set((state) => ({
      ui: { ...state.ui, zoom: Math.max(50, state.ui.zoom - 10) }
    }));
  },

  resetZoom: () => {
    set((state) => ({
      ui: { ...state.ui, zoom: 100 }
    }));
  },

  setSettingsOpen: (open) => {
    set((state) => ({
      ui: { ...state.ui, isSettingsOpen: open }
    }));
  },

  setDirty: (dirty) => {
    set((state) => ({
      ui: { ...state.ui, isDirty: dirty }
    }));
  },

  setCurrentFilePath: (path) => {
    set((state) => ({
      ui: { ...state.ui, currentFilePath: path }
    }));
  },

  setCurrentUserId: (userId) => {
    set((state) => ({
      ui: { ...state.ui, currentUserId: userId }
    }));
  },

  setDbConnected: (connected) => {
    set((state) => ({
      ui: { ...state.ui, isDbConnected: connected }
    }));
  },

  setContentEditorTheme: (theme) => {
    set((state) => ({
      ui: { ...state.ui, contentEditorTheme: theme }
    }));
    if (typeof window !== 'undefined' && window.electronAPI?.storeSet) {
      window.electronAPI.storeSet('content-editor-theme', theme);
    }
  },

  setAIPanelTab: (tab) => {
    set((state) => ({
      ui: { ...state.ui, aiPanelTab: tab }
    }));
  },

  setPendingChatMessage: (msg) => {
    set((state) => ({
      ui: { ...state.ui, pendingChatMessage: msg }
    }));
  },

  setChatInputPreFill: (msg) => {
    set((state) => ({
      ui: { ...state.ui, chatInputPreFill: msg }
    }));
  },

  // Sync actions
  setSyncStatus: (status) => {
    set((state) => ({
      ui: { 
        ...state.ui, 
        syncStatus: { 
          ...state.ui.syncStatus, 
          ...status,
          timestamp: Date.now()
        } 
      }
    }));
  },

  clearSyncStatus: () => {
    set((state) => ({
      ui: { 
        ...state.ui, 
        syncStatus: {
          isSyncing: false,
          direction: null,
          progress: '',
          error: null,
          success: null,
          timestamp: null,
        }
      }
    }));
  },

  // AI actions
  setSuggestions: (suggestions) => {
    set((state) => ({
      ai: { ...state.ai, suggestions }
    }));
  },

  clearSuggestions: () => {
    set((state) => ({
      ai: { ...state.ai, suggestions: [] }
    }));
  },

  addSummary: (summary) => {
    set((state) => {
      const summaries = new Map(state.ai.summaries);
      summaries.set(summary.chapterId, summary);
      // Keep book.extracted.summaries in sync so Story Craft and file save have current data
      const extractedSummaries = state.book.extracted.summaries || [];
      const otherSummaries = extractedSummaries.filter(s => s.chapterId !== summary.chapterId);
      const newExtractedSummaries = [...otherSummaries, summary];
      return {
        ai: { ...state.ai, summaries },
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            summaries: newExtractedSummaries,
          },
        },
        ui: { ...state.ui, isDirty: true },
      };
    });
  },

  setAISummaries: (summaries) => {
    set((state) => ({
      ai: { ...state.ai, summaries }
    }));
  },

  setAnalyzing: (analyzing) => {
    set((state) => ({
      ai: { ...state.ai, isAnalyzing: analyzing }
    }));
  },

  setExtracting: (extracting) => {
    set((state) => ({
      ai: { ...state.ai, isExtracting: extracting }
    }));
  },

  setStoryCraftRunningChapterId: (chapterId) => {
    set((state) => ({
      ai: { ...state.ai, storyCraftRunningChapterId: chapterId }
    }));
  },

  // Document Tab actions
  setActiveDocumentTab: (tabId) => {
    set((state) => ({
      activeChapterId: tabId ? null : state.activeChapterId, // Clear chapter selection when viewing a tab
      ui: { ...state.ui, activeDocumentTabId: tabId }
    }));
  },

  addDocumentTab: (title) => {
    set((state) => {
      const newTab = createNewDocumentTab(title);
      return {
        book: {
          ...state.book,
          documentTabs: [...state.book.documentTabs, newTab],
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true, activeDocumentTabId: newTab.id }
      };
    });
  },

  deleteDocumentTab: (tabId) => {
    set((state) => {
      // Don't delete permanent tabs
      const tab = state.book.documentTabs.find(t => t.id === tabId);
      if (tab?.isPermanent) return state;

      const documentTabs = state.book.documentTabs.filter(t => t.id !== tabId);
      
      // Update active tab if needed
      let newActiveTabId = state.ui.activeDocumentTabId;
      if (state.ui.activeDocumentTabId === tabId) {
        newActiveTabId = null;
      }

      return {
        book: {
          ...state.book,
          documentTabs,
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true, activeDocumentTabId: newActiveTabId }
      };
    });
  },

  updateDocumentTab: (tabId, updates) => {
    set((state) => ({
      book: {
        ...state.book,
        documentTabs: state.book.documentTabs.map((tab) =>
          tab.id === tabId
            ? { ...tab, ...updates, updatedAt: new Date().toISOString() }
            : tab
        ),
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  updateDocumentTabContent: (tabId, content) => {
    set((state) => ({
      book: {
        ...state.book,
        documentTabs: state.book.documentTabs.map((tab) =>
          tab.id === tabId
            ? { ...tab, content, updatedAt: new Date().toISOString() }
            : tab
        ),
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  // Extraction actions with merging
  addOrUpdateCharacter: (character, chapterId, chapterTitle) => {
    set((state) => {
      const nameLower = character.name.toLowerCase();
      const aliasesLower = character.aliases.map(a => a.toLowerCase());
      
      // Find existing character by name OR by any alias match
      const existingCharacter = state.book.extracted.characters.find(c => {
        const cNameLower = c.name.toLowerCase();
        const cAliasesLower = c.aliases.map(a => a.toLowerCase());
        
        // Check if names match
        if (cNameLower === nameLower) return true;
        
        // Check if new name matches any existing alias
        if (cAliasesLower.includes(nameLower)) return true;
        
        // Check if existing name matches any new alias
        if (aliasesLower.includes(cNameLower)) return true;
        
        // Check if any aliases overlap
        if (aliasesLower.some(a => cAliasesLower.includes(a))) return true;
        
        return false;
      });

      let characters: Character[];
      
      if (existingCharacter) {
        // Update existing character - add chapter mention and merge data
        characters = state.book.extracted.characters.map(c => {
          if (c.id === existingCharacter.id) {
            // Determine the best name (prefer longer/more complete name)
            let bestName = c.name;
            const newNameWords = character.name.split(' ').length;
            const existingNameWords = c.name.split(' ').length;
            
            // If new name has more words (likely full name), use it
            if (newNameWords > existingNameWords) {
              bestName = character.name;
            }
            // If same word count, prefer the one that looks more like a full name
            else if (newNameWords === existingNameWords && character.name.length > c.name.length) {
              bestName = character.name;
            }
            
            // Collect all aliases (including old name if it changed)
            const allAliases = new Set([...c.aliases, ...character.aliases]);
            if (bestName !== c.name) {
              allAliases.add(c.name); // Old name becomes alias
            }
            if (bestName !== character.name) {
              allAliases.add(character.name); // New name becomes alias if not used
            }
            // Remove the best name from aliases
            allAliases.delete(bestName);
            allAliases.delete(bestName.toLowerCase());
            
            // Merge descriptions - append new info if different
            let mergedDescription = c.description || '';
            if (character.description && character.description !== c.description) {
              if (mergedDescription) {
                // Only append if truly new information
                if (!mergedDescription.toLowerCase().includes(character.description.toLowerCase().slice(0, 50))) {
                  mergedDescription = `${mergedDescription} ${character.description}`;
                }
              } else {
                mergedDescription = character.description;
              }
            }
            
            const existingMention = c.mentions.find(m => m.chapterId === chapterId);
            if (existingMention) {
              // Increment count
              return {
                ...c,
                name: bestName,
                mentions: c.mentions.map(m => 
                  m.chapterId === chapterId 
                    ? { ...m, count: m.count + 1 }
                    : m
                ),
                description: mergedDescription,
                aliases: [...allAliases],
              };
            } else {
              // Add new chapter mention
              return {
                ...c,
                name: bestName,
                mentions: [...c.mentions, { chapterId, count: 1 }],
                description: mergedDescription,
                aliases: [...allAliases],
              };
            }
          }
          return c;
        });
      } else {
        // Add new character
        const newCharacter: Character = {
          id: generateId(),
          name: character.name,
          aliases: character.aliases,
          description: character.description,
          firstAppearance: chapterId,
          mentions: [{ chapterId, count: 1 }],
        };
        characters = [...state.book.extracted.characters, newCharacter];
      }

      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            characters,
            lastExtracted: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  addOrUpdateLocation: (location, chapterId, chapterTitle) => {
    set((state) => {
      const existingLocation = state.book.extracted.locations.find(
        l => l.name.toLowerCase() === location.name.toLowerCase()
      );

      let locations: Location[];
      
      if (existingLocation) {
        // Update existing location - add chapter mention
        locations = state.book.extracted.locations.map(l => {
          if (l.id === existingLocation.id) {
            const existingMention = l.mentions.find(m => m.chapterId === chapterId);
            if (existingMention) {
              return {
                ...l,
                mentions: l.mentions.map(m => 
                  m.chapterId === chapterId 
                    ? { ...m, count: m.count + 1 }
                    : m
                ),
                description: location.description || l.description,
                type: location.type || l.type,
              };
            } else {
              return {
                ...l,
                mentions: [...l.mentions, { chapterId, count: 1 }],
                description: location.description || l.description,
                type: location.type || l.type,
              };
            }
          }
          return l;
        });
      } else {
        // Add new location
        const newLocation: Location = {
          id: generateId(),
          name: location.name,
          description: location.description,
          type: location.type,
          mentions: [{ chapterId, count: 1 }],
        };
        locations = [...state.book.extracted.locations, newLocation];
      }

      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            locations,
            lastExtracted: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  addTimelineEvent: (event) => {
    set((state) => {
      const newEvent: TimelineEvent = {
        id: generateId(),
        ...event,
      };
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            timeline: [...state.book.extracted.timeline, newEvent],
            lastExtracted: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  reorganizeTimeline: () => {
    set((state) => {
      // Sort timeline by sortDate (chronological order)
      const sortedTimeline = [...state.book.extracted.timeline].sort((a, b) => {
        // Events with sortDate come first, sorted by date
        if (a.sortDate && b.sortDate) {
          return new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime();
        }
        // Events with sortDate before events without
        if (a.sortDate && !b.sortDate) return -1;
        if (!a.sortDate && b.sortDate) return 1;
        // Otherwise maintain original order
        return a.order - b.order;
      });

      // Update chronological order
      const timelineWithOrder = sortedTimeline.map((event, index) => ({
        ...event,
        chronologicalOrder: index + 1,
      }));

      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            timeline: timelineWithOrder,
          },
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  clearExtractedData: (type) => {
    set((state) => {
      const extracted = { ...state.book.extracted };
      
      if (!type || type === 'characters') extracted.characters = [];
      if (!type || type === 'locations') extracted.locations = [];
      if (!type || type === 'timeline') extracted.timeline = [];

      return {
        book: {
          ...state.book,
          extracted,
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  // Edit extracted data
  updateCharacter: (id, updates) => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          characters: state.book.extracted.characters.map(c =>
            c.id === id ? { ...c, ...updates } : c
          ),
        },
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  deleteCharacter: (id) => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          characters: state.book.extracted.characters.filter(c => c.id !== id),
        },
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  updateLocation: (id, updates) => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          locations: state.book.extracted.locations.map(l =>
            l.id === id ? { ...l, ...updates } : l
          ),
        },
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  deleteLocation: (id) => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          locations: state.book.extracted.locations.filter(l => l.id !== id),
        },
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  updateTimelineEvent: (id, updates) => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          timeline: state.book.extracted.timeline.map(e =>
            e.id === id ? { ...e, ...updates } : e
          ),
        },
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  deleteTimelineEvent: (id) => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          timeline: state.book.extracted.timeline.filter(e => e.id !== id),
        },
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  updateSummary: (chapterId, updates) => {
    set((state) => {
      const newSummaries = new Map(state.ai.summaries);
      const existing = newSummaries.get(chapterId);
      if (existing) {
        newSummaries.set(chapterId, {
          ...existing,
          ...updates,
          generatedAt: new Date().toISOString(),
        });
      }
      return {
        ai: { ...state.ai, summaries: newSummaries },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  deleteSummary: (chapterId) => {
    set((state) => {
      const newSummaries = new Map(state.ai.summaries);
      newSummaries.delete(chapterId);
      const extractedSummaries = state.book.extracted.summaries || [];
      const newExtractedSummaries = extractedSummaries.filter(s => s.chapterId !== chapterId);
      return {
        ai: { ...state.ai, summaries: newSummaries },
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            summaries: newExtractedSummaries,
          },
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  // Story Craft Feedback actions
  addOrUpdateStoryCraftFeedback: (feedback) => {
    set((state) => {
      // Ensure storyCraftFeedback array exists
      const currentFeedback = state.book.extracted.storyCraftFeedback || [];
      const existingIndex = currentFeedback.findIndex(f => f.chapterId === feedback.chapterId);
      
      let newFeedback;
      if (existingIndex >= 0) {
        // Update existing - merge checklists, keeping completed items
        const existing = currentFeedback[existingIndex];
        const mergedChecklist = [...existing.checklist];
        
        // Add new checklist items that don't already exist
        for (const newItem of feedback.checklist) {
          const existingItem = mergedChecklist.find(i => i.suggestion === newItem.suggestion);
          if (!existingItem) {
            mergedChecklist.push(newItem);
          }
        }
        
        // Preserve existing summary if new one is empty
        const summary = feedback.summary || existing.summary || '';
        
        // Preserve existing promises if new ones are empty
        const promisesMade = feedback.promisesMade?.length ? feedback.promisesMade : existing.promisesMade;
        const promisesKept = feedback.promisesKept?.length ? feedback.promisesKept : existing.promisesKept;
        
        newFeedback = [
          ...currentFeedback.slice(0, existingIndex),
          { ...feedback, checklist: mergedChecklist, summary, promisesMade, promisesKept, lastUpdated: new Date().toISOString() },
          ...currentFeedback.slice(existingIndex + 1)
        ];
      } else {
        newFeedback = [...currentFeedback, feedback];
      }
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            storyCraftFeedback: newFeedback
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  replaceStoryCraftFeedback: (chapterId, feedback) => {
    set((state) => {
      const currentFeedback = state.book.extracted.storyCraftFeedback || [];
      const idx = currentFeedback.findIndex(f => f.chapterId === chapterId);
      const newFeedback = idx >= 0
        ? [...currentFeedback.slice(0, idx), { ...feedback, chapterId, lastUpdated: new Date().toISOString() }, ...currentFeedback.slice(idx + 1)]
        : [...currentFeedback, { ...feedback, chapterId, lastUpdated: new Date().toISOString() }];
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            storyCraftFeedback: newFeedback
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  updateStoryCraftChecklist: (chapterId, checklistItemId, isCompleted) => {
    set((state) => {
      const currentFeedback = state.book.extracted.storyCraftFeedback || [];
      const feedbackIndex = currentFeedback.findIndex(f => f.chapterId === chapterId);
      
      if (feedbackIndex < 0) return state;
      
      const feedback = currentFeedback[feedbackIndex];
      const updatedChecklist = feedback.checklist.map(item => 
        item.id === checklistItemId
          ? { ...item, isCompleted, completedAt: isCompleted ? new Date().toISOString() : undefined }
          : item
      );
      
      const newFeedback = [
        ...currentFeedback.slice(0, feedbackIndex),
        { ...feedback, checklist: updatedChecklist, lastUpdated: new Date().toISOString() },
        ...currentFeedback.slice(feedbackIndex + 1)
      ];
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            storyCraftFeedback: newFeedback
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  deleteStoryCraftFeedback: async (chapterId) => {
    // Delete from database immediately
    try {
      await window.electronAPI.dbDeleteStoryCraftFeedback(chapterId);
    } catch (error) {
      console.error('Failed to delete story craft feedback from database:', error);
      // Continue anyway - will sync on next save
    }
    
    // Remove from store
    set((state) => {
      const currentFeedback = state.book.extracted.storyCraftFeedback || [];
      const filteredFeedback = currentFeedback.filter(f => f.chapterId !== chapterId);
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            storyCraftFeedback: filteredFeedback
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  getStoryCraftFeedback: (chapterId) => {
    const state = get();
    return (state.book.extracted.storyCraftFeedback || []).find(f => f.chapterId === chapterId);
  },
  
  getAllPromisesMade: (beforeChapterOrder) => {
    const state = get();
    const chapters = state.book.chapters;
    const storyCraftFeedback = state.book.extracted.storyCraftFeedback || [];
    
    // Get all chapters with order less than the specified order
    const previousChapters = chapters.filter(c => c.order < beforeChapterOrder);
    
    // Collect all promises from those chapters
    const allPromises: Array<{
      id: string;
      type: string;
      description: string;
      context: string;
      chapterId: string;
      chapterTitle: string;
    }> = [];
    
    for (const chapter of previousChapters) {
      const feedback = storyCraftFeedback.find(f => f.chapterId === chapter.id);
      if (feedback?.promisesMade) {
        for (const promise of feedback.promisesMade) {
          allPromises.push({
            id: promise.id,
            type: promise.type,
            description: promise.description,
            context: promise.context,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
          });
        }
      }
    }
    
    return allPromises;
  },

  // Themes and Motifs actions
  updateThemesAndMotifs: (data) => {
    set((state) => {
      // Ensure themesAndMotifs exists
      const current = state.book.extracted.themesAndMotifs || {
        themes: [],
        motifs: [],
        symbols: [],
        lastUpdated: new Date().toISOString()
      };
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            themesAndMotifs: {
              ...current,
              ...data,
              lastUpdated: new Date().toISOString()
            }
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  addOrUpdateTheme: (theme) => {
    set((state) => {
      const current = state.book.extracted.themesAndMotifs || {
        themes: [],
        motifs: [],
        symbols: [],
        lastUpdated: new Date().toISOString()
      };
      
      // Check if theme exists by name (case-insensitive)
      const existingIndex = current.themes.findIndex(
        t => t.name.toLowerCase() === theme.name.toLowerCase()
      );
      
      let newThemes;
      if (existingIndex >= 0) {
        // Merge with existing theme
        const existing = current.themes[existingIndex];
        const mergedAppearances = [...existing.chapterAppearances];
        
        // Add new appearances
        for (const app of theme.chapterAppearances || []) {
          if (!mergedAppearances.find(a => a.chapterId === app.chapterId)) {
            mergedAppearances.push(app);
          }
        }
        
        newThemes = [
          ...current.themes.slice(0, existingIndex),
          {
            ...existing,
            description: theme.description || existing.description,
            evolutionNotes: theme.evolutionNotes || existing.evolutionNotes,
            chapterAppearances: mergedAppearances
          },
          ...current.themes.slice(existingIndex + 1)
        ];
      } else {
        newThemes = [...current.themes, { ...theme, id: theme.id || generateId() }];
      }
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            themesAndMotifs: {
              ...current,
              themes: newThemes,
              lastUpdated: new Date().toISOString()
            }
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  addOrUpdateMotif: (motif) => {
    set((state) => {
      const current = state.book.extracted.themesAndMotifs || {
        themes: [],
        motifs: [],
        symbols: [],
        lastUpdated: new Date().toISOString()
      };
      
      const existingIndex = current.motifs.findIndex(
        m => m.name.toLowerCase() === motif.name.toLowerCase()
      );
      
      let newMotifs;
      if (existingIndex >= 0) {
        const existing = current.motifs[existingIndex];
        const mergedAppearances = [...existing.chapterAppearances];
        
        for (const app of motif.chapterAppearances || []) {
          if (!mergedAppearances.find(a => a.chapterId === app.chapterId)) {
            mergedAppearances.push(app);
          }
        }
        
        newMotifs = [
          ...current.motifs.slice(0, existingIndex),
          {
            ...existing,
            description: motif.description || existing.description,
            chapterAppearances: mergedAppearances
          },
          ...current.motifs.slice(existingIndex + 1)
        ];
      } else {
        newMotifs = [...current.motifs, { ...motif, id: motif.id || generateId() }];
      }
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            themesAndMotifs: {
              ...current,
              motifs: newMotifs,
              lastUpdated: new Date().toISOString()
            }
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  addOrUpdateSymbol: (symbol) => {
    set((state) => {
      const current = state.book.extracted.themesAndMotifs || {
        themes: [],
        motifs: [],
        symbols: [],
        lastUpdated: new Date().toISOString()
      };
      
      const existingIndex = current.symbols.findIndex(
        s => s.name.toLowerCase() === symbol.name.toLowerCase()
      );
      
      let newSymbols;
      if (existingIndex >= 0) {
        const existing = current.symbols[existingIndex];
        const mergedAppearances = [...existing.chapterAppearances];
        
        for (const app of symbol.chapterAppearances || []) {
          if (!mergedAppearances.find(a => a.chapterId === app.chapterId)) {
            mergedAppearances.push(app);
          }
        }
        
        newSymbols = [
          ...current.symbols.slice(0, existingIndex),
          {
            ...existing,
            meaning: symbol.meaning || existing.meaning,
            chapterAppearances: mergedAppearances
          },
          ...current.symbols.slice(existingIndex + 1)
        ];
      } else {
        newSymbols = [...current.symbols, { ...symbol, id: symbol.id || generateId() }];
      }
      
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            themesAndMotifs: {
              ...current,
              symbols: newSymbols,
              lastUpdated: new Date().toISOString()
            }
          }
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  getThemesAndMotifs: () => {
    const state = get();
    return state.book.extracted.themesAndMotifs || {
      themes: [],
      motifs: [],
      symbols: [],
      lastUpdated: new Date().toISOString()
    };
  },

  // Plot Error Analysis actions
  setPlotErrorAnalysis: (analysis) => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          plotErrorAnalysis: analysis,
        },
      },
    }));
  },

  updatePlotErrorAnalysis: (updates) => {
    set((state) => {
      const current = state.book.extracted.plotErrorAnalysis;
      if (!current) {
        return state;
      }
      return {
        book: {
          ...state.book,
          extracted: {
            ...state.book.extracted,
            plotErrorAnalysis: {
              ...current,
              ...updates,
              lastUpdated: new Date().toISOString(),
            },
          },
        },
      };
    });
  },

  clearPlotErrorAnalysis: () => {
    set((state) => ({
      book: {
        ...state.book,
        extracted: {
          ...state.book.extracted,
          plotErrorAnalysis: null,
        },
      },
    }));
  },

  getPlotErrorAnalysis: () => {
    const state = get();
    return state.book.extracted.plotErrorAnalysis || null;
  },

  // Chapter Variation actions
  setChapterVariation: (chapterId, variation) => {
    set((state) => ({
      pendingChapterVariation: { ...state.pendingChapterVariation, [chapterId]: variation },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  applyVariation: (chapterId, variationId) => {
    set((state) => {
      const chapter = state.book.chapters.find(c => c.id === chapterId);
      if (!chapter) return state;
      const variations = chapter.variations ?? [];
      let variation: ChapterVariation | undefined;
      if (variationId) {
        variation = variations.find(v => v.id === variationId);
      } else {
        variation = state.pendingChapterVariation[chapterId];
      }
      if (!variation) return state;
      const { pendingChapterVariation } = state;
      const nextPending = { ...pendingChapterVariation };
      delete nextPending[chapterId];
      const addToVariations = !variationId && !variations.some(v => v.id === variation!.id);
      return {
        book: {
          ...state.book,
          chapters: state.book.chapters.map((c) => {
            if (c.id !== chapterId) return c;
            const nextVariations = addToVariations ? [...(c.variations ?? []), variation!] : (c.variations ?? []);
            return {
              ...c,
              content: variation!.content,
              wordCount: variation!.wordCount,
              variations: nextVariations,
              updatedAt: new Date().toISOString(),
            };
          }),
          updatedAt: new Date().toISOString(),
        },
        pendingChapterVariation: nextPending,
        ui: { ...state.ui, isDirty: true }
      };
    });
  },

  addChapterVariation: (chapterId, variation) => {
    set((state) => ({
      book: {
        ...state.book,
        chapters: state.book.chapters.map((c) =>
          c.id === chapterId
            ? {
                ...c,
                variations: [...(c.variations ?? []), variation],
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },

  getChapterVariations: (chapterId) => {
    const chapter = get().book.chapters.find(c => c.id === chapterId);
    return chapter?.variations ?? [];
  },

  restoreOriginal: (chapterId) => {
    set((state) => {
      const chapter = state.book.chapters.find(c => c.id === chapterId);
      if (!chapter?.originalContent) return state;
      return {
        book: {
          ...state.book,
          chapters: state.book.chapters.map((c) =>
            c.id === chapterId
              ? {
                  ...c,
                  content: c.originalContent!,
                  wordCount: c.originalWordCount ?? c.wordCount,
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
          updatedAt: new Date().toISOString(),
        },
        ui: { ...state.ui, isDirty: true }
      };
    });
  },
  
  clearOriginal: (chapterId) => {
    set((state) => ({
      book: {
        ...state.book,
        chapters: state.book.chapters.map((chapter) =>
          chapter.id === chapterId
            ? {
                ...chapter,
                originalContent: undefined,
                originalWordCount: undefined,
                variationAppliedAt: undefined,
                updatedAt: new Date().toISOString(),
              }
            : chapter
        ),
        updatedAt: new Date().toISOString(),
      },
      ui: { ...state.ui, isDirty: true }
    }));
  },
  
  hasOriginal: (chapterId) => {
    const state = get();
    const chapter = state.book.chapters.find(c => c.id === chapterId);
    return chapter?.originalContent !== undefined;
  },

  discardVariation: (chapterId) => {
    set((state) => {
      const nextPending = { ...state.pendingChapterVariation };
      delete nextPending[chapterId];
      return { pendingChapterVariation: nextPending };
    });
  },

  getChapterVariation: (chapterId) => {
    return get().pendingChapterVariation[chapterId];
  },

  // Computed
  getActiveChapter: () => {
    const state = get();
    return state.book.chapters.find((c) => c.id === state.activeChapterId);
  },

  getChapterById: (id) => {
    return get().book.chapters.find((c) => c.id === id);
  },

  getSortedChapters: () => {
    return [...get().book.chapters].sort((a, b) => a.order - b.order);
  },

  getActiveDocumentTab: () => {
    const state = get();
    if (!state.ui.activeDocumentTabId) return undefined;
    return state.book.documentTabs.find(t => t.id === state.ui.activeDocumentTabId);
  },

  getDocumentTabById: (id) => {
    return get().book.documentTabs.find(t => t.id === id);
  },

  getSortedTimeline: () => {
    return [...get().book.extracted.timeline].sort((a, b) => {
      // Use chronological order if available
      if (a.chronologicalOrder !== undefined && b.chronologicalOrder !== undefined) {
        return a.chronologicalOrder - b.chronologicalOrder;
      }
      // Fall back to sortDate
      if (a.sortDate && b.sortDate) {
        return new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime();
      }
      if (a.sortDate && !b.sortDate) return -1;
      if (!a.sortDate && b.sortDate) return 1;
      return a.order - b.order;
    });
  },
  
  // Background task actions
  addBackgroundTask: (task) => {
    const id = generateId();
    const newTask: BackgroundTask = {
      ...task,
      id,
      startedAt: new Date().toISOString(),
    };
    set((state) => ({
      backgroundTasks: [...state.backgroundTasks, newTask],
    }));
    return id;
  },
  
  updateBackgroundTask: (id, updates) => {
    set((state) => ({
      backgroundTasks: state.backgroundTasks.map(task =>
        task.id === id ? { ...task, ...updates } : task
      ),
    }));
  },
  
  removeBackgroundTask: (id) => {
    set((state) => ({
      backgroundTasks: state.backgroundTasks.filter(task => task.id !== id),
    }));
  },
  
  getBackgroundTask: (id) => {
    return get().backgroundTasks.find(task => task.id === id);
  },
  
  // Toast notification actions
  addToast: (toast) => {
    const id = generateId();
    const newToast: Toast = { ...toast, id };
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));
    return id;
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(toast => toast.id !== id),
    }));
  },
}));

// Helper function to count words in TipTap content
function countWords(content: TipTapContent): number {
  let text = '';
  
  function extractText(node: any): void {
    if (node.text) {
      text += node.text + ' ';
    }
    if (node.content) {
      node.content.forEach(extractText);
    }
  }
  
  extractText(content);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

