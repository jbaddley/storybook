import { create } from 'zustand';
import { StoryElement } from '@shared/types';
import { ExtractedElements } from '../services/storyElements/extractor';

interface StoryElementsState {
  characters: StoryElement[];
  locations: StoryElement[];
  dates: StoryElement[];
  themes: StoryElement[];
  setElements: (elements: ExtractedElements) => void;
  addElement: (element: StoryElement) => void;
  updateElement: (id: string, updates: Partial<StoryElement>) => void;
  removeElement: (id: string) => void;
  clearAll: () => void;
}

export const useStoryElementsStore = create<StoryElementsState>((set) => ({
  characters: [],
  locations: [],
  dates: [],
  themes: [],
  setElements: (elements) => set(elements),
  addElement: (element) =>
    set((state) => {
      const key = `${element.type}s` as keyof StoryElementsState;
      return {
        [key]: [...(state[key] as StoryElement[]), element],
      };
    }),
  updateElement: (id, updates) =>
    set((state) => {
      const updateArray = (arr: StoryElement[]) =>
        arr.map((el) => (el.id === id ? { ...el, ...updates } : el));

      return {
        characters: updateArray(state.characters),
        locations: updateArray(state.locations),
        dates: updateArray(state.dates),
        themes: updateArray(state.themes),
      };
    }),
  removeElement: (id) =>
    set((state) => {
      const removeFromArray = (arr: StoryElement[]) =>
        arr.filter((el) => el.id !== id);

      return {
        characters: removeFromArray(state.characters),
        locations: removeFromArray(state.locations),
        dates: removeFromArray(state.dates),
        themes: removeFromArray(state.themes),
      };
    }),
  clearAll: () =>
    set({
      characters: [],
      locations: [],
      dates: [],
      themes: [],
    }),
}));

