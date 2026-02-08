import React, { useState, useMemo, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { PlotError, PlotErrorType, PlotErrorSeverity, TipTapContent } from '../../shared/types';
import { plotAnalysisService } from '../services/plotAnalysisService';
import { useOpenAI } from '../hooks/useOpenAI';

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    style={{ 
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.2s',
      marginRight: '8px'
    }}
  >
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const EmptyState: React.FC<{ icon: string; title: string; description: string | React.ReactNode }> = ({ icon, title, description }) => (
  <div style={{ 
    textAlign: 'center', 
    padding: '60px 20px',
    color: 'var(--text-secondary)'
  }}>
    <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
    <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>{title}</h3>
    {typeof description === 'string' ? <p>{description}</p> : description}
  </div>
);

// Helper function to render TipTap content as formatted text
const renderTipTapContent = (content: TipTapContent): React.ReactNode => {
  if (!content?.content) return null;
  
  return (
    <div>
      {content.content.map((node: any, index: number) => {
        if (node.type === 'heading') {
          const level = node.attrs?.level || 1;
          const text = extractTextFromNode(node);
          const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
          const styles: Record<number, React.CSSProperties> = {
            1: { fontSize: '24px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px', color: 'var(--text-primary)' },
            2: { fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px', color: 'var(--text-primary)' },
            3: { fontSize: '16px', fontWeight: '600', marginTop: '16px', marginBottom: '8px', color: 'var(--text-primary)' },
          };
          return <HeadingTag key={index} style={styles[level] || styles[3]}>{text}</HeadingTag>;
        } else if (node.type === 'paragraph') {
          const text = extractTextFromNode(node);
          if (!text.trim()) return <br key={index} />;
          
          // Check for bold/italic formatting
          const parts = extractFormattedText(node);
          return (
            <p key={index} style={{ marginBottom: '8px', lineHeight: '1.6' }}>
              {parts.map((part, i) => {
                if (part.bold && part.italic) {
                  return <strong key={i}><em>{part.text}</em></strong>;
                } else if (part.bold) {
                  return <strong key={i}>{part.text}</strong>;
                } else if (part.italic) {
                  return <em key={i}>{part.text}</em>;
                }
                return <span key={i}>{part.text}</span>;
              })}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
};

// Extract plain text from a TipTap node
const extractTextFromNode = (node: any): string => {
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map((n: any) => extractTextFromNode(n)).join('');
  }
  return '';
};

// Extract text with formatting marks
const extractFormattedText = (node: any): Array<{ text: string; bold?: boolean; italic?: boolean }> => {
  if (!node.content || !Array.isArray(node.content)) {
    return [{ text: node.text || '' }];
  }
  
  return node.content.map((n: any) => {
    const marks = n.marks || [];
    const bold = marks.some((m: any) => m.type === 'bold');
    const italic = marks.some((m: any) => m.type === 'italic');
    return {
      text: n.text || '',
      bold,
      italic,
    };
  }).filter((p: any) => p.text);
};

const PlotAnalysisView: React.FC = () => {
  const { 
    book, 
    getChapterById, 
    setActiveChapter, 
    setActiveDocumentTab,
    getPlotErrorAnalysis,
    setPlotErrorAnalysis,
    updateDocumentTabContent
  } = useBookStore();
  
  const { isConfigured } = useOpenAI();
  
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [errorFilter, setErrorFilter] = useState<{ type?: PlotErrorType; severity?: PlotErrorSeverity }>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);

  const analysis = getPlotErrorAnalysis();
  const plotAnalysisTab = book.documentTabs.find(t => t.tabType === 'plotanalysis');
  
  // Load plot analysis from database when component mounts or book changes
  useEffect(() => {
    const loadPlotAnalysis = async () => {
      // Only load if we don't already have analysis in the store
      if (!analysis && book.id) {
        try {
          const dbAnalysis = await window.electronAPI.dbGetPlotErrorAnalysis(book.id) as any;
          if (dbAnalysis) {
            setPlotErrorAnalysis(dbAnalysis);
            
            // Also regenerate and update the outline in the document tab
            const markdownOutline = plotAnalysisService.generateOutline(dbAnalysis);
            const currentTab = book.documentTabs.find(t => t.tabType === 'plotanalysis');
            if (currentTab) {
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
                    // Handle bold text (**text**)
                    const parts: any[] = [];
                    let currentText = '';
                    let inBold = false;
                    for (let i = 0; i < line.length; i++) {
                      if (line.substring(i, i + 2) === '**' && line.substring(i - 1, i) !== '\\') {
                        if (currentText) {
                          parts.push({ type: 'text', text: currentText, marks: inBold ? [{ type: 'bold' }] : [] });
                          currentText = '';
                        }
                        inBold = !inBold;
                        i++; // Skip next *
                      } else {
                        currentText += line[i];
                      }
                    }
                    if (currentText) {
                      parts.push({ type: 'text', text: currentText, marks: inBold ? [{ type: 'bold' }] : [] });
                    }
                    
                    return {
                      type: 'paragraph',
                      content: parts.length > 0 ? parts : [{ type: 'text', text: line }],
                    };
                  }
                }).filter(node => node.type !== 'paragraph' || (node.content && node.content.length > 0)),
              };
              updateDocumentTabContent(currentTab.id, content);
            }
          }
        } catch (error) {
          console.error('Failed to load plot analysis from database:', error);
        }
      }
    };
    
    loadPlotAnalysis();
  }, [book.id, book.documentTabs, analysis, setPlotErrorAnalysis, updateDocumentTabContent]);
  
  // Handle analyze plot errors
  const handleAnalyzePlotErrors = async () => {
    if (!isConfigured || book.chapters.length === 0) {
      alert('Please configure OpenAI API key in Settings and ensure you have chapters in your book.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress('Starting analysis...');

    try {
      const sortedChapters = [...book.chapters].sort((a, b) => a.order - b.order);
      
      const analysisResult = await plotAnalysisService.analyzeBookPlotErrors(
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
          setAnalysisProgress(progress.status);
        }
      );

      // Save to store
      setPlotErrorAnalysis(analysisResult);

      // Generate markdown outline
      const markdownOutline = plotAnalysisService.generateOutline(analysisResult);

      // Update plot analysis document tab
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

      setAnalysisProgress(null);
    } catch (error) {
      console.error('Plot error analysis failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setAnalysisProgress(`Error: ${errorMessage}`);
      // Show error for 10 seconds
      setTimeout(() => {
        setAnalysisProgress(null);
        setIsAnalyzing(false);
      }, 10000);
      return;
    } finally {
      if (!analysisProgress || !analysisProgress.startsWith('Error:')) {
        setIsAnalyzing(false);
      }
    }
  };

  const toggleError = (errorId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  };

  const navigateToChapter = (chapterId: string) => {
    setActiveDocumentTab(null);
    setActiveChapter(chapterId);
  };

  const getErrorTypeLabel = (type: PlotErrorType): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSeverityColor = (severity: PlotErrorSeverity): string => {
    switch (severity) {
      case 'critical': return 'var(--accent-error)';
      case 'major': return '#ff6b6b';
      case 'minor': return 'var(--accent-warning)';
      case 'suggestion': return 'var(--accent-info)';
      default: return 'var(--text-secondary)';
    }
  };

  // Filter errors
  const filteredErrors = useMemo(() => {
    if (!analysis) return [];
    let errors = analysis.errors;
    
    if (errorFilter.type) {
      errors = errors.filter(e => e.type === errorFilter.type);
    }
    
    if (errorFilter.severity) {
      errors = errors.filter(e => e.severity === errorFilter.severity);
    }
    
    return errors;
  }, [analysis, errorFilter]);

  // Group errors by type
  const errorsByType = useMemo(() => {
    const groups = new Map<PlotErrorType, PlotError[]>();
    filteredErrors.forEach(error => {
      if (!groups.has(error.type)) {
        groups.set(error.type, []);
      }
      groups.get(error.type)!.push(error);
    });
    return groups;
  }, [filteredErrors]);

  if (!analysis && !isAnalyzing) {
    return (
      <div className="tab-viewer">
        <div className="tab-viewer-header">
          <h2>Plot Error Analysis</h2>
        </div>
        <EmptyState 
          icon="🔍" 
          title="No Plot Error Analysis"
          description={
            <>
              <p style={{ marginBottom: '16px' }}>
                Generate a comprehensive plot error analysis across all chapters. This will identify plot holes, timeline mistakes, character inconsistencies, and other narrative problems.
              </p>
              <button
                onClick={handleAnalyzePlotErrors}
                disabled={!isConfigured || book.chapters.length === 0 || isAnalyzing}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  backgroundColor: isConfigured && book.chapters.length > 0 ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isConfigured && book.chapters.length > 0 && !isAnalyzing ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto',
                }}
                title={
                  !isConfigured 
                    ? 'Please configure OpenAI API key in Settings'
                    : book.chapters.length === 0
                    ? 'Add chapters to your book first'
                    : 'Start plot error analysis'
                }
              >
                {isAnalyzing ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Analyze Plot Errors</span>
                  </>
                )}
              </button>
              {!isConfigured && (
                <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--accent-warning)' }}>
                  ⚠️ OpenAI API key required. Configure in Settings.
                </p>
              )}
              {book.chapters.length === 0 && (
                <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--accent-warning)' }}>
                  ⚠️ Add chapters to your book first.
                </p>
              )}
            </>
          }
        />
      </div>
    );
  }
  
  // Show loading state
  if (isAnalyzing) {
    return (
      <div className="tab-viewer">
        <div className="tab-viewer-header">
          <h2>Plot Error Analysis</h2>
        </div>
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          color: 'var(--text-secondary)'
        }}>
          <div className="spinner" style={{ 
            width: '48px', 
            height: '48px', 
            borderWidth: '4px',
            margin: '0 auto 24px'
          }} />
          <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Analyzing Plot Errors</h3>
          <p style={{ marginBottom: '16px' }}>{analysisProgress || 'Processing chapters...'}</p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            This may take several minutes for large books. Please don't close this window.
          </p>
        </div>
      </div>
    );
  }

  // At this point, analysis should exist, but add a safety check
  if (!analysis) {
    return null; // This shouldn't happen, but TypeScript needs it
  }

  const sortedChapterAnalyses = [...analysis.chapterAnalyses].sort((a, b) => a.order - b.order);

  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
          <h2>Plot Error Analysis</h2>
          <button
            onClick={handleAnalyzePlotErrors}
            disabled={!isConfigured || book.chapters.length === 0 || isAnalyzing}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: isConfigured && book.chapters.length > 0 && !isAnalyzing ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isConfigured && book.chapters.length > 0 && !isAnalyzing ? 'pointer' : 'not-allowed',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Re-run plot error analysis"
          >
            {isAnalyzing ? (
              <>
                <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Re-run Analysis</span>
              </>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
          <p className="text-muted">
            {analysis.errors.length} error{analysis.errors.length !== 1 ? 's' : ''} found
            {analysis.chapterAnalyses.length > 0 && ` • ${analysis.chapterAnalyses.length} chapters analyzed`}
            {analysis.generatedAt && ` • Generated ${new Date(analysis.generatedAt).toLocaleString()}`}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={errorFilter.type || ''}
              onChange={(e) => setErrorFilter({ ...errorFilter, type: e.target.value as PlotErrorType || undefined })}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              <option value="">All Types</option>
              <option value="name_mismatch">Name Mismatch</option>
              <option value="plot_hole">Plot Hole</option>
              <option value="timeline_mistake">Timeline Mistake</option>
              <option value="character_inconsistency">Character Inconsistency</option>
              <option value="location_mistake">Location Mistake</option>
              <option value="genre_problem">Genre Problem</option>
              <option value="feasibility_issue">Feasibility Issue</option>
              <option value="clarity_issue">Clarity Issue</option>
            </select>
            <select
              value={errorFilter.severity || ''}
              onChange={(e) => setErrorFilter({ ...errorFilter, severity: e.target.value as PlotErrorSeverity || undefined })}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="suggestion">Suggestion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chapter Outline Summary - Quick View */}
      {sortedChapterAnalyses.length > 0 && (
        <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '16px' }}>Chapter Outline Summary</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Quick overview. Scroll down for the complete detailed outline.
          </p>
          <div style={{ display: 'grid', gap: '12px' }}>
            {sortedChapterAnalyses.map(ca => {
              const chapterErrors = analysis.errors.filter(e => e.affectedChapters.includes(ca.chapterId));
              return (
                <div key={ca.id} style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <strong>Chapter {ca.order}: {ca.proposedTitle || ca.chapterTitle}</strong>
                      {ca.roles && ca.roles.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          <strong>Plot Role:</strong> {ca.roles.join(', ')}
                        </div>
                      )}
                      {ca.chapterTheme && (
                        <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                          <strong>Theme:</strong> {ca.chapterTheme}
                        </div>
                      )}
                      {ca.plotSummary && (
                        <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                          {ca.plotSummary}
                        </div>
                      )}
                    </div>
                    {chapterErrors.length > 0 && (
                      <span style={{ 
                        padding: '4px 8px', 
                        backgroundColor: getSeverityColor(chapterErrors[0].severity),
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {chapterErrors.length} error{chapterErrors.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Errors by Type */}
      <div>
        <h3 style={{ marginBottom: '16px' }}>Errors by Type</h3>
        {Array.from(errorsByType.entries()).map(([type, errors]) => (
          <div key={type} style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
              {getErrorTypeLabel(type)} ({errors.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {errors.map(error => {
                const isExpanded = expandedErrors.has(error.id);
                const affectedChapters = error.affectedChapters.map(chId => {
                  const ca = analysis.chapterAnalyses.find(c => c.chapterId === chId);
                  return ca ? { id: chId, title: `Chapter ${ca.order}: ${ca.chapterTitle}` } : { id: chId, title: chId };
                });

                return (
                  <div 
                    key={error.id} 
                    style={{ 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '4px',
                      padding: '12px',
                      backgroundColor: 'var(--bg-secondary)'
                    }}
                  >
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        cursor: 'pointer',
                        marginBottom: isExpanded ? '8px' : '0'
                      }}
                      onClick={() => toggleError(error.id)}
                    >
                      <ChevronIcon expanded={isExpanded} />
                      <span style={{ 
                        padding: '2px 8px', 
                        backgroundColor: getSeverityColor(error.severity),
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '11px',
                        marginRight: '8px',
                        fontWeight: 'bold'
                      }}>
                        {error.severity.toUpperCase()}
                      </span>
                      <span style={{ flex: 1, fontWeight: '500' }}>{error.description}</span>
                    </div>
                    
                    {isExpanded && (
                      <div style={{ marginLeft: '24px', marginTop: '8px' }}>
                        {error.context && (
                          <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <strong>Context:</strong> {error.context}
                          </div>
                        )}
                        {affectedChapters.length > 0 && (
                          <div>
                            <strong style={{ fontSize: '13px' }}>Affects:</strong>
                            <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {affectedChapters.map(ch => (
                                <button
                                  key={ch.id}
                                  onClick={() => navigateToChapter(ch.id)}
                                  style={{
                                    padding: '2px 8px',
                                    backgroundColor: 'var(--accent-primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  {ch.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Full Analysis Outline - Always show if analysis exists */}
      {analysis && sortedChapterAnalyses.length > 0 && (
        <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid var(--border-color)' }}>
          <h2 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: 'bold' }}>Full Analysis Outline</h2>
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.8',
            color: 'var(--text-primary)'
          }}>
            {plotAnalysisTab && plotAnalysisTab.content ? (
              // Use tab content if available (formatted)
              renderTipTapContent(plotAnalysisTab.content)
            ) : (
              // Otherwise generate outline directly from analysis
              (() => {
                const markdownOutline = plotAnalysisService.generateOutline(analysis);
                const lines = markdownOutline.split('\n');
                return (
                  <div>
                    {lines.map((line, index) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={index} style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>{line.substring(2)}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={index} style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' }}>{line.substring(3)}</h2>;
                      } else if (line.startsWith('### ')) {
                        return <h3 key={index} style={{ fontSize: '18px', fontWeight: '600', marginTop: '16px', marginBottom: '8px' }}>{line.substring(4)}</h3>;
                      } else if (line.trim() === '') {
                        return <br key={index} />;
                      } else {
                        // Handle bold text (**text**)
                        const parts: React.ReactNode[] = [];
                        let currentText = '';
                        let inBold = false;
                        for (let i = 0; i < line.length; i++) {
                          if (line.substring(i, i + 2) === '**' && (i === 0 || line[i - 1] !== '\\')) {
                            if (currentText) {
                              parts.push(inBold ? <strong key={parts.length}>{currentText}</strong> : <span key={parts.length}>{currentText}</span>);
                              currentText = '';
                            }
                            inBold = !inBold;
                            i++; // Skip next *
                          } else {
                            currentText += line[i];
                          }
                        }
                        if (currentText) {
                          parts.push(inBold ? <strong key={parts.length}>{currentText}</strong> : <span key={parts.length}>{currentText}</span>);
                        }
                        return <p key={index} style={{ marginBottom: '8px' }}>{parts.length > 0 ? parts : line}</p>;
                      }
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlotAnalysisView;
