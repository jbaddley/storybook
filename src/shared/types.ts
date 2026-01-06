// Core types for the Storybook Editor

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  chapters: Chapter[];
  documentTabs: DocumentTab[];
  metadata: BookMetadata;
  settings: BookSettings;
  extracted: ExtractedData;
  createdAt: string;
  updatedAt: string;
}

// Custom document tabs (like Google Docs/Word tabs)
export interface DocumentTab {
  id: string;
  title: string;
  content: TipTapContent;
  icon?: string;
  color?: string;
  isPermanent: boolean; // true for Characters, Locations, Timeline, Summaries, StoryCraft, Themes
  tabType: 'custom' | 'characters' | 'locations' | 'timeline' | 'summaries' | 'storycraft' | 'themes';
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: TipTapContent;
  order: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TipTapContent {
  type: 'doc';
  content: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface BookMetadata {
  genre?: string;
  language: string;
  keywords: string[];
  isbn?: string;
  publisher?: string;
  publicationDate?: string;
  // Google Docs integration
  googleDocsSource?: {
    documentId: string;
    documentName: string;
    lastImported: string;
  };
  googleDocsExport?: {
    documentId: string;
    documentName: string;
    webViewLink: string;
    folderId?: string;
    folderPath?: string;
    lastExported: string;
  };
}

export interface BookSettings {
  pageSize: PageSize;
  margins: Margins;
  // Title/Heading font settings
  titleFont: string;
  titleFontSize: number;
  // Body text font settings
  bodyFont: string;
  bodyFontSize: number;
  // Legacy - kept for backwards compatibility
  defaultFont: string;
  defaultFontSize: number;
  lineSpacing: number;
  paragraphSpacing: number;
}

export interface PageSize {
  width: number; // in inches
  height: number; // in inches
  name: string; // e.g., 'Letter', 'A4', 'Custom'
}

export interface Margins {
  top: number; // in inches
  bottom: number; // in inches
  left: number; // in inches
  right: number; // in inches
}

export interface ExtractedData {
  characters: Character[];
  locations: Location[];
  timeline: TimelineEvent[];
  summaries: ChapterSummary[];
  storyCraftFeedback: StoryCraftChapterFeedback[];
  themesAndMotifs: ThemesAndMotifs;
  lastExtracted?: string;
}

// Story Craft Feedback - per chapter assessment with checklist
export interface StoryCraftChapterFeedback {
  chapterId: string;
  chapterTitle: string;
  assessment: StoryCraftAssessment;
  checklist: StoryCraftChecklistItem[];
  generatedAt: string;
  lastUpdated: string;
}

export interface StoryCraftAssessment {
  plotProgression: { score: number; notes: string }; // 1-5 scale
  characterDevelopment: { score: number; notes: string };
  themeReinforcement: { score: number; notes: string };
  pacing: { score: number; notes: string };
  conflictTension: { score: number; notes: string };
  hookEnding: { score: number; notes: string };
  overallNotes: string;
}

export interface StoryCraftChecklistItem {
  id: string;
  category: 'plot' | 'character' | 'theme' | 'pacing' | 'conflict' | 'hook' | 'general';
  suggestion: string;
  isCompleted: boolean;
  completedAt?: string;
  addedAt: string;
}

// Themes and Motifs - tracks across entire book
export interface ThemesAndMotifs {
  themes: Theme[];
  motifs: Motif[];
  symbols: Symbol[];
  lastUpdated: string;
}

export interface Theme {
  id: string;
  name: string;
  type: 'major' | 'minor';
  description: string;
  chapterAppearances: ThemeAppearance[];
  evolutionNotes: string; // How the theme develops across chapters
}

export interface ThemeAppearance {
  chapterId: string;
  chapterTitle: string;
  manifestation: string; // How it appears in this chapter
}

export interface Motif {
  id: string;
  name: string;
  description: string;
  chapterAppearances: { chapterId: string; chapterTitle: string; context: string }[];
}

export interface Symbol {
  id: string;
  name: string;
  meaning: string;
  chapterAppearances: { chapterId: string; chapterTitle: string; context: string }[];
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
  firstAppearance: string; // chapter id
  mentions: ChapterMention[];
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  type?: string; // city, building, country, etc.
  mentions: ChapterMention[];
}

export interface TimelineEvent {
  id: string;
  description: string;
  date?: string; // Human-readable date description
  sortDate?: string; // ISO date for sorting (can be estimated)
  dateType: 'exact' | 'approximate' | 'relative' | 'unknown'; // How precise is the date
  eventType: 'current' | 'past' | 'future' | 'flashback'; // Is this happening now or mentioned as past/future
  chapter: string; // chapter id where this was extracted
  chapterTitle?: string; // chapter title for display
  order: number; // original order in narrative
  chronologicalOrder?: number; // order in actual timeline
}

export interface ChapterMention {
  chapterId: string;
  count: number;
}

// AI Suggestion types
export interface AISuggestion {
  id: string;
  type: 'grammar' | 'spelling' | 'style' | 'content' | 'flow';
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  range?: TextRange;
  originalText?: string;
}

export interface TextRange {
  from: number;
  to: number;
}

export interface ChapterSummary {
  chapterId: string;
  summary: string;
  keyPoints: string[];
  generatedAt: string;
}

// File format types
export interface SBKManifest {
  version: string;
  title: string;
  author: string;
  description: string;
  chapterOrder: string[]; // array of chapter IDs
  createdAt: string;
  updatedAt: string;
}

// IPC Channel types
export type IPCChannel =
  | 'file:new'
  | 'file:open'
  | 'file:save'
  | 'file:save-as'
  | 'file:export-docx'
  | 'file:export-pdf'
  | 'dialog:open-file'
  | 'dialog:save-file'
  | 'store:get'
  | 'store:set'
  | 'app:get-version';

// Default values
export const DEFAULT_PAGE_SIZE: PageSize = {
  width: 8.5,
  height: 11,
  name: 'Letter',
};

export const DEFAULT_MARGINS: Margins = {
  top: 1,
  bottom: 1,
  left: 1.25,
  right: 1.25,
};

export const DEFAULT_BOOK_SETTINGS: BookSettings = {
  pageSize: DEFAULT_PAGE_SIZE,
  margins: DEFAULT_MARGINS,
  titleFont: 'Carlito',
  titleFontSize: 24,
  bodyFont: 'Carlito',
  bodyFontSize: 12,
  defaultFont: 'Carlito',
  defaultFontSize: 12,
  lineSpacing: 1.5,
  paragraphSpacing: 0,
};

export const DEFAULT_TIPTAP_CONTENT: TipTapContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
};

export function createNewChapter(order: number): Chapter {
  return {
    id: generateId(),
    title: `Chapter ${order}`,
    content: DEFAULT_TIPTAP_CONTENT,
    order,
    wordCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultDocumentTabs(): DocumentTab[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'characters-tab',
      title: 'Characters',
      content: DEFAULT_TIPTAP_CONTENT,
      icon: '👤',
      isPermanent: true,
      tabType: 'characters',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'locations-tab',
      title: 'Locations',
      content: DEFAULT_TIPTAP_CONTENT,
      icon: '📍',
      isPermanent: true,
      tabType: 'locations',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'timeline-tab',
      title: 'Timeline',
      content: DEFAULT_TIPTAP_CONTENT,
      icon: '📅',
      isPermanent: true,
      tabType: 'timeline',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'summaries-tab',
      title: 'Summaries',
      content: DEFAULT_TIPTAP_CONTENT,
      icon: '📝',
      isPermanent: true,
      tabType: 'summaries',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'storycraft-tab',
      title: 'Story Craft',
      content: DEFAULT_TIPTAP_CONTENT,
      icon: '🎭',
      isPermanent: true,
      tabType: 'storycraft',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'themes-tab',
      title: 'Themes & Motifs',
      content: DEFAULT_TIPTAP_CONTENT,
      icon: '🎨',
      isPermanent: true,
      tabType: 'themes',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createNewDocumentTab(title: string): DocumentTab {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title,
    content: DEFAULT_TIPTAP_CONTENT,
    isPermanent: false,
    tabType: 'custom',
    createdAt: now,
    updatedAt: now,
  };
}

export function createNewBook(): Book {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: 'Untitled Book',
    author: '',
    description: '',
    chapters: [createNewChapter(1)],
    documentTabs: createDefaultDocumentTabs(),
    metadata: {
      language: 'en',
      keywords: [],
    },
    settings: DEFAULT_BOOK_SETTINGS,
    extracted: {
      characters: [],
      locations: [],
      timeline: [],
      summaries: [],
      storyCraftFeedback: [],
      themesAndMotifs: {
        themes: [],
        motifs: [],
        symbols: [],
        lastUpdated: now,
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

