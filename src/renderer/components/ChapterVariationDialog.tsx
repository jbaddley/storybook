import React, { useState, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { openAIService, ChangeReport } from '../services/openaiService';
import { databaseService } from '../services/databaseService';
import { 
  generateId, 
  TipTapContent, 
  StoryCraftChecklistItem,
  VariationSettings,
  VariationLengthTarget,
  VariationCreativity,
  VariationType,
  DraftLengthTarget,
  DEFAULT_VARIATION_SETTINGS,
  EMPTY_CHAPTER_THRESHOLD,
  ChapterVariation,
  CHAPTER_PURPOSE_OPTIONS,
} from '../../shared/types';

// Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
    <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/>
    <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5L19 5z"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polyline points="23,4 23,10 17,10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

export type VariationSourceType = 'original' | 'current' | string; // string = variation id

interface ChapterVariationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chapterId: string;
  prefilledSuggestions?: StoryCraftChecklistItem[];
  chatSuggestions?: string; // Recent chat context/suggestions to use for variation
  initialPrompt?: string; // Pre-filled prompt from chat
  /** When opening to create a new variation from an existing one */
  initialSourceVariationId?: string;
}

// Helper to extract text from TipTap content
function extractTextFromContent(content: TipTapContent): string {
  if (!content?.content) return '';
  
  const extractFromNode = (node: any): string => {
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map(extractFromNode).join(node.type === 'paragraph' ? '\n' : '');
    }
    return '';
  };
  
  return content.content.map(extractFromNode).join('\n\n');
}

// Helper to convert text to TipTap content
function textToTipTapContent(text: string): TipTapContent {
  const paragraphs = text.split(/\n\n+/);
  return {
    type: 'doc',
    content: paragraphs.map(para => ({
      type: 'paragraph',
      content: para.trim() ? [{ type: 'text', text: para.trim() }] : [],
    })),
  };
}

