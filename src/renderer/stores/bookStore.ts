import { create } from 'zustand';
import { 
  Book, 
  Chapter, 
  DocumentTab,
  Character,
  Location,
  TimelineEvent,
  AISuggestion, 
  ChapterSummary, 
  StoryCraftChapterFeedback,
  ThemesAndMotifs,
  Theme,
  Motif,
  Symbol,
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

interface UIState {
  showChaptersPanel: boolean;
  showAIPanel: boolean;
  zoom: number;
  isSettingsOpen: boolean;
  isDirty: boolean;
  currentFilePath: string | null;
  activeDocumentTabId: string | null; // null means viewing a chapter
  syncStatus: SyncStatus;
}

interface AIState {
  suggestions: AISuggestion[];
  summaries: Map<string, ChapterSummary>;
  isAnalyzing: boolean;
  isExtracting: boolean;
}

interface BookState {
  book: Book;
  activeChapterId: string | null;
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
  updateChapter: (chapterId: string, updates: Partial<Chapter>) => void;
  updateChapterContent: (chapterId: string, content: TipTapContent) => void;
  reorderChapters: (sourceIndex: number, destinationIndex: number) => void;
  renumberChapters: () => void;
  
  // UI actions
  toggleChaptersPanel: () => void;
  toggleAIPanel: () => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setSettingsOpen: (open: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setCurrentFilePath: (path: string | null) => void;
  
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
  updateStoryCraftChecklist: (chapterId: string, checklistItemId: string, isCompleted: boolean) => void;
  getStoryCraftFeedback: (chapterId: string) => StoryCraftChapterFeedback | undefined;
  
  // Themes and Motifs actions
  updateThemesAndMotifs: (data: Partial<ThemesAndMotifs>) => void;
  addOrUpdateTheme: (theme: Omit<Theme, 'id'> & { id?: string }) => void;
  addOrUpdateMotif: (motif: Omit<Motif, 'id'> & { id?: string }) => void;
  addOrUpdateSymbol: (symbol: Omit<Symbol, 'id'> & { id?: string }) => void;
  getThemesAndMotifs: () => ThemesAndMotifs;
  
  // Computed
  getActiveChapter: () => Chapter | undefined;
  getChapterById: (id: string) => Chapter | undefined;
  getSortedChapters: () => Chapter[];
  getActiveDocumentTab: () => DocumentTab | undefined;
  getDocumentTabById: (id: string) => DocumentTab | undefined;
  getSortedTimeline: () => TimelineEvent[];
}

const initialBook = createNewBook();

export const useBookStore = create<BookState>((set, get) => ({
  book: initialBook,
  activeChapterId: initialBook.chapters[0]?.id || null,
  ui: {
    showChaptersPanel: true,
    showAIPanel: true,
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
  },
  ai: {
    suggestions: [],
    summaries: new Map(),
    isAnalyzing: false,
    isExtracting: false,
  },

  // Book actions
  setBook: (book) => {
    set({ 
      book, 
      activeChapterId: book.chapters[0]?.id || null,
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
      return {
        ai: { ...state.ai, summaries }
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
      return {
        ai: { ...state.ai, summaries: newSummaries },
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
        
        newFeedback = [
          ...currentFeedback.slice(0, existingIndex),
          { ...feedback, checklist: mergedChecklist, lastUpdated: new Date().toISOString() },
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

  getStoryCraftFeedback: (chapterId) => {
    const state = get();
    return (state.book.extracted.storyCraftFeedback || []).find(f => f.chapterId === chapterId);
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

