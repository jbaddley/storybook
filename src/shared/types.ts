// Core types for the Storybook Editor

// Text-to-Speech voice options (OpenAI TTS)
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Background task for async operations like audio export
export interface BackgroundTask {
  id: string;
  type: 'audio-export';
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  title: string;
  chapterId: string;
  voice?: TTSVoice;
  startedAt: string;
  completedAt?: string;
  error?: string;
  result?: ArrayBuffer; // Stores the audio data when complete
}

// Toast notification for user feedback
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms, default 5000
  action?: {
    label: string;
    onClick: () => void;
  };
}

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
  tabType: 'custom' | 'characters' | 'locations' | 'timeline' | 'summaries' | 'storycraft' | 'themes' | 'plotanalysis';
  createdAt: string;
  updatedAt: string;
}

/** Chapter purpose: central role in the story (from story frameworks: three-act, hero's journey, etc.) */
export const CHAPTER_PURPOSE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'setup', label: 'Setup / Opening' },
  { value: 'introduction', label: 'Introduction (world, characters)' },
  { value: 'inciting_incident', label: 'Inciting incident / Catalyst' },
  { value: 'rising_action', label: 'Rising action' },
  { value: 'complication', label: 'Complication / Subplot development' },
  { value: 'midpoint', label: 'Midpoint turn' },
  { value: 'pre_climax', label: 'Pre-climax build-up' },
  { value: 'climax', label: 'Climax' },
  { value: 'climax_resolution', label: 'Climax resolution' },
  { value: 'falling_action', label: 'Falling action' },
  { value: 'theme_resolution', label: 'Theme resolution' },
  { value: 'wrap_up', label: 'Wrap-up / Denouement' },
  { value: 'final_chapter', label: 'Final chapter' },
  { value: 'transition', label: 'Transition / Bridge' },
  { value: 'flashback', label: 'Flashback / Backstory' },
];

/** Descriptions for each chapter purpose (modern plot frameworks: three-act, hero's journey, story spine) */
export const CHAPTER_PURPOSE_DESCRIPTIONS: Record<string, string> = {
  setup: "Establishes the ordinary world and the story's baseline before the main conflict. In three-act structure this is Act 1's opening; in the Hero's Journey it's the 'Ordinary World.' Show the status quo so the reader understands what will later change.",
  introduction: "Introduces the world, its rules, and the main characters so readers can invest. Establish tone, setting, and the protagonist's normal life. This often overlaps with setup but focuses on who the story is about and why we should care.",
  inciting_incident: "The event that disrupts the status quo and kicks the main plot into motion. Also called the catalyst or 'Call to Adventure.' The protagonist is pushed out of their comfort zone and must respond. Often occurs around the 10–15% mark.",
  rising_action: "Escalates stakes and complications as the protagonist pursues their goal. In three-act structure this is the bulk of Act 2. Obstacles increase, subplots weave in, and the protagonist is tested. Tension and investment build steadily.",
  complication: "Introduces subplots, new obstacles, or reversals that deepen the conflict. Can include a B-plot, a twist, or a setback that makes the main goal harder. Keeps the middle from feeling flat and adds layers to the story.",
  midpoint: "A major turn or revelation that shifts the story's direction or raises the stakes. Often a 'false victory' or 'false defeat,' or a discovery that changes the protagonist's approach. The story pivots; the second half feels different from the first.",
  pre_climax: "The final push toward the climax; tension and obstacles peak. Stakes are at their highest. In the Hero's Journey this is the 'Ordeal.' The protagonist faces their biggest test before the final confrontation.",
  climax: "The central confrontation or turning point where the main conflict is decided. The protagonist and opposing forces clash directly. In three-act structure this is the Act 3 peak. The outcome of the story is determined here.",
  climax_resolution: "The immediate aftermath of the climax; the conflict is resolved. Shows the direct result of the climax—who won, what changed. Brief but decisive; the reader sees the new reality before the story winds down.",
  falling_action: "Consequences unfold; the story winds down from the climax. Loose ends are tied up, and the new normal begins to settle. Tension releases while the reader processes what happened and what it means.",
  theme_resolution: "Thematic threads are tied together; the story's meaning is clarified. The protagonist (and reader) may explicitly or implicitly grasp the theme. Often paired with character growth or a final choice that embodies the theme.",
  wrap_up: "Loose ends are tied up; the new normal is established. Denouement: subplots conclude, relationships land, and the world of the story settles. The reader is given closure and a clear sense of 'where we leave everyone.'",
  final_chapter: "The last chapter of the book. Delivers closure and a lasting impression. Can be a short coda, an epilogue, or the final beat of the main plot. Leave the reader with a clear sense of completion and, if desired, something to reflect on.",
  transition: "A bridge between major sections or acts. Maintains flow and sets up what's next. Can cover time jumps, location changes, or shifts in POV. Keeps the narrative moving without starting a new major story beat.",
  flashback: "Past events that reveal character or context. Used for backstory, motivation, or contrast with the present. In modern structure, flashbacks are often brief and purposeful rather than long detours. Can deepen stakes or explain a character's choice.",
};