// Helper to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const ChapterVariationDialog: React.FC<ChapterVariationDialogProps> = ({
  isOpen,
  onClose,
  chapterId,
  prefilledSuggestions,
  chatSuggestions,
  initialPrompt,
  initialSourceVariationId,
}) => {
  const { book, getChapterById, getSortedChapters, getStoryCraftFeedback, getPlotErrorAnalysis, setChapterVariation, getChapterVariation, getChapterVariations, addChapterVariation, applyVariation, discardVariation } = useBookStore();
  
  const [customPrompt, setCustomPrompt] = useState(initialPrompt || '');
  const [includeStoryCraft, setIncludeStoryCraft] = useState(!!prefilledSuggestions);
  const [includeChatContext, setIncludeChatContext] = useState(!!chatSuggestions);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [changeReport, setChangeReport] = useState<ChangeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'variation' | 'report'>('original');
  /** Source for generation: 'original' | 'current' | variationId */
  const [sourceType, setSourceType] = useState<VariationSourceType>('current');
  const [isSaving, setIsSaving] = useState(false);
  
  // Variation settings
  const [lengthTarget, setLengthTarget] = useState<VariationLengthTarget>(DEFAULT_VARIATION_SETTINGS.lengthTarget);
  const [creativity, setCreativity] = useState<VariationCreativity>(DEFAULT_VARIATION_SETTINGS.creativity);
  const [variationType, setVariationType] = useState<VariationType>(DEFAULT_VARIATION_SETTINGS.variationType);
  const [draftWordCount, setDraftWordCount] = useState<DraftLengthTarget>(DEFAULT_VARIATION_SETTINGS.draftWordCount || 2000);
  const [includeAdjacentChapters, setIncludeAdjacentChapters] = useState<boolean>(DEFAULT_VARIATION_SETTINGS.includeAdjacentChapters ?? true);
  const [includeChapterComments, setIncludeChapterComments] = useState(true);
  
  const chapter = getChapterById(chapterId);
  const storyCraftFeedback = getStoryCraftFeedback(chapterId);
  const existingVariation = getChapterVariation(chapterId);
  const pastVariations = getChapterVariations(chapterId);
  
  // Resolve source text for generation (original = immutable first, current = editor content, or a past variation)
  const getSourceText = (): string => {
    if (!chapter) return '';
    if (sourceType === 'original') {
      return extractTextFromContent(chapter.originalContent ?? chapter.content);
    }
    if (sourceType === 'current') {
      return extractTextFromContent(chapter.content);
    }
    const v = pastVariations.find(x => x.id === sourceType);
    return v ? extractTextFromContent(v.content) : extractTextFromContent(chapter.content);
  };
  
  // Get Story Craft suggestions
  const suggestions = prefilledSuggestions || storyCraftFeedback?.checklist || [];
  const uncompletedSuggestions = suggestions.filter(s => !s.isCompleted);
  
  // Initialize with existing variation if present
  useEffect(() => {
    if (existingVariation) {
      setGeneratedText(extractTextFromContent(existingVariation.content));
      setCustomPrompt(existingVariation.prompt);
      setIncludeStoryCraft(existingVariation.basedOnStoryCraft);
      setChangeReport(existingVariation.changeReport || null);
      setViewMode('variation');
      // Restore settings if they exist
      if (existingVariation.settings) {
        setLengthTarget(existingVariation.settings.lengthTarget);
        setCreativity(existingVariation.settings.creativity);
        setVariationType(existingVariation.settings.variationType);
        if (existingVariation.settings.includeAdjacentChapters !== undefined) {
          setIncludeAdjacentChapters(existingVariation.settings.includeAdjacentChapters);
        }
      }
    } else {
      setGeneratedText('');
      setChangeReport(null);
      setViewMode('original');
      // Reset to defaults
      setLengthTarget(DEFAULT_VARIATION_SETTINGS.lengthTarget);
      setCreativity(DEFAULT_VARIATION_SETTINGS.creativity);
      setVariationType(DEFAULT_VARIATION_SETTINGS.variationType);
    }
  }, [chapterId, existingVariation]);
  
  // Reset when dialog opens with new chapter or chat context
  useEffect(() => {
    if (isOpen) {
      if (prefilledSuggestions) {
        setIncludeStoryCraft(true);
      }
      if (chatSuggestions) {
        setIncludeChatContext(true);
      }
      if (initialPrompt) {
        setCustomPrompt(initialPrompt);
      }
      // Auto-select generate_draft mode for empty chapters (use chapter.wordCount directly)
      if (chapter && chapter.wordCount < EMPTY_CHAPTER_THRESHOLD && !existingVariation) {
        setVariationType('generate_draft');
      }
    }
  }, [isOpen, prefilledSuggestions, chatSuggestions, initialPrompt, chapter, existingVariation]);
  
  // Set initial source when opening with a specific variation to branch from
  useEffect(() => {
    if (isOpen && initialSourceVariationId && pastVariations.some(v => v.id === initialSourceVariationId)) {
      setSourceType(initialSourceVariationId);
    }
  }, [isOpen, initialSourceVariationId, pastVariations]);
  
  if (!isOpen || !chapter) return null;
  
  const originalText = getSourceText(); // Text of the selected source (for display in "original" tab when generating)
  const currentChapterText = extractTextFromContent(chapter.content);
  const originalWordCount = countWords(originalText);
  const variationWordCount = countWords(generatedText);
  
  // Auto-detect empty chapters for draft mode
  const isEmptyChapter = originalWordCount < EMPTY_CHAPTER_THRESHOLD;
  
  // Helper to truncate text from the end (keep last N words)
  const truncateFromEnd = (text: string, maxWords: number): string => {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return '...' + words.slice(-maxWords).join(' ');
  };
  
  // Helper to truncate text from the start (keep first N words)
  const truncateFromStart = (text: string, maxWords: number): string => {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };
  
  // Build context for generation (rich context: timeline, plot arc, known errors, story craft arc)
  const buildBookContext = () => {
    const currentOrder = chapter?.order ?? 0;
    const characters = book.extracted.characters
      .slice(0, 20)
      .map(c => `${c.name}${c.description ? `: ${c.description}` : ''}`)
      .join('\n');

    const locations = book.extracted.locations
      .slice(0, 20)
      .map(l => `${l.name}${l.description ? `: ${l.description}` : ''}`)
      .join('\n');

    const themes = book.extracted.themesAndMotifs?.themes
      .map(t => `${t.name}: ${t.description}`)
      .join('\n');

    const sortedChapters = getSortedChapters();
    const currentChapterIndex = sortedChapters.findIndex(c => c.id === chapterId);

    // Timeline: events in or before this chapter (or all if few)
    let timelineEvents: string | undefined;
    const timeline = book.extracted.timeline || [];
    if (timeline.length > 0) {
      const relevant = timeline.length <= 25
        ? timeline
        : timeline.filter((ev: { chapter: string }) => {
            const ch = getChapterById(ev.chapter);
            return ch && ch.order <= currentOrder;
          });
      const sorted = [...relevant].sort((a: { order: number }, b: { order: number }) => a.order - b.order);
      timelineEvents = sorted
        .map((ev: { chapter: string; date?: string; description: string }) => {
          const ch = getChapterById(ev.chapter);
          const label = ch ? `Ch ${ch.order} (${ch.title})` : 'Ch ?';
          const datePart = ev.date ? ` [${ev.date}]` : '';
          return `${label}:${datePart} ${ev.description}`;
        })
        .join('\n');
    }

    // Plot arc: from plot analysis (chapters before current) or all previous summaries with word cap
    let plotArc: string | undefined;
    const plotAnalysis = getPlotErrorAnalysis();
    if (plotAnalysis?.chapterAnalyses?.length) {
      const previousAnalyses = plotAnalysis.chapterAnalyses
        .filter(ca => ca.order < currentOrder)
        .sort((a, b) => a.order - b.order);
      if (previousAnalyses.length > 0) {
        plotArc = previousAnalyses
          .map(ca => {
            const roles = ca.roles?.length ? `Roles: ${ca.roles.join(', ')}` : '';
            const summary = ca.plotSummary ? ` | Summary: ${ca.plotSummary}` : '';
            return `${ca.order}. ${ca.proposedTitle || ca.chapterTitle} | ${roles}${summary}`;
          })
          .join('\n');
      }
    }
    if (!plotArc && book.extracted.summaries?.length) {
      const previousSummaries = book.extracted.summaries
        .filter(s => {
          const ch = getChapterById(s.chapterId);
          return ch && ch.order < currentOrder;
        })
        .sort((a, b) => {
          const chA = getChapterById(a.chapterId);
          const chB = getChapterById(b.chapterId);
          return (chA?.order ?? 0) - (chB?.order ?? 0);
        });
      const PLOT_ARC_WORD_CAP = 500;
      let wordCount = 0;
      const lines: string[] = [];
      for (const s of previousSummaries) {
        const ch = getChapterById(s.chapterId);
        const line = `${ch?.title || 'Chapter'}: ${s.summary}`;
        const words = countWords(line);
        if (wordCount + words > PLOT_ARC_WORD_CAP) break;
        wordCount += words;
        lines.push(line);
      }
      if (lines.length > 0) plotArc = lines.join('\n\n');
    }

    // Known errors affecting this chapter (do not reinforce)
    let knownErrorsToAvoid: string | undefined;
    if (plotAnalysis?.errors?.length && chapterId) {
      const affecting = plotAnalysis.errors.filter(e =>
        e.affectedChapters && e.affectedChapters.includes(chapterId)
      );
      if (affecting.length > 0) {
        knownErrorsToAvoid = affecting
          .map(e => `• [${e.severity}] ${e.type}: ${e.description}`)
          .join('\n');
      }
    }

    // Story Craft arc: previous chapters' summary + promises (last 5–7)
    let storyCraftArc: string | undefined;
    const scFeedback = book.extracted.storyCraftFeedback || [];
    const previousSC = scFeedback
      .filter(f => {
        const ch = getChapterById(f.chapterId);
        return ch && ch.order < currentOrder;
      })
      .sort((a, b) => {
        const chA = getChapterById(a.chapterId);
        const chB = getChapterById(b.chapterId);
        return (chA?.order ?? 0) - (chB?.order ?? 0);
      })
      .slice(-7);
    if (previousSC.length > 0) {
      storyCraftArc = previousSC
        .map(f => {
          const ch = getChapterById(f.chapterId);
          const title = ch ? `Ch ${ch.order} (${ch.title})` : f.chapterTitle || 'Chapter';
          const summary = f.summary ? ` ${f.summary}` : '';
          const promisesMade = f.promisesMade?.length
            ? ` Promises made: ${f.promisesMade.map((p: { description: string }) => p.description).join('; ')}`
            : '';
          const resolves = f.promisesKept?.length
            ? ` Resolves: ${f.promisesKept.map((p: { promiseDescription: string }) => p.promiseDescription).join('; ')}`
            : '';
          return `${title}:${summary}${promisesMade}${resolves}`;
        })
        .join('\n');
    }

    // Previous chapters summary (last 3) for backward compatibility with prompt
    const previousChaptersSummary = book.extracted.summaries
      .filter(s => {
        const ch = getChapterById(s.chapterId);
        return ch && ch.order < currentOrder;
      })
      .slice(-3)
      .map(s => {
        const ch = getChapterById(s.chapterId);
        return `${ch?.title || 'Chapter'}: ${s.summary}`;
      })
      .join('\n\n');

    const nextChaptersSummary = book.extracted.summaries
      .filter(s => {
        const ch = getChapterById(s.chapterId);
        return ch && ch.order > currentOrder;
      })
      .slice(0, 3)
      .map(s => {
        const ch = getChapterById(s.chapterId);
        return `${ch?.title || 'Chapter'}: ${s.summary}`;
      })
      .join('\n\n');

    const nextChaptersStoryCraft = (book.extracted.storyCraftFeedback || [])
      .filter(f => {
        const ch = getChapterById(f.chapterId);
        return ch && ch.order > currentOrder;
      })
      .slice(0, 2)
      .map(f => {
        const summary = f.summary ? `Summary: ${f.summary}` : '';
        const promisesKept = f.promisesKept?.length
          ? `Resolves: ${f.promisesKept.map(p => p.promiseDescription).join('; ')}`
          : '';
        return [summary, promisesKept].filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');

    const fullNextContext = [nextChaptersSummary, nextChaptersStoryCraft]
      .filter(Boolean)
      .join('\n\n');

    const chatContext = includeChatContext && chatSuggestions ? chatSuggestions : undefined;

    const currentScores = storyCraftFeedback?.assessment ? {
      plotProgression: storyCraftFeedback.assessment.plotProgression?.score,
      characterDevelopment: storyCraftFeedback.assessment.characterDevelopment?.score,
      pacing: storyCraftFeedback.assessment.pacing?.score,
      conflictTension: storyCraftFeedback.assessment.conflictTension?.score,
      hookEnding: storyCraftFeedback.assessment.hookEnding?.score,
      themeReinforcement: storyCraftFeedback.assessment.themeReinforcement?.score,
    } : undefined;

    let previousChapterContent: string | undefined;
    let previousChapterTitle: string | undefined;
    let nextChapterContent: string | undefined;
    let nextChapterTitle: string | undefined;

    if (includeAdjacentChapters) {
      const isDraftMode = variationType === 'generate_draft';
      const prevWordLimit = isDraftMode ? 2000 : 500;
      const nextWordLimit = isDraftMode ? 1500 : 500;
      if (currentChapterIndex > 0) {
        const prevChapter = sortedChapters[currentChapterIndex - 1];
        if (prevChapter) {
          const fullText = extractTextFromContent(prevChapter.content);
          if (fullText && countWords(fullText) > 50) {
            previousChapterContent = truncateFromEnd(fullText, prevWordLimit);
            previousChapterTitle = prevChapter.title;
          }
        }
      }
      if (currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1) {
        const nextChapter = sortedChapters[currentChapterIndex + 1];
        if (nextChapter) {
          const fullText = extractTextFromContent(nextChapter.content);
          if (fullText && countWords(fullText) > 50) {
            nextChapterContent = truncateFromStart(fullText, nextWordLimit);
            nextChapterTitle = nextChapter.title;
          }
        }
      }
    }

    return {
      characters: characters || undefined,
      locations: locations || undefined,
      themes: themes || undefined,
      previousChaptersSummary: previousChaptersSummary || undefined,
      nextChaptersSummary: fullNextContext || undefined,
      chatContext,
      originalWordCount: originalWordCount,
      currentScores,
      bookSettings: book.settings.bookContext,
      previousChapterContent,
      previousChapterTitle,
      nextChapterContent,
      nextChapterTitle,
      chapterComments: includeChapterComments && chapter.comments?.length
        ? chapter.comments
            .filter(c => !c.resolved)
            .map(c => ({
              type: c.type,
              category: c.category || 'general',
              text: c.text,
              targetText: c.targetText,
            }))
        : undefined,
      timelineEvents: timelineEvents || undefined,
      plotArc: plotArc || undefined,
      knownErrorsToAvoid: knownErrorsToAvoid || undefined,
      storyCraftArc: storyCraftArc || undefined,
      chapterPurpose: chapter.purpose
        ? (CHAPTER_PURPOSE_OPTIONS.find(o => o.value === chapter.purpose)?.label ?? chapter.purpose)
        : undefined,
    };
  };
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setChangeReport(null);
    
    try {
      const suggestionsToUse = includeStoryCraft ? uncompletedSuggestions : [];
      const bookContext = buildBookContext();
      
      // Build settings object
      const settings: VariationSettings = {
        lengthTarget,
        creativity,
        variationType,
        draftWordCount: variationType === 'generate_draft' ? draftWordCount : undefined,
        includeAdjacentChapters,
      };
      
      const sourceText = getSourceText();
      const result = await openAIService.generateChapterVariation(
        sourceText,
        chapter.title,
        suggestionsToUse,
        customPrompt,
        bookContext,
        settings
      );
      
      setGeneratedText(result.text);
      setChangeReport(result.changeReport);
      setViewMode('variation');
      
      // Save as pending draft (including settings and source)
      const variation: ChapterVariation = {
        id: generateId(),
        content: textToTipTapContent(result.text),
        generatedAt: new Date().toISOString(),
        prompt: customPrompt,
        basedOnStoryCraft: includeStoryCraft,
        wordCount: countWords(result.text),
        changeReport: result.changeReport,
        settings: settings,
        sourceVariationId: sourceType !== 'original' && sourceType !== 'current' ? sourceType : undefined,
      };
      
      setChapterVariation(chapterId, variation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variation');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleApply = async () => {
    const pending = getChapterVariation(chapterId);
    if (!pending) return;
    setIsSaving(true);
    try {
      await databaseService.addChapterVariation(chapterId, pending);
      applyVariation(chapterId);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToHistory = async () => {
    const pending = getChapterVariation(chapterId);
    if (!pending) return;
    setIsSaving(true);
    try {
      await databaseService.addChapterVariation(chapterId, pending);
      addChapterVariation(chapterId, pending);
      discardVariation(chapterId);
      setGeneratedText('');
      setChangeReport(null);
      setViewMode('original');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDiscard = () => {
    discardVariation(chapterId);
    setGeneratedText('');
    setChangeReport(null);
    setViewMode('original');
  };

  const handleRestoreOriginal = () => {
    const { restoreOriginal } = useBookStore.getState();
    restoreOriginal(chapterId);
    onClose();
  };

  const handleApplyPastVariation = (variationId: string) => {
    applyVariation(chapterId, variationId);
    onClose();
  };

  const handleCreateFromVariation = (variationId: string) => {
    setSourceType(variationId);
    setGeneratedText('');
    setChangeReport(null);
    setViewMode('original');
  };
  
  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="variation-dialog">
        {/* Header */}
        <div className="variation-dialog-header">
          <div className="variation-dialog-title">
            <SparklesIcon />
            <span>Refine Chapter</span>
            <span className="variation-chapter-name">{chapter.title}</span>
          </div>
          <button className="dialog-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        
        {/* Content */}
        <div className="variation-dialog-content">
          {/* Left side - Controls */}
          <div className="variation-controls">
            {/* Empty Chapter Notice */}
            {isEmptyChapter && (
              <div className="variation-notice draft-notice">
                <span className="notice-icon">📝</span>
                <span>This chapter is empty or very short. Use <strong>Generate Draft</strong> to create initial content based on surrounding chapters.</span>
              </div>
            )}

            {/* Variation context readiness: suggest Extract / Plot Analysis when context is sparse */}
            {(() => {
              const totalChapters = book.chapters?.length ?? 0;
              const summariesCount = book.extracted.summaries?.length ?? 0;
              const hasPlotAnalysis = !!getPlotErrorAnalysis();
              const sparseSummaries = totalChapters > 0 && summariesCount < totalChapters / 2;
              const missingPlotAnalysis = totalChapters >= 5 && !hasPlotAnalysis;
              if (!sparseSummaries && !missingPlotAnalysis) return null;
              return (
                <div className="variation-notice context-readiness-notice">
                  <span className="notice-icon">💡</span>
                  <span>
                    For better variations, run <strong>Extract</strong> on key chapters and/or <strong>Plot Analysis</strong> so the AI has full story context.
                  </span>
                </div>
              );
            })()}
            
            {/* Source selector: base new variation on Original | Current | a past variation */}
            <div className="variation-section">
              <h4>Base new variation on</h4>
              <div className="variation-source-selector">
                <label className="variation-source-option">
                  <input
                    type="radio"
                    name="source"
                    checked={sourceType === 'original'}
                    onChange={() => setSourceType('original')}
                    disabled={isGenerating}
                  />
                  <span>Original (first version)</span>
                </label>
                <label className="variation-source-option">
                  <input
                    type="radio"
                    name="source"
                    checked={sourceType === 'current'}
                    onChange={() => setSourceType('current')}
                    disabled={isGenerating}
                  />
                  <span>Current (editor content)</span>
                </label>
                {pastVariations.map((v) => (
                  <label key={v.id} className="variation-source-option">
                    <input
                      type="radio"
                      name="source"
                      checked={sourceType === v.id}
                      onChange={() => setSourceType(v.id)}
                      disabled={isGenerating}
                    />
                    <span>Variation from {new Date(v.generatedAt).toLocaleDateString()} ({v.wordCount} words)</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Variation Type Selector */}
            <div className="variation-section">
              <h4>Mode</h4>
              <div className="variation-type-selector">
                <button
                  className={`variation-type-btn ${variationType === 'generate_draft' ? 'active' : ''} ${isEmptyChapter ? 'recommended' : ''}`}
                  onClick={() => setVariationType('generate_draft')}
                  disabled={isGenerating}
                  title="Generate a new chapter draft from surrounding context"
                >
                  <span className="type-icon">📝</span>
                  <span className="type-label">Generate Draft</span>
                </button>
                <button
                  className={`variation-type-btn ${variationType === 'story_craft' ? 'active' : ''}`}
                  onClick={() => setVariationType('story_craft')}
                  disabled={isGenerating || isEmptyChapter}
                  title={isEmptyChapter ? 'Requires existing content to refine' : 'Improve Story Craft scores'}
                >
                  <span className="type-icon">📊</span>
                  <span className="type-label">Maximize Story Craft</span>
                </button>
                <button
                  className={`variation-type-btn ${variationType === 'fix_errors' ? 'active' : ''}`}
                  onClick={() => setVariationType('fix_errors')}
                  disabled={isGenerating || isEmptyChapter}
                  title={isEmptyChapter ? 'Requires existing content to fix' : 'Fix grammar and errors'}
                >
                  <span className="type-icon">🔧</span>
                  <span className="type-label">Fix Errors</span>
                </button>
                <button
                  className={`variation-type-btn ${variationType === 'add_color' ? 'active' : ''}`}
                  onClick={() => setVariationType('add_color')}
                  disabled={isGenerating || isEmptyChapter}
                  title={isEmptyChapter ? 'Requires existing content to enhance' : 'Add sensory details'}
                >
                  <span className="type-icon">🎨</span>
                  <span className="type-label">Add Color</span>
                </button>
                <button
                  className={`variation-type-btn ${variationType === 'refine_prose' ? 'active' : ''}`}
                  onClick={() => setVariationType('refine_prose')}
                  disabled={isGenerating || isEmptyChapter}
                  title={isEmptyChapter ? 'Requires existing content to refine' : 'Improve prose quality'}
                >
                  <span className="type-icon">✨</span>
                  <span className="type-label">Refine Prose</span>
                </button>
              </div>
            </div>
            
            {/* Draft Word Count (for generate_draft mode) */}
            {variationType === 'generate_draft' && (
              <div className="variation-section">
                <h4>
                  Target Length: <span className="setting-value">{draftWordCount.toLocaleString()} words</span>
                </h4>
                <div className="variation-slider-container">
                  <span className="slider-label">1k</span>
                  <input
                    type="range"
                    min="1000"
                    max="4000"
                    step="500"
                    value={draftWordCount}
                    onChange={(e) => setDraftWordCount(Number(e.target.value) as DraftLengthTarget)}
                    disabled={isGenerating}
                    className="variation-slider"
                  />
                  <span className="slider-label">4k</span>
                </div>
                <div className="slider-ticks">
                  <span>Short</span>
                  <span>Medium</span>
                  <span>Long</span>
                </div>
              </div>
            )}
            
            {/* Length Target Slider (for refinement modes) */}
            {variationType !== 'generate_draft' && (
              <div className="variation-section">
                <h4>
                  Length Target: <span className="setting-value">{lengthTarget}%</span>
                  <span className="setting-description">
                    {lengthTarget < 100 ? ' (condense)' : lengthTarget > 100 ? ' (expand)' : ' (maintain)'}
                  </span>
                </h4>
                <div className="variation-slider-container">
                  <span className="slider-label">80%</span>
                  <input
                    type="range"
                    min="80"
                    max="120"
                    step="5"
                    value={lengthTarget}
                    onChange={(e) => setLengthTarget(Number(e.target.value) as VariationLengthTarget)}
                    disabled={isGenerating}
                    className="variation-slider"
                  />
                  <span className="slider-label">120%</span>
                </div>
                <div className="slider-ticks">
                  <span>Trim</span>
                  <span>Same</span>
                  <span>Expand</span>
                </div>
              </div>
            )}
            
            {/* Creativity Selector */}
            <div className="variation-section">
              <h4>Creativity Level</h4>
              <div className="creativity-selector">
                <button
                  className={`creativity-btn ${creativity === 'strict' ? 'active' : ''}`}
                  onClick={() => setCreativity('strict')}
                  disabled={isGenerating}
                  title="Minimal changes, preserve author's voice exactly"
                >
                  <span className="creativity-label">Strict</span>
                  <span className="creativity-desc">Minimal changes</span>
                </button>
                <button
                  className={`creativity-btn ${creativity === 'moderate' ? 'active' : ''}`}
                  onClick={() => setCreativity('moderate')}
                  disabled={isGenerating}
                  title="Balanced improvements while respecting style"
                >
                  <span className="creativity-label">Moderate</span>
                  <span className="creativity-desc">Balanced</span>
                </button>
                <button
                  className={`creativity-btn ${creativity === 'loose' ? 'active' : ''}`}
                  onClick={() => setCreativity('loose')}
                  disabled={isGenerating}
                  title="More freedom to rephrase and restructure"
                >
                  <span className="creativity-label">Loose</span>
                  <span className="creativity-desc">More freedom</span>
                </button>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="variation-section">
              <h4>Instructions (optional)</h4>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Optional guidance for refinement... (e.g., 'Tighten the dialogue', 'Clarify the opening scene', 'Improve word choice in action sequences')"
                rows={3}
                disabled={isGenerating}
              />
            </div>
            
            {uncompletedSuggestions.length > 0 && variationType === 'story_craft' && (
              <div className="variation-section">
                <label className="variation-checkbox">
                  <input
                    type="checkbox"
                    checked={includeStoryCraft}
                    onChange={(e) => setIncludeStoryCraft(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Include Story Craft suggestions ({uncompletedSuggestions.length} items)</span>
                </label>
                
                {includeStoryCraft && (
                  <div className="variation-suggestions-preview">
                    {uncompletedSuggestions.slice(0, 5).map((s, i) => (
                      <div key={s.id || i} className="suggestion-item-small">
                        <span className="suggestion-category">[{s.category}]</span>
                        <span className="suggestion-text">{s.suggestion}</span>
                      </div>
                    ))}
                    {uncompletedSuggestions.length > 5 && (
                      <div className="suggestion-more">
                        +{uncompletedSuggestions.length - 5} more suggestions
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {chatSuggestions && (
              <div className="variation-section">
                <label className="variation-checkbox chat-context">
                  <input
                    type="checkbox"
                    checked={includeChatContext}
                    onChange={(e) => setIncludeChatContext(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Include AI Chat suggestions</span>
                </label>
                
                {includeChatContext && (
                  <div className="variation-chat-preview">
                    <div className="chat-preview-content">
                      {chatSuggestions.length > 300 
                        ? chatSuggestions.substring(0, 300) + '...' 
                        : chatSuggestions}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Adjacent Chapters Context */}
            <div className="variation-section">
              <label className="variation-checkbox">
                <input
                  type="checkbox"
                  checked={includeAdjacentChapters}
                  onChange={(e) => setIncludeAdjacentChapters(e.target.checked)}
                  disabled={isGenerating}
                />
                <span>Include adjacent chapter content for continuity</span>
              </label>
              <p className="variation-hint-small">
                {variationType === 'generate_draft' 
                  ? 'Includes the ending of the previous chapter and beginning of the next to ensure seamless flow.'
                  : 'Includes portions of surrounding chapters to maintain prose continuity.'}
              </p>
            </div>
            
            {/* Chapter Comments */}
            {(chapter.comments?.length ?? 0) > 0 && (
              <div className="variation-section">
                <label className="variation-checkbox">
                  <input
                    type="checkbox"
                    checked={includeChapterComments}
                    onChange={(e) => setIncludeChapterComments(e.target.checked)}
                    disabled={isGenerating}
                  />
                  <span>Include chapter comments ({chapter.comments!.filter(c => !c.resolved).length} unresolved)</span>
                </label>
                <p className="variation-hint-small">
                  Unresolved comments (suggestions, issues, notes) will be sent to the AI so the variation can address them.
                </p>
              </div>
            )}
            
            {error && (
              <div className="variation-error">
                {error}
              </div>
            )}
            
            <div className="variation-actions">
              <button
                className={`btn-generate ${variationType === 'generate_draft' ? 'draft-mode' : ''}`}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <div className="spinner" />
                    <span>{variationType === 'generate_draft' ? 'Generating...' : 'Refining...'}</span>
                  </>
                ) : generatedText ? (
                  <>
                    <RefreshIcon />
                    <span>{variationType === 'generate_draft' ? 'Regenerate Draft' : 'Refine Again'}</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon />
                    <span>{variationType === 'generate_draft' ? 'Generate Draft' : 'Refine Chapter'}</span>
                  </>
                )}
              </button>
              
              {generatedText && (
                <>
                  <button className="btn-apply" onClick={handleApply} disabled={isSaving}>
                    <CheckIcon />
                    <span>{variationType === 'generate_draft' ? 'Use This Draft' : 'Apply Variation'}</span>
                  </button>
                  <button className="btn-add-history" onClick={handleAddToHistory} disabled={isSaving} title="Add to history without changing editor content">
                    <span>Add to history</span>
                  </button>
                  <button className="btn-discard" onClick={handleDiscard} disabled={isSaving}>
                    <TrashIcon />
                    <span>Discard</span>
                  </button>
                </>
              )}
            </div>
            
            {/* Variations list: Original, Current, past variations */}
            <div className="variation-section variation-list-section">
              <h4>Variations for this chapter</h4>
              <div className="variation-list">
                <div className="variation-list-item variation-original">
                  <div className="variation-list-header">
                    <span className="variation-list-label">Original (first version)</span>
                    <span className="variation-list-meta">{chapter.originalContent ? `${chapter.originalWordCount ?? 0} words` : '—'}</span>
                  </div>
                  <div className="variation-list-actions">
                    <button type="button" className="variation-btn-link" onClick={() => { setSourceType('original'); setViewMode('original'); }}>View</button>
                    <button type="button" className="variation-btn-primary" onClick={handleRestoreOriginal}>Restore to this</button>
                    <button type="button" className="variation-btn-secondary" onClick={() => setSourceType('original')}>Create new from this</button>
                  </div>
                </div>
                <div className="variation-list-item variation-current">
                  <div className="variation-list-header">
                    <span className="variation-list-label">Current (editor)</span>
                    <span className="variation-list-meta">{chapter.wordCount} words</span>
                  </div>
                  <div className="variation-list-actions">
                    <button type="button" className="variation-btn-link" onClick={() => { setViewMode('original'); setSourceType('current'); }}>View</button>
                    <button type="button" className="variation-btn-secondary" onClick={() => setSourceType('current')}>Create new from this</button>
                  </div>
                </div>
                {pastVariations.map((v) => {
                  const summary = ((v.changeReport?.summary ?? v.prompt) ?? '').trim();
                  const summaryShort = summary.slice(0, 50) + (summary.length > 50 ? '…' : '');
                  return (
                  <div key={v.id} className="variation-list-item">
                    <div className="variation-list-header">
                      <span className="variation-list-label">{new Date(v.generatedAt).toLocaleString()}</span>
                      <span className="variation-list-meta">{v.wordCount} words</span>
                    </div>
                    {summaryShort ? <p className="variation-list-summary">{summaryShort}</p> : null}
                    <div className="variation-list-actions">
                      <button type="button" className="variation-btn-link" onClick={() => { setViewMode('variation'); setGeneratedText(extractTextFromContent(v.content)); setChangeReport(v.changeReport ?? null); }}>View</button>
                      <button type="button" className="variation-btn-primary" onClick={() => handleApplyPastVariation(v.id)}>Apply</button>
                      <button type="button" className="variation-btn-secondary" onClick={() => handleCreateFromVariation(v.id)}>Create new from this</button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Right side - Preview */}
          <div className="variation-preview">
            <div className="variation-preview-tabs">
              <button
                className={viewMode === 'original' ? 'active' : ''}
                onClick={() => setViewMode('original')}
              >
                {sourceType === 'original' ? 'Original' : sourceType === 'current' ? 'Current' : 'Source'} ({originalWordCount} words)
              </button>
              <button
                className={viewMode === 'variation' ? 'active' : ''}
                onClick={() => setViewMode('variation')}
                disabled={!generatedText}
              >
                {variationType === 'generate_draft' ? 'Draft' : 'Refined'} {generatedText ? `(${variationWordCount} words)` : ''}
              </button>
              <button
                className={viewMode === 'report' ? 'active' : ''}
                onClick={() => setViewMode('report')}
                disabled={!changeReport}
              >
                Change Report
              </button>
            </div>
            
            <div className="variation-preview-content">
              {viewMode === 'original' ? (
                <div className="variation-text">{originalText}</div>
              ) : viewMode === 'variation' && generatedText ? (
                <div className="variation-text variation-generated">{generatedText}</div>
              ) : viewMode === 'report' && changeReport ? (
                <div className="variation-report">
                  <div className="report-summary">
                    <h4>Summary of Changes</h4>
                    <p>{changeReport.summary}</p>
                    {changeReport.wordCountChange !== 0 && (
                      <p className="word-count-change">
                        Word count: {changeReport.wordCountChange > 0 ? '+' : ''}{changeReport.wordCountChange} words
                      </p>
                    )}
                  </div>
                  
                  {changeReport.changes.length > 0 && (
                    <div className="report-changes">
                      <h4>Specific Changes ({changeReport.changes.length})</h4>
                      <ul>
                        {changeReport.changes.map((change, idx) => (
                          <li key={idx} className="change-item">
                            <span className={`change-category category-${change.category}`}>
                              {change.category}
                            </span>
                            <span className="change-description">{change.description}</span>
                            <span className="change-target">→ {change.scoreTargeted}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {changeReport.preservedElements.length > 0 && (
                    <div className="report-preserved">
                      <h4>Preserved Elements (plot unchanged)</h4>
                      <ul>
                        {changeReport.preservedElements.map((element, idx) => (
                          <li key={idx}>{element}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="variation-empty">
                  <SparklesIcon />
                  <p>Click "Refine Chapter" to see the refined version and change report here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
