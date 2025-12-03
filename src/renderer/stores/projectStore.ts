import { create } from 'zustand';
import { ProjectMetadata } from '@shared/types';

interface ProjectState {
  currentFilePath: string | null;
  metadata: ProjectMetadata;
  setCurrentFilePath: (path: string | null) => void;
  setMetadata: (metadata: Partial<ProjectMetadata>) => void;
}

const PROJECT_STORAGE_KEY = 'storybook-current-project';

// Load project state from localStorage
const loadProjectState = (): Partial<ProjectState> => {
  try {
    const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load project state:', error);
  }
  return {};
};

// Save project state to localStorage
const saveProjectState = (state: ProjectState) => {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify({
      currentFilePath: state.currentFilePath,
      metadata: state.metadata,
    }));
  } catch (error) {
    console.error('Failed to save project state:', error);
  }
};

const loadedState = loadProjectState();

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentFilePath: loadedState.currentFilePath || null,
  metadata: loadedState.metadata || {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  setCurrentFilePath: (path) => {
    set({ currentFilePath: path });
    saveProjectState(get());
  },
  setMetadata: (metadata) => {
    set((state) => {
      const newState = {
        metadata: {
          ...state.metadata,
          ...metadata,
          updatedAt: new Date().toISOString(),
        },
      };
      return newState;
    });
    saveProjectState(get());
  },
}));

