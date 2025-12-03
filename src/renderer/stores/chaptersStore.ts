import { create } from 'zustand';
import { Chapter } from '@shared/types';

interface ChaptersState {
  chapters: Chapter[];
  currentChapterId: string | null;
  setChapters: (chapters: Chapter[]) => void;
  addChapter: (chapter: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>) => Chapter;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  deleteChapter: (id: string) => void;
  setCurrentChapter: (id: string | null) => void;
  getCurrentChapter: () => Chapter | null;
  reorderChapters: (chapterIds: string[]) => void;
}

const CHAPTERS_STORAGE_KEY = 'storybook-chapters';

// Load chapters from localStorage
const loadChapters = (): { chapters: Chapter[]; currentChapterId: string | null } => {
  try {
    const stored = localStorage.getItem(CHAPTERS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load chapters:', error);
  }
  return { chapters: [], currentChapterId: null };
};

// Save chapters to localStorage
const saveChapters = (state: ChaptersState) => {
  try {
    localStorage.setItem(CHAPTERS_STORAGE_KEY, JSON.stringify({
      chapters: state.chapters,
      currentChapterId: state.currentChapterId,
    }));
  } catch (error) {
    console.error('Failed to save chapters:', error);
  }
};

const loadedChapters = loadChapters();

export const useChaptersStore = create<ChaptersState>((set, get) => ({
  chapters: loadedChapters.chapters || [],
  currentChapterId: loadedChapters.currentChapterId || null,
  setChapters: (chapters) => {
    set({ chapters });
    saveChapters(get());
  },
  addChapter: (chapterData) => {
    const newChapter: Chapter = {
      ...chapterData,
      id: `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => {
      const newState = {
        chapters: [...state.chapters, newChapter].sort((a, b) => a.order - b.order),
        currentChapterId: newChapter.id,
      };
      saveChapters({ ...state, ...newState });
      return newState;
    });
    return newChapter;
  },
  updateChapter: (id, updates) => {
    set((state) => {
      const newState = {
        chapters: state.chapters.map((chapter) =>
          chapter.id === id
            ? { ...chapter, ...updates, updatedAt: new Date().toISOString() }
            : chapter
        ),
      };
      saveChapters({ ...state, ...newState });
      return newState;
    });
  },
  deleteChapter: (id) => {
    set((state) => {
      const remaining = state.chapters.filter((chapter) => chapter.id !== id);
      const newState = {
        chapters: remaining,
        currentChapterId:
          state.currentChapterId === id
            ? remaining.length > 0
              ? remaining[0].id
              : null
            : state.currentChapterId,
      };
      saveChapters({ ...state, ...newState });
      return newState;
    });
  },
  setCurrentChapter: (id) => {
    set({ currentChapterId: id });
    saveChapters(get());
  },
  getCurrentChapter: () => {
    const state = get();
    return state.chapters.find((c) => c.id === state.currentChapterId) || null;
  },
  reorderChapters: (chapterIds) => {
    set((state) => {
      const newState = {
        chapters: chapterIds
          .map((id, index) => {
            const chapter = state.chapters.find((c) => c.id === id);
            return chapter ? { ...chapter, order: index } : null;
          })
          .filter((c): c is Chapter => c !== null),
      };
      saveChapters({ ...state, ...newState });
      return newState;
    });
  },
}));

