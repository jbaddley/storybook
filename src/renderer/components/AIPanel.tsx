import React, { useState } from 'react';
import { useBookStore } from '../stores/bookStore';
import { useOpenAI } from '../hooks/useOpenAI';
import { TipTapContent, BookSettings, StoryCraftChapterFeedback, generateId } from '../../shared/types';
import { AIChatBot } from './AIChatBot';
import { openAIService } from '../services/openaiService';

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
  if (!node.content || node.content.length === 0) {
    return true;
  }
  
  // Check if all content is just whitespace or empty
  const textContent = getNodeTextContent(node);
  return textContent.trim() === '';
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

// Apply font styling to text nodes
function applyFontToContent(
  content: TipTapNode[] | undefined, 
  fontFamily: string, 
  fontSize: number
): TipTapNode[] | undefined {
  if (!content) return content;
  
  return content.map(node => {
    if (node.type === 'text') {
      // Find existing textStyle mark or create one
      const existingMarks = node.marks || [];
      const hasTextStyle = existingMarks.some(m => m.type === 'textStyle');
      
      let newMarks;
      if (hasTextStyle) {
        // Update existing textStyle
        newMarks = existingMarks.map(mark => {
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
        newMarks = [
          ...existingMarks,
          {
            type: 'textStyle',
            attrs: {
              fontFamily,
              fontSize: `${fontSize}pt`
            }
          }
        ];
      }
      
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
  if (!doc.content) return doc;
  
  const formattedContent: TipTapNode[] = [];
  let previousWasHeading = false;
  let isFirstParagraph = true;

  for (let i = 0; i < doc.content.length; i++) {
    const node = doc.content[i];
    
    // Handle paragraphs
    if (node.type === 'paragraph') {
      const isEmpty = isNodeEmpty(node);
      
      if (isEmpty) {
        // Skip ALL empty paragraphs to remove excess whitespace
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
      continue;
    }
    // Keep other nodes as-is but apply body font
    else {
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
    activeChapterId
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
  const [activeTab, setActiveTab] = useState<'actions' | 'chat'>('actions');
  const [isFormatting, setIsFormatting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; chapter: string } | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Combined extraction - extract all at once
  const handleExtractAll = async () => {
    if (!activeChapter || !isConfigured) return;
    
    setExtracting(true);
    
    try {
      // Extract characters
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
      
      setExtractionProgress(null);
    } catch (error) {
      console.error('Extraction failed:', error);
      setExtractionProgress(null);
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
    if (!activeChapter || !activeChapterId) return;
    
    setIsFormatting(true);
    
    try {
      // Get the TipTap editor instance
      const editor = (window as any).__tiptapEditor;
      if (!editor) {
        console.error('Editor not found');
        return;
      }

      // Get current JSON content
      const content = editor.getJSON();
      
      // Get font settings from book settings
      const formatSettings: FormatSettings = {
        titleFont: book.settings.titleFont || 'Carlito',
        titleFontSize: book.settings.titleFontSize || 24,
        bodyFont: book.settings.bodyFont || book.settings.defaultFont || 'Carlito',
        bodyFontSize: book.settings.bodyFontSize || book.settings.defaultFontSize || 12,
      };
      
      // Apply book formatting transformations with font settings
      const formattedContent = formatBookContent(content as TipTapNode, formatSettings);
      
      // Update the editor with formatted content
      editor.commands.setContent(formattedContent, false);
      
      // Update store
      updateChapterContent(activeChapterId, formattedContent as TipTapContent);
      
    } finally {
      setIsFormatting(false);
    }
  };

  // Process all chapters - extract and format each one
  const handleProcessAllChapters = async () => {
    if (!isConfigured || book.chapters.length === 0) return;
    
    const confirmMsg = `This will process all ${book.chapters.length} chapters:\n\n` +
      `• Extract characters, locations, and timeline\n` +
      `• Generate chapter summaries\n` +
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
        
        // 1. Format the chapter content
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
        
        // 6. Extract Story Craft Feedback
        try {
          const chapterText = extractTextFromContent(chapter.content);
          const existingThemes = book.extracted.themesAndMotifs;
          const themesContext = existingThemes?.themes.map(t => t.name).join(', ');
          
          const feedback = await openAIService.extractStoryCraftFeedback(
            chapterText,
            chapter.id,
            chapter.title,
            { themes: themesContext }
          );
          
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
              generatedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            };
            addOrUpdateStoryCraftFeedback(storyCraftFeedback);
          }
        } catch (err) {
          console.error(`Failed to extract story craft feedback from ${chapter.title}:`, err);
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

  const currentSummary = activeChapter 
    ? ai.summaries.get(activeChapter.id) 
    : undefined;

  return (
    <>
      <div className="panel-header">
        <span>AI Assistant</span>
        {!isConfigured && (
          <span style={{ 
            fontSize: '10px', 
            color: 'var(--accent-warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <AlertCircleIcon />
            Not configured
          </span>
        )}
      </div>
      
      <div className="panel-content ai-panel-content">
        {!isConfigured ? (
          <div className="empty-state">
            <AlertCircleIcon />
            <p className="empty-state-text">
              Please configure your OpenAI API key in Settings to use AI features.
            </p>
          </div>
        ) : (
          <>
            {/* Tab buttons */}
            <div className="ai-tabs">
              <button
                onClick={() => setActiveTab('actions')}
                className={`ai-tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
              >
                <ActionsIcon />
                Actions
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`ai-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              >
                <ChatIcon />
                Chat
              </button>
            </div>

            {activeTab === 'actions' && (
              <>
                {!activeChapter ? (
                  <div className="empty-state">
                    <FileTextIcon />
                    <p className="empty-state-text">
                      Select a chapter to use AI features.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Main Actions */}
                    <div className="ai-section">
                      <div className="ai-section-title">Extract & Analyze</div>
                      <button 
                        className="ai-btn ai-btn-primary" 
                        onClick={handleExtractAll}
                        disabled={ai.isExtracting}
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
                      <p className="ai-help-text">
                        Extracts characters, locations, timeline events, and generates a chapter summary.
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
                        Iterates through all {book.chapters.length} chapters: 
                        formats text, extracts characters/locations/timeline, 
                        and generates summaries. May take several minutes.
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
              <AIChatBot />
            )}
          </>
        )}
      </div>
    </>
  );
};
