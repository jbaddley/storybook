import { create } from 'zustand';
import { EditorMode } from '@shared/types';
import { LLMConfig } from '../services/llm/types';

interface SettingsState {
  editorMode: EditorMode;
  autoSaveInterval: number;
  llmProvider: string;
  llmConfigs: Record<string, LLMConfig>;
  setEditorMode: (mode: EditorMode) => void;
  setAutoSaveInterval: (interval: number) => void;
  setLLMProvider: (provider: string) => void;
  setLLMConfig: (provider: string, config: LLMConfig) => void;
}

const STORAGE_KEY = 'storybook-settings';
const API_KEYS_KEY = 'storybook-api-keys'; // Separate storage for API keys

// Load settings from localStorage
const loadSettings = (): Partial<SettingsState> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const apiKeys = localStorage.getItem(API_KEYS_KEY);
    
    if (stored) {
      const settings = JSON.parse(stored);
      
      // Merge API keys if they exist
      if (apiKeys) {
        try {
          const keys = JSON.parse(apiKeys);
          if (settings.llmConfigs) {
            Object.keys(settings.llmConfigs).forEach((provider) => {
              if (keys[provider]) {
                settings.llmConfigs[provider].apiKey = keys[provider];
              }
            });
          }
        } catch (e) {
          console.error('Failed to load API keys:', e);
        }
      }
      
      return settings;
    }
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error);
  }
  return {};
};

// Save settings to localStorage
const saveSettings = (state: SettingsState) => {
  try {
    // Save non-sensitive settings
    const settingsToSave = {
      editorMode: state.editorMode,
      autoSaveInterval: state.autoSaveInterval,
      llmProvider: state.llmProvider,
      llmConfigs: Object.fromEntries(
        Object.entries(state.llmConfigs).map(([key, config]) => [
          key,
          {
            model: config.model,
            baseURL: config.baseURL,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            // Don't save API key here
          },
        ])
      ),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
    
    // Save API keys separately
    const apiKeys: Record<string, string> = {};
    Object.entries(state.llmConfigs).forEach(([provider, config]) => {
      if (config.apiKey && config.apiKey !== '***') {
        apiKeys[provider] = config.apiKey;
      }
    });
    localStorage.setItem(API_KEYS_KEY, JSON.stringify(apiKeys));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
};

const defaultState: SettingsState = {
  editorMode: 'wysiwyg',
  autoSaveInterval: 30000, // 30 seconds
  llmProvider: 'openai',
  llmConfigs: {
    openai: {
      model: 'gpt-3.5-turbo',
    },
    anthropic: {
      model: 'claude-3-haiku-20240307',
    },
    ollama: {
      model: 'llama2',
      baseURL: 'http://localhost:11434',
    },
  },
  setEditorMode: () => {},
  setAutoSaveInterval: () => {},
  setLLMProvider: () => {},
  setLLMConfig: () => {},
};

const loadedSettings = loadSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultState,
  ...loadedSettings,
  // Restore API keys from a separate secure storage if needed
  // For now, API keys need to be re-entered (more secure)
  setEditorMode: (mode) => {
    set({ editorMode: mode });
    saveSettings(get());
  },
  setAutoSaveInterval: (interval) => {
    set({ autoSaveInterval: interval });
    saveSettings(get());
  },
  setLLMProvider: (provider) => {
    set({ llmProvider: provider });
    saveSettings(get());
  },
  setLLMConfig: (provider, config) => {
    set((state) => {
      const newConfigs = {
        ...state.llmConfigs,
        [provider]: config,
      };
      return { llmConfigs: newConfigs };
    });
    saveSettings(get());
  },
}));