export interface Chapter {
  id: string;
  title: string;
  content: TipTapContent;
  order: number;
  wordCount: number;
  purpose?: string; // Optional: one of CHAPTER_PURPOSE_OPTIONS[].value
  comments: ChapterComment[];
  notes: ChapterNote[];
  variations?: ChapterVariation[]; // All variations (DB-only); current is chapter.content
  originalContent?: TipTapContent; // Immutable first version, never overwritten
  originalWordCount?: number; // Word count of original content
  variationAppliedAt?: string; // Legacy: when a variation was last applied
  createdAt: string;
  updatedAt: string;
}

export interface ChangeReportItem {
  category: 'pacing' | 'dialogue' | 'tension' | 'character' | 'theme' | 'hook' | 'clarity';
  description: string;
  scoreTargeted: string;
}

export interface ChangeReport {
  summary: string;
  changes: ChangeReportItem[];
  preservedElements: string[];
  wordCountChange: number;
}

// Variation settings for controlling chapter refinement
export type VariationLengthTarget = 80 | 85 | 90 | 95 | 100 | 105 | 110 | 115 | 120;
export type VariationCreativity = 'strict' | 'moderate' | 'loose';
export type VariationType = 'story_craft' | 'fix_errors' | 'add_color' | 'refine_prose' | 'generate_draft';

// Target word count options for draft generation
export type DraftLengthTarget = 1000 | 1500 | 2000 | 2500 | 3000 | 3500 | 4000;

export interface VariationSettings {
  lengthTarget: VariationLengthTarget;  // 80-120% of original length (for refinement)
  creativity: VariationCreativity;       // How much creative freedom
  variationType: VariationType;          // What kind of variation to generate
  draftWordCount?: DraftLengthTarget;    // Target word count for draft generation
  includeAdjacentChapters?: boolean;     // Include full content of prev/next chapters for context
}

export const DEFAULT_VARIATION_SETTINGS: VariationSettings = {
  lengthTarget: 100,
  creativity: 'moderate',
  variationType: 'story_craft',
  draftWordCount: 2000,
  includeAdjacentChapters: true,         // Default ON - provides better continuity
};

// Threshold for considering a chapter "empty" (needs draft generation)
export const EMPTY_CHAPTER_THRESHOLD = 100; // words

export interface ChapterVariation {
  id: string;
  content: TipTapContent;
  generatedAt: string;
  prompt: string;  // The prompt/instructions used to generate this variation
  basedOnStoryCraft: boolean;  // Whether it was generated from Story Craft suggestions
  wordCount: number;
  changeReport?: ChangeReport;  // Report of what changed and why
  settings?: VariationSettings;  // Settings used to generate this variation
  sourceVariationId?: string;   // Which variation this was based on; undefined = based on chapter original
}

export interface ChapterComment {
  id: string;
  text: string;
  type: 'suggestion' | 'issue' | 'praise' | 'question' | 'note';
  category?: 'plot' | 'character' | 'dialogue' | 'pacing' | 'theme' | 'style' | 'grammar' | 'general';
  resolved: boolean;
  createdAt: string;
  createdBy: 'user' | 'ai';
  targetText?: string; // The text in the document this comment refers to
}

export interface ChapterNote {
  id: string;
  text: string;
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

// Book context settings for AI guidance
export interface BookContextSettings {
  genre: string;              // e.g., "Literary Fiction", "Thriller", "Romance"
  subGenres: string[];        // e.g., ["Mystery", "Coming-of-age"]
  targetDemographic: string;     // e.g., "Adult", "Young Adult", "Middle Grade" (also called "Age level")
  timePeriod: string;         // e.g., "Contemporary (2020s)", "Victorian Era", "Medieval"
  year?: string;              // Specific year or year range, e.g., "1985", "2023", "1776-1783"
  primaryLocation: string;    // e.g., "Boston, Massachusetts", "Rural England"
  additionalContext: string;  // Free-form notes about tone, style, etc.
}

export const DEFAULT_BOOK_CONTEXT: BookContextSettings = {
  genre: '',
  subGenres: [],
  targetDemographic: '',
  timePeriod: '',
  year: '',
  primaryLocation: '',
  additionalContext: '',
};

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
  // Book context for AI guidance
  bookContext: BookContextSettings;
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
  plotErrorAnalysis?: PlotErrorAnalysis | null;
  lastExtracted?: string;
}

