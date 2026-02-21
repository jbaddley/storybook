import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { useOpenAI } from '../hooks/useOpenAI';
import { TipTapContent, BookSettings, StoryCraftChapterFeedback, generateId } from '../../shared/types';
import { AIChatBot } from './AIChatBot';
import { CommentsPanel } from './CommentsPanel';
import { NotesPanel } from './NotesPanel';
import { openAIService } from '../services/openaiService';
import { plotAnalysisService } from '../services/plotAnalysisService';
import { normalizeQuotesInTipTapContent } from '../utils/quoteNormalize';
import { outlineContentToPlainText } from '../utils/outlineContent';

// Icons
const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>
  </svg>
);

const FileTextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const ExtractIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const StoryCraftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
    <line x1="9" y1="9" x2="9.01" y2="9"/>
    <line x1="15" y1="9" x2="15.01" y2="9"/>
    <path d="M8 6h8v2H8z"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22,4 12,14.01 9,11.01"/>
  </svg>
);

const FormatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="21" y1="10" x2="7" y2="10"/>
    <line x1="21" y1="6" x2="3" y2="6"/>
    <line x1="21" y1="14" x2="3" y2="14"/>
    <line x1="21" y1="18" x2="7" y2="18"/>
  </svg>
);

const AlertCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const ActionsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const CommentsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <line x1="9" y1="9" x2="15" y2="9" />
    <line x1="9" y1="13" x2="13" y2="13" />
  </svg>
);

const NotesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

/** Single actions dropdown for the AI panel header */
export const AIPanelHeaderActions: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { ui, setAIPanelTab } = useBookStore();
  const activeTab = ui.aiPanelTab;

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onOutside);
      return () => document.removeEventListener('mousedown', onOutside);
    }
  }, [open]);

  const setTabAndClose = (tab: 'actions' | 'chat' | 'comments' | 'notes') => {
    setAIPanelTab(tab);
    setOpen(false);
  };

  return (
    <div className="panel-actions-dropdown" ref={ref}>
      <button
        type="button"
        className="panel-actions-dropdown-trigger panel-actions-dropdown-trigger-icon-only"
        onClick={() => setOpen((o) => !o)}
        title="AI panel view"
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="panel-actions-dropdown-menu">
          <button type="button" onClick={() => setTabAndClose('actions')}>
            <ActionsIcon />
            Actions
          </button>
          <button type="button" onClick={() => setTabAndClose('chat')}>
            <ChatIcon />
            Chat
          </button>
          <button type="button" onClick={() => setTabAndClose('comments')}>
            <CommentsIcon />
            Comments
          </button>
          <button type="button" onClick={() => setTabAndClose('notes')}>
            <NotesIcon />
            Notes
          </button>
        </div>
      )}
    </div>
  );
};

// Book formatting utility
interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, any> }[];
  attrs?: Record<string, any>;
}

interface FormatSettings {
  titleFont: string;
  titleFontSize: number;
  bodyFont: string;
  bodyFontSize: number;
}

// Check if a node is effectively empty (no meaningful text content)
function isNodeEmpty(node: TipTapNode): boolean {
  // A node with no content array is empty
  if (!node.content || node.content.length === 0) {
    return true;
  }
  
  // Check if any child node has comment marks - if so, it's NOT empty (preserve it)
  const nodeStr = JSON.stringify(node);
  if (nodeStr.includes('"type":"comment"')) {
    console.log('[isNodeEmpty] Node has comment marks - treating as NOT empty');
    return false;
  }
  
  // Check if all content is just whitespace or empty
  const textContent = getNodeTextContent(node);
  const isEmpty = textContent.trim() === '';
  
  // Debug: if this seems wrong, log it
  if (isEmpty && node.content.length > 0) {
    console.log('[isNodeEmpty] Node has content array but no text:', JSON.stringify(node).substring(0, 200));
  }
  
  return isEmpty;
}

// Extract all text content from a node recursively
function getNodeTextContent(node: TipTapNode): string {
  if (node.text) {
    return node.text;
  }
  if (!node.content) {
    return '';
  }
  return node.content.map(child => getNodeTextContent(child)).join('');
}

// Apply font styling to text nodes - preserves all other marks like comments
function applyFontToContent(
  content: TipTapNode[] | undefined, 
  fontFamily: string, 
  fontSize: number
): TipTapNode[] | undefined {
  if (!content) return content;
  
  return content.map(node => {
    if (node.type === 'text') {
      // Find existing marks
      const existingMarks = node.marks || [];
      
      // Separate comment marks from other marks (to preserve them exactly)
      const commentMarks = existingMarks.filter(m => m.type === 'comment');
      const otherMarks = existingMarks.filter(m => m.type !== 'comment');
      
      // Find or create textStyle mark
      const hasTextStyle = otherMarks.some(m => m.type === 'textStyle');
      
      let newOtherMarks;
      if (hasTextStyle) {
        // Update existing textStyle
        newOtherMarks = otherMarks.map(mark => {
          if (mark.type === 'textStyle') {
            return {
              ...mark,
              attrs: {
                ...mark.attrs,
                fontFamily,
                fontSize: `${fontSize}pt`
              }
            };
          }
          return mark;
        });
      } else {
        // Add textStyle mark
        newOtherMarks = [
          ...otherMarks,
          {
            type: 'textStyle',
            attrs: {
              fontFamily,
              fontSize: `${fontSize}pt`
            }
          }
        ];
      }
      
      // Combine: comment marks first (as they were), then other marks
      const newMarks = [...commentMarks, ...newOtherMarks];
      
      return {
        ...node,
        marks: newMarks
      };
    }
    
    // Recursively process nested content
    if (node.content) {
      return {
        ...node,
        content: applyFontToContent(node.content, fontFamily, fontSize)
      };
    }
    
    return node;
  });
}

function formatBookContent(doc: TipTapNode, settings?: FormatSettings): TipTapNode {
  if (!doc.content) {
    console.warn('[formatBookContent] Document has no content');
    return doc;
  }
  
  console.log('[formatBookContent] Processing', doc.content.length, 'nodes');
  
  // Check if any nodes have comment marks
  const hasComments = JSON.stringify(doc).includes('"type":"comment"');
  if (hasComments) {
    console.log('[formatBookContent] ⚠️ Document contains comment marks - will preserve them');
  }
  
  const formattedContent: TipTapNode[] = [];
  let previousWasHeading = false;
  let isFirstParagraph = true;
  let skippedCount = 0;

  for (let i = 0; i < doc.content.length; i++) {
    const node = doc.content[i];
    
    // Handle paragraphs
    if (node.type === 'paragraph') {
      const isEmpty = isNodeEmpty(node);
      
      if (isEmpty) {
        // Skip ALL empty paragraphs to remove excess whitespace
        skippedCount++;
        continue;
      }
      
      // Non-empty paragraph - format and add it
      let formattedNode = formatParagraph(node, previousWasHeading, isFirstParagraph);
      
      // Apply body font if settings provided
      if (settings) {
        formattedNode = {
          ...formattedNode,
          content: applyFontToContent(formattedNode.content, settings.bodyFont, settings.bodyFontSize)
        };
      }
      
      formattedContent.push(formattedNode);
      previousWasHeading = false;
      isFirstParagraph = false;
    } 
    // Headings - apply title font
    else if (node.type === 'heading') {
      let formattedHeading = { ...node };
      
      // Apply title font if settings provided
      if (settings && node.content) {
        // Determine font size based on heading level
        const headingLevel = node.attrs?.level || 1;
        let headingFontSize = settings.titleFontSize;
        
        // Scale font size based on heading level
        if (headingLevel === 2) {
          headingFontSize = Math.round(settings.titleFontSize * 0.85);
        } else if (headingLevel === 3) {
          headingFontSize = Math.round(settings.titleFontSize * 0.75);
        } else if (headingLevel >= 4) {
          headingFontSize = Math.round(settings.titleFontSize * 0.65);
        }
        
        formattedHeading = {
          ...formattedHeading,
          content: applyFontToContent(node.content, settings.titleFont, headingFontSize)
        };
      }
      
      formattedContent.push(formattedHeading);
      previousWasHeading = true;
    }
    // Hard breaks - skip if between paragraphs
    else if (node.type === 'hardBreak') {
      skippedCount++;
      continue;
    }
    // Keep other nodes as-is but apply body font
    else {
      console.log('[formatBookContent] Keeping other node type:', node.type);
      let formattedNode = node;
      if (settings && node.content) {
        formattedNode = {
          ...node,
          content: applyFontToContent(node.content, settings.bodyFont, settings.bodyFontSize)
        };
      }
      formattedContent.push(formattedNode);
      previousWasHeading = false;
    }
  }

  console.log('[formatBookContent] Result:', formattedContent.length, 'nodes kept,', skippedCount, 'skipped');
  
  // Safety: if we would return empty content but input wasn't empty, return original
  if (formattedContent.length === 0 && doc.content.length > 0) {
    console.error('[formatBookContent] SAFETY: Would have returned empty! Returning original.');
    return doc;
  }

  return {
    ...doc,
    content: formattedContent
  };
}

