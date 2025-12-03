import { create } from 'zustand';
import { EditorMode } from '@shared/types';
import { useChaptersStore } from './chaptersStore';

interface EditorState {
  mode: EditorMode;
  content: string;
  htmlContent: string;
  isLoadingChapter: boolean; // Flag to prevent auto-save during chapter load
  setMode: (mode: EditorMode) => void;
  setContent: (content: string) => void;
  setHtmlContent: (html: string) => void;
  setLoadingChapter: (loading: boolean) => void;
  // Sync content with current chapter
  syncWithChapter: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  mode: 'wysiwyg',
  content: '',
  htmlContent: '',
  isLoadingChapter: false,
  setMode: (mode) => set({ mode }),
  setLoadingChapter: (loading) => set({ isLoadingChapter: loading }),
  setContent: (content) => {
    set({ content });
    // Auto-save to current chapter (only if not loading a chapter)
    const state = get();
    if (!state.isLoadingChapter) {
      const currentChapter = useChaptersStore.getState().getCurrentChapter();
      if (currentChapter) {
        // Use setTimeout to debounce updates
        const timeoutId = (window as any).__contentSaveTimeout;
        if (timeoutId) clearTimeout(timeoutId);
        (window as any).__contentSaveTimeout = setTimeout(() => {
          useChaptersStore.getState().updateChapter(currentChapter.id, { content });
        }, 500);
      }
    }
  },
  setHtmlContent: (htmlContent) => {
    set({ htmlContent });
    // Auto-save to current chapter (only if not loading a chapter)
    const state = get();
    if (!state.isLoadingChapter) {
      const currentChapter = useChaptersStore.getState().getCurrentChapter();
      if (currentChapter) {
        // Use setTimeout to debounce updates
        const timeoutId = (window as any).__htmlContentSaveTimeout;
        if (timeoutId) clearTimeout(timeoutId);
        (window as any).__htmlContentSaveTimeout = setTimeout(() => {
          useChaptersStore.getState().updateChapter(currentChapter.id, { htmlContent });
        }, 500);
      }
    }
  },
  syncWithChapter: () => {
    const currentChapter = useChaptersStore.getState().getCurrentChapter();
    if (currentChapter) {
      set({
        content: currentChapter.content,
        htmlContent: currentChapter.htmlContent,
      });
    } else {
      set({ content: '', htmlContent: '' });
    }
  },
}));

