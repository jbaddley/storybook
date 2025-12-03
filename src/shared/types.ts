export type EditorMode = 'wysiwyg' | 'markdown';

export interface StoryElement {
  id: string;
  type: 'character' | 'location' | 'date' | 'theme';
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface LLMProvider {
  name: string;
  id: string;
  apiKey?: string;
  model?: string;
}

export interface ProjectMetadata {
  title?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  htmlContent: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