function formatParagraph(
  node: TipTapNode, 
  afterHeading: boolean,
  isFirst: boolean
): TipTapNode {
  if (!node.content || node.content.length === 0) return node;

  // Clone the content
  const newContent = [...node.content];
  
  // Get the first text node
  const firstTextNodeIndex = newContent.findIndex(n => n.type === 'text');
  if (firstTextNodeIndex === -1) return node;
  
  const firstTextNode = newContent[firstTextNodeIndex];
  if (!firstTextNode.text) return node;
  
  // Clean up the text: trim leading whitespace but preserve trailing
  let cleanedText = firstTextNode.text.replace(/^[\s\t]+/, '');
  
  // Don't indent first paragraph or paragraphs after headings (standard book format)
  // For all other paragraphs, add a tab indent
  if (!afterHeading && !isFirst) {
    cleanedText = '\t' + cleanedText;
  }
  
  // Update the text node
  newContent[firstTextNodeIndex] = {
    ...firstTextNode,
    text: cleanedText
  };
  
  // Clean trailing text nodes - remove trailing whitespace from last text node
  const lastTextNodeIndex = newContent.map((n, i) => n.type === 'text' ? i : -1)
    .filter(i => i !== -1)
    .pop();
  
  if (lastTextNodeIndex !== undefined && lastTextNodeIndex !== firstTextNodeIndex) {
    const lastTextNode = newContent[lastTextNodeIndex];
    if (lastTextNode.text) {
      newContent[lastTextNodeIndex] = {
        ...lastTextNode,
        text: lastTextNode.text.replace(/[\s\t]+$/, '')
      };
    }
  }
  
  return {
    ...node,
    content: newContent
  };
}

// Helper to extract plain text from TipTap content
function extractTextFromContent(content: any): string {
  if (!content) return '';
  
  if (typeof content === 'string') return content;
  
  if (content.text) return content.text;
  
  if (content.content && Array.isArray(content.content)) {
    return content.content
      .map((node: any) => extractTextFromContent(node))
      .join('\n');
  }
  
  return '';
}