// Story Craft Feedback - per chapter assessment with checklist
export interface StoryCraftChapterFeedback {
  chapterId: string;
  chapterTitle: string;
  assessment: StoryCraftAssessment;
  checklist: StoryCraftChecklistItem[];
  summary?: string; // Single paragraph summary of the chapter
  promisesMade?: StoryPromise[]; // Narrative promises introduced in this chapter
  promisesKept?: PromiseKept[]; // Promises from previous chapters resolved here
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

// Story Promise - narrative promises, foreshadowing, setups introduced in a chapter
export interface StoryPromise {
  id: string;
  type: 'foreshadowing' | 'question' | 'setup' | 'tension' | 'mystery';
  description: string;
  context: string; // Brief quote or reference from the chapter
  chapterId: string; // Chapter where this promise was made
  chapterTitle: string; // For display purposes
}

// Promise Kept - tracks when a previous promise is resolved/paid off
export interface PromiseKept {
  promiseId: string; // References original StoryPromise id
  promiseDescription: string; // Copy of the original promise for display
  howKept: string; // How it was resolved/paid off in this chapter
  chapterWherePromised: string; // Chapter ID where promise was made
  chapterTitleWherePromised: string; // Chapter title for display
}

// Plot Error Analysis - comprehensive plot error analysis across chapters
export interface PlotErrorAnalysis {
  id: string;
  bookId: string;
  modelUsed: string; // e.g., 'o1-preview', 'o3-mini'
  generatedAt: string;
  lastUpdated: string;
  chapterAnalyses: ChapterPlotAnalysis[];
  errors: PlotError[];
}

// Chapter Plot Analysis - per-chapter plot analysis
export interface ChapterPlotAnalysis {
  id: string;
  analysisId: string;
  chapterId: string;
  chapterTitle: string;
  proposedTitle?: string; // AI-suggested chapter title
  roles: PlotErrorRole[]; // Chapter roles (what the chapter is doing for the plot using plot frameworks)
  plotSummary?: string; // Brief plot summary for this chapter
  chapterTheme?: string; // One sentence theme of the chapter
  order: number; // Chapter order in book
}

// Plot Error Role - what role a chapter plays in the story
export type PlotErrorRole = 
  | 'setup' 
  | 'introduction' 
  | 'development' 
  | 'exploration' 
  | 'rising_action' 
  | 'climax' 
  | 'falling_action' 
  | 'resolution' 
  | 'transition' 
  | 'bridge' 
  | 'character_development' 
  | 'world_building';

// Plot Error - individual plot error found
export interface PlotError {
  id: string;
  analysisId: string;
  type: PlotErrorType;
  severity: PlotErrorSeverity;
  description: string;
  context?: string; // Additional context about the error
  affectedChapters: string[]; // Chapter IDs affected
}

// Plot Error Type
export type PlotErrorType = 
  | 'name_mismatch' 
  | 'plot_hole' 
  | 'timeline_mistake' 
  | 'character_inconsistency' 
  | 'location_mistake' 
  | 'genre_problem' 
  | 'feasibility_issue' 
  | 'clarity_issue';

// Plot Error Severity
export type PlotErrorSeverity = 
  | 'critical' 
  | 'major' 
  | 'minor' 
  | 'suggestion';

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
  bookContext: DEFAULT_BOOK_CONTEXT,
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
  const content = DEFAULT_TIPTAP_CONTENT;
  return {
    id: generateId(),
    title: `Chapter ${order}`,
    content,
    order,
    wordCount: 0,
    comments: [],
    notes: [],
    variations: [],
    originalContent: content, // Immutable first version
    originalWordCount: 0,
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
    {
      id: 'plotanalysis-tab',
      title: 'Plot Analysis',
      content: DEFAULT_TIPTAP_CONTENT,
      icon: '🔍',
      isPermanent: true,
      tabType: 'plotanalysis',
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
      plotErrorAnalysis: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

