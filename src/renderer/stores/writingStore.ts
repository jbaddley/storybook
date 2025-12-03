import { create } from 'zustand';
import { GrammarSuggestion } from '../services/grammar/checker';
import { WritingSuggestion } from '../services/writing/assistant';

interface WritingState {
  grammarSuggestions: GrammarSuggestion[];
  writingSuggestions: WritingSuggestion[];
  setGrammarSuggestions: (suggestions: GrammarSuggestion[]) => void;
  setWritingSuggestions: (suggestions: WritingSuggestion[]) => void;
  clearAll: () => void;
}

export const useWritingStore = create<WritingState>((set) => ({
  grammarSuggestions: [],
  writingSuggestions: [],
  setGrammarSuggestions: (suggestions) => set({ grammarSuggestions: suggestions }),
  setWritingSuggestions: (suggestions) => set({ writingSuggestions: suggestions }),
  clearAll: () => set({ grammarSuggestions: [], writingSuggestions: [] }),
}));