export const AIPanel: React.FC = () => {
  const { 
    ai, 
    getActiveChapter, 
    book,
    setAnalyzing,
    setExtracting,
    setSuggestions,
    addSummary,
    updateChapterContent,
    activeChapterId,
    addOrUpdateStoryCraftFeedback,
    replaceStoryCraftFeedback,
    getStoryCraftFeedback,
    getAllPromisesMade,
    updateThemesAndMotifs,
    addOrUpdateTheme,
    addOrUpdateMotif,
    addOrUpdateSymbol,
    addComment,
    clearChapterComments,
    setPlotErrorAnalysis,
    updateDocumentTabContent,
    setStoryCraftRunningChapterId,
  } = useBookStore();
  
  const { 
    summarizeChapter, 
    analyzeGrammar, 
    extractCharacters,
    extractLocations,
    extractTimeline,
    isConfigured 
  } = useOpenAI();

  const activeChapter = getActiveChapter();
  const { ui, setAIPanelTab, setPendingChatMessage, setChatInputPreFill, setPanelSettings } = useBookStore();
  const activeTab = ui.aiPanelTab;
  const isOutlinerActive = ui.activeDocumentTabId === 'outliner-tab';
  const hasDocumentForAI = !!activeChapter || isOutlinerActive;
  const pendingChatMessage = ui.pendingChatMessage;
  const chatInputPreFill = ui.chatInputPreFill;
  
  // Count unresolved comments for badge
  const unresolvedCommentCount = useMemo(() => {
    if (!activeChapter) return 0;
    return (activeChapter.comments || []).filter(c => !c.resolved).length;
  }, [activeChapter]);
  const [isFormatting, setIsFormatting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; chapter: string } | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isAnalyzingPlot, setIsAnalyzingPlot] = useState(false);
  const [plotAnalysisProgress, setPlotAnalysisProgress] = useState<string | null>(null);
  const [isGeneratingIllustration, setIsGeneratingIllustration] = useState(false);
  const [generatedIllustrationDataUrl, setGeneratedIllustrationDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setGeneratedIllustrationDataUrl(null);
  }, [activeChapterId]);

  const handleSendCommentToChat = (text: string) => {
    setPendingChatMessage(text);
    setAIPanelTab('chat');
    setPanelSettings({ showAIPanel: true });
  };

  // Story Craft analysis only (no characters, locations, timeline, summary, themes, or inline comments)
  const handleStoryCraftOnly = async () => {
    if (!activeChapter || !isConfigured) return;
    setStoryCraftRunningChapterId(activeChapter.id);
    const existingFeedback = getStoryCraftFeedback(activeChapter.id);
    if (!existingFeedback) {
      const placeholder: StoryCraftChapterFeedback = {
        chapterId: activeChapter.id,
        chapterTitle: activeChapter.title,
        assessment: {
          plotProgression: { score: 0, notes: '' },
          characterDevelopment: { score: 0, notes: '' },
          themeReinforcement: { score: 0, notes: '' },
          pacing: { score: 0, notes: '' },
          conflictTension: { score: 0, notes: '' },
          hookEnding: { score: 0, notes: '' },
          overallNotes: '',
        },
        checklist: [],
        summary: 'Analyzing…',
        generatedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      replaceStoryCraftFeedback(activeChapter.id, placeholder);
    }
    try {
      const chapterText = extractTextFromContent(activeChapter.content);
      const themesContext = book.extracted.themesAndMotifs?.themes.map(t => t.name).join(', ');
      const previousPromises = getAllPromisesMade(activeChapter.order);
      const songsContext = (book.songs ?? []).length > 0
        ? (book.songs ?? []).map(s => {
            const chars = s.characters?.length ? ` Characters: ${s.characters.join(', ')}` : '';
            const inst = s.instruments?.length ? ` Instruments: ${s.instruments.join(', ')}` : '';
            const style = s.style ? ` Style: ${s.style}` : '';
            const genre = s.genre ? ` Genre: ${s.genre}` : '';
            const tempo = s.tempo ? ` Tempo: ${s.tempo}` : '';
            const key = s.key ? ` Key: ${s.key}` : '';
            const desc = s.description ? ` ${s.description}` : '';
            const lyricsPart = s.lyrics ? ` Lyrics: ${s.lyrics.replace(/\n/g, ' | ')}` : '';
            return `${s.title}:${desc}${lyricsPart}${style}${genre}${chars}${tempo}${key}${inst}`;
          }).join('\n')
        : undefined;
      const storyCraftResult = await openAIService.extractStoryCraftFeedback(
        chapterText,
        activeChapter.id,
        activeChapter.title,
        {
          themes: themesContext,
          previousPromises: previousPromises.length > 0 ? previousPromises : undefined,
          bookSettings: book.settings.bookContext,
          chapterPurpose: activeChapter.purpose,
          bookOutline: outlineContentToPlainText(book.outline?.content),
          songs: songsContext,
        }
      );
      if (storyCraftResult) {
        const newFeedback: StoryCraftChapterFeedback = {
          chapterId: activeChapter.id,
          chapterTitle: activeChapter.title,
          assessment: storyCraftResult.assessment,
          checklist: storyCraftResult.checklist.map(item => ({
            id: `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            suggestion: item.suggestion,
            category: item.category as 'plot' | 'character' | 'theme' | 'pacing' | 'conflict' | 'hook' | 'general',
            isCompleted: false,
            addedAt: new Date().toISOString(),
          })),
          summary: storyCraftResult.summary,
          promisesMade: storyCraftResult.promisesMade?.map(p => ({
            id: generateId(),
            type: p.type,
            description: p.description,
            context: p.context,
            chapterId: activeChapter.id,
            chapterTitle: activeChapter.title,
          })),
          promisesKept: storyCraftResult.promisesKept?.map(p => ({
            promiseId: p.promiseId,
            promiseDescription: p.promiseDescription,
            howKept: p.howKept,
            chapterWherePromised: p.chapterWherePromised,
            chapterTitleWherePromised: p.chapterTitleWherePromised,
          })),
          generatedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        replaceStoryCraftFeedback(activeChapter.id, newFeedback);
      } else if (!existingFeedback) {
        const failedPlaceholder: StoryCraftChapterFeedback = {
          chapterId: activeChapter.id,
          chapterTitle: activeChapter.title,
          assessment: {
            plotProgression: { score: 0, notes: '' },
            characterDevelopment: { score: 0, notes: '' },
            themeReinforcement: { score: 0, notes: '' },
            pacing: { score: 0, notes: '' },
            conflictTension: { score: 0, notes: '' },
            hookEnding: { score: 0, notes: '' },
            overallNotes: '',
          },
          checklist: [],
          summary: 'Analysis failed. Click Re-run in Story Craft to try again.',
          generatedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        replaceStoryCraftFeedback(activeChapter.id, failedPlaceholder);
      }
    } catch (err) {
      console.error('Story craft analysis failed:', err);
      if (!existingFeedback) {
        const failedPlaceholder: StoryCraftChapterFeedback = {
          chapterId: activeChapter.id,
          chapterTitle: activeChapter.title,
          assessment: {
            plotProgression: { score: 0, notes: '' },
            characterDevelopment: { score: 0, notes: '' },
            themeReinforcement: { score: 0, notes: '' },
            pacing: { score: 0, notes: '' },
            conflictTension: { score: 0, notes: '' },
            hookEnding: { score: 0, notes: '' },
            overallNotes: '',
          },
          checklist: [],
          summary: 'Analysis failed. Click Re-run in Story Craft to try again.',
          generatedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        replaceStoryCraftFeedback(activeChapter.id, failedPlaceholder);
      }
    } finally {
      setStoryCraftRunningChapterId(null);
    }
  };

  // Combined extraction - extract all at once
  const handleExtractAll = async () => {
    if (!activeChapter || !isConfigured) return;
    
    setExtracting(true);
    
    try {
      // Extract characters (chapter stays in Story Craft list; we replace feedback when done)
      setExtractionProgress('Extracting characters...');
      await extractCharacters(activeChapter);
      
      // Extract locations
      setExtractionProgress('Extracting locations...');
      await extractLocations(activeChapter);
      
      // Extract timeline
      setExtractionProgress('Extracting timeline...');
      await extractTimeline(activeChapter);
      
      // Summarize chapter
      setExtractionProgress('Generating summary...');
      const summary = await summarizeChapter(activeChapter);
      if (summary) {
        addSummary(summary);
      }
      
      // Assess Story Craft with Promises Tracking
      setExtractionProgress('Assessing story craft...');
      setStoryCraftRunningChapterId(activeChapter.id);
      // If chapter has no story craft feedback yet, add a placeholder so it stays visible in the list
      const existingFeedback = getStoryCraftFeedback(activeChapter.id);
      if (!existingFeedback) {
        const placeholder: StoryCraftChapterFeedback = {
          chapterId: activeChapter.id,
          chapterTitle: activeChapter.title,
          assessment: {
            plotProgression: { score: 0, notes: '' },
            characterDevelopment: { score: 0, notes: '' },
            themeReinforcement: { score: 0, notes: '' },
            pacing: { score: 0, notes: '' },
            conflictTension: { score: 0, notes: '' },
            hookEnding: { score: 0, notes: '' },
            overallNotes: '',
          },
          checklist: [],
          summary: 'Analyzing…',
          generatedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        replaceStoryCraftFeedback(activeChapter.id, placeholder);
      }
      const chapterText = extractTextFromContent(activeChapter.content);
      const themesData = book.extracted.themesAndMotifs;
      const themesContext = themesData?.themes.map(t => t.name).join(', ');
      const previousPromises = getAllPromisesMade(activeChapter.order);
      
      let storyCraftResult;
      try {
        const songsContext = (book.songs ?? []).length > 0
          ? (book.songs ?? []).map(s => {
              const chars = s.characters?.length ? ` Characters: ${s.characters.join(', ')}` : '';
              const inst = s.instruments?.length ? ` Instruments: ${s.instruments.join(', ')}` : '';
              const style = s.style ? ` Style: ${s.style}` : '';
              const genre = s.genre ? ` Genre: ${s.genre}` : '';
              const tempo = s.tempo ? ` Tempo: ${s.tempo}` : '';
              const key = s.key ? ` Key: ${s.key}` : '';
              const desc = s.description ? ` ${s.description}` : '';
              const lyricsPart = s.lyrics ? ` Lyrics: ${s.lyrics.replace(/\n/g, ' | ')}` : '';
              return `${s.title}:${desc}${lyricsPart}${style}${genre}${chars}${tempo}${key}${inst}`;
            }).join('\n')
          : undefined;
        storyCraftResult = await openAIService.extractStoryCraftFeedback(
          chapterText,
          activeChapter.id,
          activeChapter.title,
          {
            themes: themesContext,
            previousPromises: previousPromises.length > 0 ? previousPromises : undefined,
            bookSettings: book.settings.bookContext,
            chapterPurpose: activeChapter.purpose,
            bookOutline: outlineContentToPlainText(book.outline?.content),
            songs: songsContext,
          }
        );
      } catch (err) {
        console.error('Story craft extraction failed:', err);
        storyCraftResult = null;
      }
      if (storyCraftResult) {
        const newFeedback: StoryCraftChapterFeedback = {
          chapterId: activeChapter.id,
          chapterTitle: activeChapter.title,
          assessment: storyCraftResult.assessment,
          checklist: storyCraftResult.checklist.map(item => ({
            id: `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            suggestion: item.suggestion,
            category: item.category as 'plot' | 'character' | 'theme' | 'pacing' | 'conflict' | 'hook' | 'general',
            isCompleted: false,
            addedAt: new Date().toISOString(),
          })),
          summary: storyCraftResult.summary,
          promisesMade: storyCraftResult.promisesMade?.map(p => ({
            id: generateId(),
            type: p.type,
            description: p.description,
            context: p.context,
            chapterId: activeChapter.id,
            chapterTitle: activeChapter.title,
          })),
          promisesKept: storyCraftResult.promisesKept?.map(p => ({
            promiseId: p.promiseId,
            promiseDescription: p.promiseDescription,
            howKept: p.howKept,
            chapterWherePromised: p.chapterWherePromised,
            chapterTitleWherePromised: p.chapterTitleWherePromised,
          })),
          generatedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        replaceStoryCraftFeedback(activeChapter.id, newFeedback);
      } else if (!existingFeedback) {
        // API failed and we had added a placeholder – update it so the chapter stays visible with Re-run
        const failedPlaceholder: StoryCraftChapterFeedback = {
          chapterId: activeChapter.id,
          chapterTitle: activeChapter.title,
          assessment: {
            plotProgression: { score: 0, notes: '' },
            characterDevelopment: { score: 0, notes: '' },
            themeReinforcement: { score: 0, notes: '' },
            pacing: { score: 0, notes: '' },
            conflictTension: { score: 0, notes: '' },
            hookEnding: { score: 0, notes: '' },
            overallNotes: '',
          },
          checklist: [],
          summary: 'Analysis failed. Click Re-run in Story Craft to try again.',
          generatedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
        replaceStoryCraftFeedback(activeChapter.id, failedPlaceholder);
      }
      setStoryCraftRunningChapterId(null);
      
      // Generate inline comments for StoryCraft feedback
      setExtractionProgress('Adding inline comments...');
      const storyCraftComments = await openAIService.generateStoryCraftComments(
        chapterText,
        activeChapter.id,
        activeChapter.title
      );
      
      if (storyCraftComments && storyCraftComments.length > 0) {
        // Clear existing AI comments first to avoid duplicates
        clearChapterComments(activeChapter.id);
        
        // Get the TipTap editor to apply comment marks
        const editor = (window as any).__tiptapEditor;
        
        // Add new comments and apply marks to the editor
        for (const commentData of storyCraftComments) {
          const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const comment = {
            id: commentId,
            text: commentData.comment,
            type: commentData.type as 'suggestion' | 'issue' | 'praise',
            category: commentData.category as 'plot' | 'character' | 'dialogue' | 'pacing' | 'theme' | 'style' | 'general',
            resolved: false,
            createdAt: new Date().toISOString(),
            createdBy: 'ai' as const,
            targetText: commentData.targetText, // Store the target text for finding later
          };
          addComment(activeChapter.id, comment);
          
          // Apply comment mark to the editor if available
          if (editor && commentData.targetText) {
            const docText = editor.getText();
            const targetText = commentData.targetText;
            
            // Find the position of the target text
            let pos = docText.indexOf(targetText);
            
            // Try normalized match if exact match fails
            if (pos === -1) {
              // Simple normalization - collapse whitespace
              const normalizedDoc = docText.replace(/\s+/g, ' ');
              const normalizedTarget = targetText.replace(/\s+/g, ' ');
              pos = normalizedDoc.indexOf(normalizedTarget);
            }
            
            if (pos !== -1) {
              // ProseMirror positions need to account for document structure
              // Find actual position in the document
              const { state } = editor;
              let foundPos = -1;
              let foundEnd = -1;
              
              state.doc.descendants((node: any, nodePos: number) => {
                if (foundPos !== -1) return false; // Stop if found
                if (node.isText) {
                  const nodeText = node.text || '';
                  const idx = nodeText.indexOf(targetText);
                  if (idx !== -1) {
                    foundPos = nodePos + idx;
                    foundEnd = foundPos + targetText.length;
                    return false;
                  }
                }
                return true;
              });
              
              if (foundPos !== -1 && foundEnd !== -1) {
                editor.chain()
                  .setTextSelection({ from: foundPos, to: foundEnd })
                  .setMark('comment', { commentId: commentId, commentType: commentData.type })
                  .run();
                console.log(`[AIPanel] Applied comment mark for: "${targetText.substring(0, 30)}..."`);
              }
            }
          }
        }
        
        // Reset selection after applying marks
        if (editor) {
          editor.commands.setTextSelection(0);
        }
        
        console.log(`[AIPanel] Added ${storyCraftComments.length} inline comments`);
      }
      
      // Extract Themes and Motifs
      setExtractionProgress('Extracting themes and motifs...');
      const existingThemes = book.extracted.themesAndMotifs;
      const themesResult = await openAIService.extractThemesAndMotifs(
        chapterText,
        activeChapter.id,
        activeChapter.title,
        existingThemes
      );
      if (themesResult) {
        // Merge new themes with existing
        const mergedThemes = [...(existingThemes?.themes || [])];
        for (const newTheme of themesResult.themes) {
          const existing = mergedThemes.find(t => t.name.toLowerCase() === newTheme.name.toLowerCase());
          if (existing) {
            // Update existing theme with new chapter reference
            if (!existing.chapterAppearances.some(c => c.chapterId === activeChapter.id)) {
              existing.chapterAppearances.push({
                chapterId: activeChapter.id,
                chapterTitle: activeChapter.title,
                manifestation: newTheme.manifestation,
              });
            }
            if (themesResult.evolutionNotes) {
              existing.evolutionNotes = themesResult.evolutionNotes;
            }
          } else {
            // Add new theme
            mergedThemes.push({
              id: `theme-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: newTheme.name,
              description: newTheme.description,
              type: newTheme.type,
              chapterAppearances: [{
                chapterId: activeChapter.id,
                chapterTitle: activeChapter.title,
                manifestation: newTheme.manifestation,
              }],
              evolutionNotes: themesResult.evolutionNotes || '',
            });
          }
        }
        
        // Merge motifs
        const mergedMotifs = [...(existingThemes?.motifs || [])];
        for (const newMotif of themesResult.motifs) {
          const existing = mergedMotifs.find(m => m.name.toLowerCase() === newMotif.name.toLowerCase());
          if (existing) {
            if (!existing.chapterAppearances.some(c => c.chapterId === activeChapter.id)) {
              existing.chapterAppearances.push({
                chapterId: activeChapter.id,
                chapterTitle: activeChapter.title,
                context: newMotif.context,
              });
            }
          } else {
            mergedMotifs.push({
              id: `motif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: newMotif.name,
              description: newMotif.description,
              chapterAppearances: [{
                chapterId: activeChapter.id,
                chapterTitle: activeChapter.title,
                context: newMotif.context,
              }],
            });
          }
        }
        
        // Merge symbols
        const mergedSymbols = [...(existingThemes?.symbols || [])];
        for (const newSymbol of themesResult.symbols) {
          const existing = mergedSymbols.find(s => s.name.toLowerCase() === newSymbol.name.toLowerCase());
          if (existing) {
            if (!existing.chapterAppearances.some(c => c.chapterId === activeChapter.id)) {
              existing.chapterAppearances.push({
                chapterId: activeChapter.id,
                chapterTitle: activeChapter.title,
                context: newSymbol.context,
              });
            }
          } else {
            mergedSymbols.push({
              id: `symbol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: newSymbol.name,
              meaning: newSymbol.meaning,
              chapterAppearances: [{
                chapterId: activeChapter.id,
                chapterTitle: activeChapter.title,
                context: newSymbol.context,
              }],
            });
          }
        }
        
        updateThemesAndMotifs({
          themes: mergedThemes,
          motifs: mergedMotifs,
          symbols: mergedSymbols,
        });
      }
      
      setExtractionProgress(null);
    } catch (error) {
      console.error('Extraction failed:', error);
      setExtractionProgress(null);
      setStoryCraftRunningChapterId(null);
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyzeGrammar = async () => {
    if (!activeChapter || !isConfigured) return;
    
    setAnalyzing(true);
    try {
      const suggestions = await analyzeGrammar(activeChapter);
      setSuggestions(suggestions);
    } finally {
      setAnalyzing(false);
    }
  };

  // Format document with standard book formatting and book font settings
  const handleFormatDocument = () => {
    console.log('[Format] Starting format...', { activeChapter: !!activeChapter, activeChapterId });
    
    if (!activeChapter || !activeChapterId) {
      alert('No chapter selected. Please select a chapter first.');
      return;
    }
    
    setIsFormatting(true);
    
    try {
      // Get the TipTap editor instance
      const editor = (window as any).__tiptapEditor;
      if (!editor) {
        console.error('[Format] Editor not found');
        alert('Editor not found. Please make sure you are viewing a chapter.');
        return;
      }

      console.log('[Format] ========== FORMAT START ==========');
      
      // Get font settings from book settings
      const bodyFont = book.settings.bodyFont || book.settings.defaultFont || 'Carlito';
      const bodyFontSize = book.settings.bodyFontSize || book.settings.defaultFontSize || 12;
      const titleFont = book.settings.titleFont || 'Carlito';
      const titleFontSize = book.settings.titleFontSize || 24;
      
      console.log('[Format] Applying fonts - Body:', bodyFont, bodyFontSize, '/ Title:', titleFont, titleFontSize);
      
      // ========== STEP 1: Split paragraphs at newlines and hardBreaks ==========
      // Get current content as JSON and process it
      const content = editor.getJSON();
      let splitCount = 0;
      
      // Helper to check if paragraph contains hardBreak or newline characters
      const hasBreaks = (paragraph: any): boolean => {
        if (!paragraph.content) return false;
        
        for (const node of paragraph.content) {
          if (node.type === 'hardBreak') return true;
          if (node.type === 'text' && node.text && node.text.includes('\n')) return true;
        }
        return false;
      };
      
      // Helper to split a paragraph node at hardBreaks and newlines
      const splitParagraph = (paragraph: any): any[] => {
        if (!paragraph.content || !hasBreaks(paragraph)) {
          return [paragraph];
        }
        
        const newParagraphs: any[] = [];
        let currentContent: any[] = [];
        
        for (const node of paragraph.content) {
          if (node.type === 'hardBreak') {
            // End current paragraph and start a new one
            if (currentContent.length > 0) {
              newParagraphs.push({
                type: 'paragraph',
                content: currentContent
              });
              currentContent = [];
            }
          } else if (node.type === 'text' && node.text) {
            // Check for newlines in text
            if (node.text.includes('\n')) {
              const parts = node.text.split('\n');
              for (let i = 0; i < parts.length; i++) {
                const part = parts[i].trim();
                if (part.length > 0) {
                  currentContent.push({
                    type: 'text',
                    text: part,
                    marks: node.marks // Preserve any marks
                  });
                }
                // If not the last part, end this paragraph
                if (i < parts.length - 1 && currentContent.length > 0) {
                  newParagraphs.push({
                    type: 'paragraph',
                    content: currentContent
                  });
                  currentContent = [];
                }
              }
            } else {
              currentContent.push(node);
            }
          } else {
            currentContent.push(node);
          }
        }
        
        // Don't forget the last paragraph
        if (currentContent.length > 0) {
          newParagraphs.push({
            type: 'paragraph',
            content: currentContent
          });
        }
        
        // Count how many new paragraphs we created (minus the original)
        if (newParagraphs.length > 1) {
          splitCount += newParagraphs.length - 1;
        }
        
        return newParagraphs.length > 0 ? newParagraphs : [paragraph];
      };
      
      // Process all content nodes
      const processedContent: any[] = [];
      if (content.content) {
        for (const node of content.content) {
          if (node.type === 'paragraph') {
            const splitParagraphs = splitParagraph(node);
            processedContent.push(...splitParagraphs);
          } else {
            processedContent.push(node);
          }
        }
      }
      
      console.log('[Format] Split paragraphs, created', splitCount, 'new paragraphs');
      
      // ========== STEP 1.5: Remove extra empty paragraphs ==========
      let removedCount = 0;
      const cleanedContent: any[] = [];
      let previousWasHeading = false;
      let isFirstParagraph = true;
      
      for (const node of processedContent) {
        if (node.type === 'paragraph') {
          // Check if paragraph is empty
          const isEmpty = isNodeEmpty(node as TipTapNode);
          
          if (isEmpty) {
            removedCount++;
            continue; // Skip empty paragraphs
          }
          
          // Non-empty paragraph - keep it
          cleanedContent.push(node);
          previousWasHeading = false;
          isFirstParagraph = false;
        } else if (node.type === 'heading') {
          cleanedContent.push(node);
          previousWasHeading = true;
        } else if (node.type === 'hardBreak') {
          // Skip standalone hardBreaks between paragraphs
          removedCount++;
          continue;
        } else {
          cleanedContent.push(node);
          previousWasHeading = false;
        }
      }
      
      console.log('[Format] Removed', removedCount, 'empty paragraphs/line breaks');
      
      // ========== STEP 1.6: Normalize quotes and apostrophes to straight ' and " ==========
      const docWithNormalizedQuotes = normalizeQuotesInTipTapContent({ type: 'doc', content: cleanedContent });
      
      // Set the cleaned content back to the editor
      editor.commands.setContent(docWithNormalizedQuotes);
      
      // ========== STEP 2: Apply fonts ==========
      // Apply body font to all content
      editor.chain()
        .selectAll()
        .setFontFamily(bodyFont)
        .run();
      
      // Apply font size
      editor.chain()
        .setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })
        .setMark('textStyle', { fontSize: `${bodyFontSize}pt` })
        .run();
      
      // ========== STEP 3: Apply title font to headings ==========
      const headingPositions: { from: number; to: number; level: number }[] = [];
      editor.state.doc.descendants((node: { type: { name: string }; nodeSize: number; attrs: { level?: number } }, pos: number) => {
        if (node.type.name === 'heading') {
          headingPositions.push({
            from: pos,
            to: pos + node.nodeSize,
            level: node.attrs.level || 1
          });
        }
      });
      
      headingPositions.forEach(({ from, to, level }) => {
        let headingFontSize = titleFontSize;
        if (level === 2) headingFontSize = Math.round(titleFontSize * 0.85);
        else if (level === 3) headingFontSize = Math.round(titleFontSize * 0.75);
        else if (level >= 4) headingFontSize = Math.round(titleFontSize * 0.65);
        
        editor.chain()
          .setTextSelection({ from: from + 1, to: to - 1 })
          .setFontFamily(titleFont)
          .setMark('textStyle', { fontSize: `${headingFontSize}pt` })
          .run();
      });
      
      // Reset selection
      editor.commands.setTextSelection(0);
      
      // Get the updated content and save to store
      const updatedContent = editor.getJSON();
      updateChapterContent(activeChapterId, updatedContent as TipTapContent);
      
      console.log('[Format] ========== FORMAT END ==========');
      console.log(`[Format] Complete: ${splitCount} paragraphs split, ${removedCount} empty lines removed, quotes normalized, fonts applied`);
      
    } finally {
      setIsFormatting(false);
    }
  };

  // Listen for Format Document shortcut/menu (triggered from App)
  const formatDocumentRef = useRef(handleFormatDocument);
  formatDocumentRef.current = handleFormatDocument;
  useEffect(() => {
    const handler = () => formatDocumentRef.current?.();
    window.addEventListener('storybook:format-document', handler);
    return () => window.removeEventListener('storybook:format-document', handler);
  }, []);

  // Generate illustration from chapter (and optional text at cursor)
  const handleGenerateIllustration = async () => {
    if (!activeChapter || !isConfigured) return;
    const chapterText = extractTextFromContent(activeChapter.content);
    if (!chapterText.trim()) {
      alert('This chapter has no text. Add some content first.');
      return;
    }
    setIsGeneratingIllustration(true);
    setGeneratedIllustrationDataUrl(null);
    try {
      let contextAroundCursor: string | undefined;
      const editor = (window as any).__tiptapEditor;
      if (editor) {
        const { from, to } = editor.state.selection;
        const fullText = editor.getText();
        if (from !== to && fullText) {
          contextAroundCursor = fullText.slice(Math.max(0, from - 2000), Math.min(fullText.length, to + 2000));
        } else if (fullText) {
          const contextLen = 600;
          contextAroundCursor = fullText.slice(Math.max(0, from - contextLen), Math.min(fullText.length, from + contextLen));
        }
      }
      const dataUrl = await openAIService.generateChapterIllustration(chapterText, contextAroundCursor);
      setGeneratedIllustrationDataUrl(dataUrl);
    } catch (err) {
      console.error('[AIPanel] Illustration generation failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate illustration.');
    } finally {
      setIsGeneratingIllustration(false);
    }
  };

  const handleInsertIllustration = () => {
    if (!generatedIllustrationDataUrl) return;
    const editor = (window as any).__tiptapEditor;
    if (!editor) {
      alert('Editor not available. Focus the chapter editor and try again.');
      return;
    }
    try {
      editor.chain().focus().setImage({ src: generatedIllustrationDataUrl }).run();
      setGeneratedIllustrationDataUrl(null);
    } catch (e) {
      console.error('[AIPanel] Insert illustration failed:', e);
      alert('Failed to insert image.');
    }
  };

  // Process all chapters - extract and format each one
  const handleProcessAllChapters = async () => {
    if (!isConfigured || book.chapters.length === 0) return;
    
    const confirmMsg = `This will process all ${book.chapters.length} chapters:\n\n` +
      `• Extract characters, locations, and timeline\n` +
      `• Generate chapter summaries\n` +
      `• Analyze story craft & create improvement checklists\n` +
      `• Extract themes, motifs, and symbols\n` +
      `• Apply standard book formatting\n\n` +
      `This may take several minutes. Continue?`;
    
    if (!confirm(confirmMsg)) return;
    
    setIsBatchProcessing(true);
    
    try {
      const totalChapters = book.chapters.length;
      
      // Get font settings
      const formatSettings: FormatSettings = {
        titleFont: book.settings.titleFont || 'Carlito',
        titleFontSize: book.settings.titleFontSize || 24,
        bodyFont: book.settings.bodyFont || book.settings.defaultFont || 'Carlito',
        bodyFontSize: book.settings.bodyFontSize || book.settings.defaultFontSize || 12,
      };
      
      for (let i = 0; i < totalChapters; i++) {
        const chapter = book.chapters[i];
        setBatchProgress({ 
          current: i + 1, 
          total: totalChapters, 
          chapter: chapter.title 
        });
        
        console.log(`Processing chapter ${i + 1}/${totalChapters}: ${chapter.title}`);

        // 1. Format the chapter content (chapter stays in Story Craft list; we replace feedback when done)
        try {
          const formattedContent = formatBookContent(chapter.content as TipTapNode, formatSettings);
          updateChapterContent(chapter.id, formattedContent as TipTapContent);
        } catch (err) {
          console.error(`Failed to format chapter ${chapter.title}:`, err);
        }
        
        // 2. Extract characters
        try {
          await extractCharacters(chapter);
        } catch (err) {
          console.error(`Failed to extract characters from ${chapter.title}:`, err);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 3. Extract locations
        try {
          await extractLocations(chapter);
        } catch (err) {
          console.error(`Failed to extract locations from ${chapter.title}:`, err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 4. Extract timeline
        try {
          await extractTimeline(chapter);
        } catch (err) {
          console.error(`Failed to extract timeline from ${chapter.title}:`, err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 5. Generate summary
        try {
          const summary = await summarizeChapter(chapter);
          if (summary) {
            addSummary(summary);
          }
        } catch (err) {
          console.error(`Failed to summarize ${chapter.title}:`, err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 6. Extract Story Craft Feedback with Promises Tracking
        try {
          setStoryCraftRunningChapterId(chapter.id);
          // If chapter has no story craft feedback yet, add a placeholder so it stays visible in the list
          const existingChapterFeedback = getStoryCraftFeedback(chapter.id);
          if (!existingChapterFeedback) {
            const placeholder: StoryCraftChapterFeedback = {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              assessment: {
                plotProgression: { score: 0, notes: '' },
                characterDevelopment: { score: 0, notes: '' },
                themeReinforcement: { score: 0, notes: '' },
                pacing: { score: 0, notes: '' },
                conflictTension: { score: 0, notes: '' },
                hookEnding: { score: 0, notes: '' },
                overallNotes: '',
              },
              checklist: [],
              summary: 'Analyzing…',
              generatedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            };
            replaceStoryCraftFeedback(chapter.id, placeholder);
          }
          const chapterText = extractTextFromContent(chapter.content);
          const existingThemes = book.extracted.themesAndMotifs;
          const themesContext = existingThemes?.themes.map(t => t.name).join(', ');
          
          // Get all promises from previous chapters for this chapter to potentially resolve
          const previousPromises = getAllPromisesMade(chapter.order);
          
          let feedback;
          try {
            const songsContext = (book.songs ?? []).length > 0
              ? (book.songs ?? []).map(s => {
                  const chars = s.characters?.length ? ` Characters: ${s.characters.join(', ')}` : '';
                  const inst = s.instruments?.length ? ` Instruments: ${s.instruments.join(', ')}` : '';
                  const style = s.style ? ` Style: ${s.style}` : '';
                  const genre = s.genre ? ` Genre: ${s.genre}` : '';
                  const tempo = s.tempo ? ` Tempo: ${s.tempo}` : '';
                  const key = s.key ? ` Key: ${s.key}` : '';
                  const desc = s.description ? ` ${s.description}` : '';
                  const lyricsPart = s.lyrics ? ` Lyrics: ${s.lyrics.replace(/\n/g, ' | ')}` : '';
                  return `${s.title}:${desc}${lyricsPart}${style}${genre}${chars}${tempo}${key}${inst}`;
                }).join('\n')
              : undefined;
            feedback = await openAIService.extractStoryCraftFeedback(
              chapterText,
              chapter.id,
              chapter.title,
              { 
                themes: themesContext,
                previousPromises: previousPromises.length > 0 ? previousPromises : undefined,
                bookSettings: book.settings.bookContext,
                bookOutline: outlineContentToPlainText(book.outline?.content),
                songs: songsContext,
              }
            );
          } catch (err) {
            console.error(`Failed to extract story craft feedback from ${chapter.title}:`, err);
            feedback = null;
          }
          
          if (feedback) {
            const storyCraftFeedback: StoryCraftChapterFeedback = {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              assessment: feedback.assessment,
              checklist: feedback.checklist.map(item => ({
                id: generateId(),
                category: item.category as any,
                suggestion: item.suggestion,
                isCompleted: false,
                addedAt: new Date().toISOString(),
              })),
              summary: feedback.summary,
              promisesMade: feedback.promisesMade?.map(p => ({
                id: generateId(),
                type: p.type,
                description: p.description,
                context: p.context,
                chapterId: chapter.id,
                chapterTitle: chapter.title,
              })),
              promisesKept: feedback.promisesKept?.map(p => ({
                promiseId: p.promiseId,
                promiseDescription: p.promiseDescription,
                howKept: p.howKept,
                chapterWherePromised: p.chapterWherePromised,
                chapterTitleWherePromised: p.chapterTitleWherePromised,
              })),
              generatedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            };
            replaceStoryCraftFeedback(chapter.id, storyCraftFeedback);
          } else if (!existingChapterFeedback) {
            // API failed and we had added a placeholder – update so the chapter stays visible with Re-run
            const failedPlaceholder: StoryCraftChapterFeedback = {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              assessment: {
                plotProgression: { score: 0, notes: '' },
                characterDevelopment: { score: 0, notes: '' },
                themeReinforcement: { score: 0, notes: '' },
                pacing: { score: 0, notes: '' },
                conflictTension: { score: 0, notes: '' },
                hookEnding: { score: 0, notes: '' },
                overallNotes: '',
              },
              checklist: [],
              summary: 'Analysis failed. Click Re-run in Story Craft to try again.',
              generatedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            };
            replaceStoryCraftFeedback(chapter.id, failedPlaceholder);
          }
          setStoryCraftRunningChapterId(null);
        } catch (err) {
          console.error(`Failed to extract story craft feedback from ${chapter.title}:`, err);
          setStoryCraftRunningChapterId(null);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 7. Extract Themes and Motifs
        try {
          const chapterText = extractTextFromContent(chapter.content);
          const existingThemes = book.extracted.themesAndMotifs;
          
          const themesData = await openAIService.extractThemesAndMotifs(
            chapterText,
            chapter.id,
            chapter.title,
            existingThemes
          );
          
          if (themesData) {
            // Add/update themes
            for (const theme of themesData.themes) {
              addOrUpdateTheme({
                name: theme.name,
                type: theme.type,
                description: theme.description,
                chapterAppearances: [{
                  chapterId: chapter.id,
                  chapterTitle: chapter.title,
                  manifestation: theme.manifestation,
                }],
                evolutionNotes: themesData.evolutionNotes || '',
              });
            }
            
            // Add/update motifs
            for (const motif of themesData.motifs) {
              addOrUpdateMotif({
                name: motif.name,
                description: motif.description,
                chapterAppearances: [{
                  chapterId: chapter.id,
                  chapterTitle: chapter.title,
                  context: motif.context,
                }],
              });
            }
            
            // Add/update symbols
            for (const symbol of themesData.symbols) {
              addOrUpdateSymbol({
                name: symbol.name,
                meaning: symbol.meaning,
                chapterAppearances: [{
                  chapterId: chapter.id,
                  chapterTitle: chapter.title,
                  context: symbol.context,
                }],
              });
            }
          }
        } catch (err) {
          console.error(`Failed to extract themes/motifs from ${chapter.title}:`, err);
        }
        
        // Delay between chapters to avoid rate limiting
        if (i < totalChapters - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      alert(`Successfully processed all ${totalChapters} chapters!\n\nExtracted:\n• Characters, Locations, Timeline\n• Chapter Summaries\n• Story Craft Feedback\n• Themes & Motifs`);
      
    } catch (error) {
      console.error('Batch processing failed:', error);
      alert('Batch processing encountered an error. Check the console for details.');
    } finally {
      setIsBatchProcessing(false);
      setBatchProgress(null);
    }
  };

  // Analyze plot errors across entire book
  const handleAnalyzePlotErrors = async () => {
    if (!isConfigured || book.chapters.length === 0) return;

    setIsAnalyzingPlot(true);
    setPlotAnalysisProgress('Starting analysis...');

    try {
      const sortedChapters = [...book.chapters].sort((a, b) => a.order - b.order);
      
      const analysis = await plotAnalysisService.analyzeBookPlotErrors(
        book.id,
        sortedChapters,
        book.extracted.summaries || [],
        book.extracted.storyCraftFeedback || [],
        book.settings.bookContext,
        book.extracted.characters.map(c => ({
          name: c.name,
          aliases: c.aliases,
        })),
        book.extracted.locations.map(l => ({
          name: l.name,
          type: l.type,
        })),
        (progress) => {
          setPlotAnalysisProgress(progress.status);
        }
      );

      // Save to store
      setPlotErrorAnalysis(analysis);

      // Generate markdown outline
      const markdownOutline = plotAnalysisService.generateOutline(analysis);

      // Update plot analysis document tab
      const plotAnalysisTab = book.documentTabs.find(t => t.tabType === 'plotanalysis');
      if (plotAnalysisTab) {
        // Convert markdown to TipTap content (simple conversion)
        const lines = markdownOutline.split('\n');
        const content: TipTapContent = {
          type: 'doc',
          content: lines.map(line => {
            if (line.startsWith('# ')) {
              return {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: line.substring(2) }],
              };
            } else if (line.startsWith('## ')) {
              return {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: line.substring(3) }],
              };
            } else if (line.startsWith('### ')) {
              return {
                type: 'heading',
                attrs: { level: 3 },
                content: [{ type: 'text', text: line.substring(4) }],
              };
            } else if (line.trim() === '') {
              return { type: 'paragraph', content: [] };
            } else {
              return {
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
              };
            }
          }).filter(node => node.type !== 'paragraph' || (node.content && node.content.length > 0)),
        };
        updateDocumentTabContent(plotAnalysisTab.id, content);
      }

      setPlotAnalysisProgress(null);
    } catch (error) {
      console.error('Plot error analysis failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Full error:', error);
      setPlotAnalysisProgress(`Error: ${errorMessage}`);
      // Show error for longer so user can read it
      setTimeout(() => {
        setPlotAnalysisProgress(null);
        setIsAnalyzingPlot(false);
      }, 10000);
      return; // Don't set isAnalyzingPlot to false here, let timeout do it
    } finally {
      // Only set to false if we didn't already in the catch block
      if (plotAnalysisProgress === null || !plotAnalysisProgress.startsWith('Error:')) {
        setIsAnalyzingPlot(false);
      }
    }
  };

  const currentSummary = activeChapter 
    ? ai.summaries.get(activeChapter.id) 
    : undefined;

  return (
    <>
      <div className="ai-panel-content">
        {!isConfigured ? (
          <div className="empty-state">
            <AlertCircleIcon />
            <p className="empty-state-text" style={{ marginBottom: '4px' }}>
              Please configure your OpenAI API key in Settings to use AI features.
            </p>
            <p className="text-muted" style={{ fontSize: '10px' }}>
              <AlertCircleIcon /> Not configured
            </p>
          </div>
        ) : (
          <>
            {/* View is selected via panel header Actions dropdown */}

            {activeTab === 'actions' && (
              <>
                {!hasDocumentForAI ? (
                  <div className="empty-state">
                    <FileTextIcon />
                    <p className="empty-state-text">
                      Select a chapter to use AI features.
                    </p>
                  </div>
                ) : isOutlinerActive ? (
                  <div className="empty-state">
                    <FileTextIcon />
                    <p className="empty-state-text">
                      Use the <strong>Chat</strong> tab to discuss and edit your outline.
                    </p>
                    <button
                      type="button"
                      className="ai-btn ai-btn-primary"
                      style={{ marginTop: 12 }}
                      onClick={() => setAIPanelTab('chat')}
                    >
                      Open Chat
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Main Actions */}
                    <div className="ai-section">
                      <div className="ai-section-title">Extract & Analyze</div>
                      <div className="ai-action-row">
                        <button 
                          className="ai-btn ai-btn-primary" 
                          onClick={handleExtractAll}
                          disabled={ai.isExtracting || ai.storyCraftRunningChapterId === activeChapter?.id}
                        >
                          {ai.isExtracting ? (
                            <>
                              <div className="spinner" />
                              <span>{extractionProgress || 'Extracting...'}</span>
                            </>
                          ) : (
                            <>
                              <ExtractIcon />
                              <span>Extract All</span>
                            </>
                          )}
                        </button>
                        <button 
                          className="ai-btn" 
                          onClick={handleStoryCraftOnly}
                          disabled={ai.isExtracting || ai.storyCraftRunningChapterId === activeChapter?.id}
                          title="Run Story Craft analysis only (scores, checklist, summary, promises)"
                        >
                          {ai.storyCraftRunningChapterId === activeChapter?.id ? (
                            <>
                              <div className="spinner" />
                              <span>Assessing story craft...</span>
                            </>
                          ) : (
                            <>
                              <StoryCraftIcon />
                              <span>Story Craft</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="ai-help-text">
                        Extract All: characters, locations, timeline, summary, Story Craft, and themes. Story Craft: analysis only (scores, checklist, promises).
                      </p>
                    </div>

                    {/* Grammar Check */}
                    <div className="ai-section">
                      <div className="ai-section-title">Writing Quality</div>
                      <button 
                        className="ai-btn" 
                        onClick={handleAnalyzeGrammar}
                        disabled={ai.isAnalyzing}
                      >
                        {ai.isAnalyzing ? (
                          <div className="spinner" />
                        ) : (
                          <CheckCircleIcon />
                        )}
                        <span>Check Grammar & Style</span>
                      </button>
                    </div>

                    {/* Format Document */}
                    <div className="ai-section">
                      <div className="ai-section-title">Formatting</div>
                      <button 
                        className="ai-btn" 
                        onClick={handleFormatDocument}
                        disabled={isFormatting}
                        title="Apply standard book formatting: tab indentation for paragraphs, remove excess whitespace"
                      >
                        {isFormatting ? (
                          <div className="spinner" />
                        ) : (
                          <FormatIcon />
                        )}
                        <span>Format Document</span>
                      </button>
                      <p className="ai-help-text">
                        Applies book formatting using fonts from Settings: 
                        titles use title font, body uses body font. Also applies 
                        tab indents and removes excess whitespace.
                      </p>
                    </div>

                    {/* Generate Illustration */}
                    <div className="ai-section">
                      <div className="ai-section-title">Illustration</div>
                      <button
                        className="ai-btn"
                        onClick={handleGenerateIllustration}
                        disabled={isGeneratingIllustration}
                        title="Generate a pen-on-paper style illustration from the chapter (uses text near cursor if available)"
                      >
                        {isGeneratingIllustration ? (
                          <>
                            <div className="spinner" />
                            <span>Generating…</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon />
                            <span>Generate illustration</span>
                          </>
                        )}
                      </button>
                      <p className="ai-help-text">
                        Creates a detailed pen-and-ink style illustration from this chapter.
                        If your cursor is in the editor, the scene near the cursor is preferred.
                        If something is described as being drawn in the chapter, that is used.
                      </p>
                      {generatedIllustrationDataUrl && (
                        <div className="ai-illustration-preview">
                          <img src={generatedIllustrationDataUrl} alt="Generated illustration" />
                          <div className="ai-illustration-actions">
                            <button
                              type="button"
                              className="ai-btn ai-btn-primary"
                              onClick={handleInsertIllustration}
                            >
                              Insert at cursor
                            </button>
                            <button
                              type="button"
                              className="ai-btn"
                              onClick={() => setGeneratedIllustrationDataUrl(null)}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Process All Chapters */}
                    <div className="ai-section">
                      <div className="ai-section-title">Batch Processing</div>
                      <button 
                        className="ai-btn ai-btn-secondary" 
                        onClick={handleProcessAllChapters}
                        disabled={isBatchProcessing || book.chapters.length === 0}
                        title="Process all chapters: extract, summarize, and format"
                      >
                        {isBatchProcessing ? (
                          <>
                            <div className="spinner" />
                            <span>
                              {batchProgress 
                                ? `${batchProgress.current}/${batchProgress.total}: ${batchProgress.chapter}`
                                : 'Processing...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <SparklesIcon />
                            <span>Process All Chapters</span>
                          </>
                        )}
                      </button>
                      <p className="ai-help-text">
                        Processes all {book.chapters.length} chapters: 
                        formats text, extracts entities, generates summaries,
                        analyzes story craft, and tracks themes/motifs.
                      </p>
                    </div>

                    {/* Plot Error Analysis */}
                    <div className="ai-section">
                      <div className="ai-section-title">Plot Analysis</div>
                      <button 
                        className="ai-btn ai-btn-secondary" 
                        onClick={handleAnalyzePlotErrors}
                        disabled={isAnalyzingPlot || book.chapters.length === 0 || !isConfigured}
                        title="Analyze entire book for plot errors, inconsistencies, and narrative problems"
                      >
                        {isAnalyzingPlot ? (
                          <>
                            <div className="spinner" />
                            <span>{plotAnalysisProgress || 'Analyzing plot...'}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircleIcon />
                            <span>Analyze Plot Errors</span>
                          </>
                        )}
                      </button>
                      <p className="ai-help-text">
                        Comprehensive plot error analysis across all chapters: 
                        identifies plot holes, timeline mistakes, character inconsistencies,
                        name mismatches, and other narrative problems. Results appear in Plot Analysis tab.
                      </p>
                    </div>

                    {/* Summary Display */}
                    {currentSummary && (
                      <div className="ai-section">
                        <div className="ai-section-title">Chapter Summary</div>
                        <div className="ai-summary-box">
                          <p>{currentSummary.summary}</p>
                          {currentSummary.keyPoints.length > 0 && (
                            <>
                              <div className="ai-summary-divider">Key Points</div>
                              <ul className="ai-key-points">
                                {currentSummary.keyPoints.map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suggestions Display */}
                    {ai.suggestions.length > 0 && (
                      <div className="ai-section">
                        <div className="ai-section-title">
                          Suggestions ({ai.suggestions.length})
                        </div>
                        <ul className="suggestion-list">
                          {ai.suggestions.map((suggestion) => (
                            <li 
                              key={suggestion.id} 
                              className={`suggestion-item ${suggestion.severity}`}
                            >
                              <div className="suggestion-item-type">
                                {suggestion.type}
                              </div>
                              <div className="suggestion-item-message">
                                {suggestion.message}
                              </div>
                              {suggestion.suggestion && (
                                <div className="suggestion-item-fix">
                                  Suggestion: {suggestion.suggestion}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="ai-section">
                      <div className="ai-section-title">Extracted Data</div>
                      <div className="ai-stats">
                        <div className="ai-stat">
                          <span className="ai-stat-value">{book.extracted.characters.length}</span>
                          <span className="ai-stat-label">Characters</span>
                        </div>
                        <div className="ai-stat">
                          <span className="ai-stat-value">{book.extracted.locations.length}</span>
                          <span className="ai-stat-label">Locations</span>
                        </div>
                        <div className="ai-stat">
                          <span className="ai-stat-value">{book.extracted.timeline.length}</span>
                          <span className="ai-stat-label">Events</span>
                        </div>
                        <div className="ai-stat">
                          <span className="ai-stat-value">{ai.summaries.size}</span>
                          <span className="ai-stat-label">Summaries</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === 'chat' && (
              <AIChatBot
                pendingChatMessage={pendingChatMessage}
                onConsumedPendingMessage={() => setPendingChatMessage(null)}
                chatInputPreFill={chatInputPreFill}
                onConsumedChatInputPreFill={() => setChatInputPreFill(null)}
              />
            )}

            {activeTab === 'comments' && (
              <CommentsPanel onSendToChat={handleSendCommentToChat} />
            )}

            {activeTab === 'notes' && (
              <NotesPanel />
            )}
          </>
        )}
      </div>
    </>
  );
};
