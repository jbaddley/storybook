import React, { useState, useRef, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { DocumentTabs } from './DocumentTabs';
import { TipTapContent } from '../../shared/types';
import { ChapterVariationDialog } from './ChapterVariationDialog';
import { ChapterDetailsDialog } from './ChapterDetailsDialog';
import { AudioExportDialog } from './AudioExportDialog';

function extractTextFromContent(content: TipTapContent | undefined): string {
  if (!content?.content) return '';
  const extractFromNode = (node: any): string => {
    if (node.text) return node.text;
    if (node.content) return node.content.map(extractFromNode).join(node.type === 'paragraph' ? '\n' : '');
    return '';
  };
  return content.content.map(extractFromNode).join('\n\n');
}

// Icons
const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chapter-item-icon">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10,9 9,9 8,9"/>
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const ListOrderedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="10" y1="6" x2="21" y2="6"/>
    <line x1="10" y1="12" x2="21" y2="12"/>
    <line x1="10" y1="18" x2="21" y2="18"/>
    <path d="M4 6h1v4"/>
    <path d="M4 10h2"/>
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
  </svg>
);

const InsertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
    <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/>
    <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5L19 5z"/>
  </svg>
);

const VariationIndicator = () => (
  <span className="variation-indicator" title="Has variation">
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
    </svg>
  </span>
);

const AudioIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

const OriginalSavedIndicator = () => (
  <span className="original-saved-indicator" title="Original content saved">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  </span>
);

const RestoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="6,9 12,15 18,9"/>
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <circle cx="12" cy="12" r="1"/>
    <circle cx="12" cy="5" r="1"/>
    <circle cx="12" cy="19" r="1"/>
  </svg>
);

/** Header actions: Add Chapter + Renumber only */
export const ChapterListHeaderActions: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { addChapter, renumberChapters } = useBookStore();

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onOutside);
      return () => document.removeEventListener('mousedown', onOutside);
    }
  }, [open]);

  return (
    <div className="panel-actions-dropdown" ref={ref}>
      <button
        type="button"
        className="panel-actions-dropdown-trigger panel-actions-dropdown-trigger-icon-only"
        onClick={() => setOpen((o) => !o)}
        title="Chapter actions"
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="panel-actions-dropdown-menu">
          <button type="button" onClick={() => { addChapter(); setOpen(false); }}>
            <PlusIcon />
            Add Chapter
          </button>
          <button type="button" onClick={() => { renumberChapters(); setOpen(false); }}>
            <ListOrderedIcon />
            Renumber chapters
          </button>
        </div>
      )}
    </div>
  );
};

const AUDIO_EXPORT_PATH_KEY = (bookId: string, chapterId: string) =>
  `audio-export-path:${bookId}:${chapterId}`;

/** Per-row actions dropdown for one chapter */
function ChapterRowActions({
  chapter,
  index,
  bookId,
  onVariationDialog,
  onAudioExport,
  onPurposeDialog,
}: {
  chapter: { id: string; title: string; originalContent?: unknown };
  index: number;
  bookId: string;
  onVariationDialog: (id: string) => void;
  onAudioExport: (id: string) => void;
  onPurposeDialog: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lastExportedAudioPath, setLastExportedAudioPath] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const {
    updateChapter,
    insertChapterAt,
    deleteChapter,
    getChapterVariation,
    applyVariation,
    discardVariation,
    restoreOriginal,
    clearOriginal,
    getSortedChapters,
  } = useBookStore();
  const chapters = getSortedChapters();
  const hasVariation = !!getChapterVariation(chapter.id);
  const hasOriginal = !!chapter.originalContent;

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onOutside);
      return () => document.removeEventListener('mousedown', onOutside);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !bookId || !chapter.id || typeof window.electronAPI?.storeGet !== 'function') return;
    window.electronAPI.storeGet(AUDIO_EXPORT_PATH_KEY(bookId, chapter.id)).then((value) => {
      setLastExportedAudioPath(typeof value === 'string' ? value : null);
    });
  }, [open, bookId, chapter.id]);

  const runAndClose = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  const handlePlayAudio = () => {
    if (!lastExportedAudioPath || typeof window.electronAPI?.getAudioPlaybackUrl !== 'function') return;
    window.electronAPI.getAudioPlaybackUrl(lastExportedAudioPath).then((url) => {
      const audio = new Audio(url);
      audio.play().catch((err) => console.warn('[ChapterList] Audio play failed:', err));
    });
    setOpen(false);
  };

  return (
    <div className="chapter-row-actions" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="chapter-row-actions-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Chapter actions"
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="panel-actions-dropdown-menu chapter-row-actions-menu">
          <button
            type="button"
            onClick={() => runAndClose(() => onPurposeDialog(chapter.id))}
          >
            Chapter details…
          </button>
          <button
            type="button"
            onClick={() => runAndClose(() => insertChapterAt(index + 1))}
          >
            <InsertIcon />
            Insert chapter below
          </button>
          <button type="button" onClick={() => runAndClose(() => onVariationDialog(chapter.id))}>
            <SparklesIcon />
            {hasVariation ? 'View/Edit variation' : 'Generate variation'}
          </button>
          <button type="button" onClick={() => runAndClose(() => onAudioExport(chapter.id))}>
            <AudioIcon />
            Export as audio
          </button>
          <button
            type="button"
            onClick={lastExportedAudioPath ? handlePlayAudio : undefined}
            disabled={!lastExportedAudioPath}
            title={lastExportedAudioPath ? 'Play the latest exported audio for this chapter' : 'Export and save audio first, then you can play it here'}
          >
            <PlayIcon />
            Play exported audio
          </button>
          {hasVariation && (
            <>
              <button type="button" onClick={() => runAndClose(() => applyVariation(chapter.id))}>
                <CheckIcon />
                Apply variation
              </button>
              <button
                type="button"
                onClick={() =>
                  runAndClose(() => {
                    if (confirm('Discard this variation?')) discardVariation(chapter.id);
                  })
                }
              >
                <TrashIcon />
                Discard variation
              </button>
            </>
          )}
          {hasOriginal && !hasVariation && (
            <>
              <button
                type="button"
                onClick={() =>
                  runAndClose(() => {
                    if (confirm('Restore the original content?'))
                      restoreOriginal(chapter.id);
                  })
                }
              >
                <RestoreIcon />
                Restore original
              </button>
              <button
                type="button"
                onClick={() =>
                  runAndClose(() => {
                    if (
                      confirm(
                        'Discard the saved original? You will keep the current variation.'
                      )
                    )
                      clearOriginal(chapter.id);
                  })
                }
              >
                <TrashIcon />
                Discard saved original
              </button>
            </>
          )}
          {!hasVariation && !hasOriginal && chapters.length > 1 && (
            <button
              type="button"
              onClick={() =>
                runAndClose(() => {
                  if (confirm('Are you sure you want to delete this chapter?'))
                    deleteChapter(chapter.id);
                })
              }
            >
              <TrashIcon />
              Delete chapter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const ChapterList: React.FC = () => {
  const { 
    book, 
    activeChapterId, 
    ui,
    setActiveChapter, 
    setActiveDocumentTab,
    addChapter,
    insertChapterAt,
    deleteChapter,
    updateChapter,
    renumberChapters,
    getSortedChapters,
    getChapterVariation,
    getStoryCraftFeedback,
    applyVariation,
    discardVariation,
    restoreOriginal,
    clearOriginal
  } = useBookStore();
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [variationDialogChapterId, setVariationDialogChapterId] = useState<string | null>(null);
  const [audioExportChapterId, setAudioExportChapterId] = useState<string | null>(null);
  const [detailsDialogChapterId, setDetailsDialogChapterId] = useState<string | null>(null);

  const chapters = getSortedChapters();
  const detailsDialogChapter = detailsDialogChapterId
    ? book.chapters.find((c) => c.id === detailsDialogChapterId)
    : null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const { reorderChapters } = useBookStore.getState();
      reorderChapters(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const formatWordCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const getStoryCraftScore = (chapterId: string): number | null => {
    const feedback = getStoryCraftFeedback(chapterId);
    if (!feedback?.assessment) return null;
    const a = feedback.assessment;
    return (
      (a.plotProgression.score +
        a.characterDevelopment.score +
        a.themeReinforcement.score +
        a.pacing.score +
        a.conflictTension.score +
        a.hookEnding.score) /
      6
    );
  };

  const getScoreColor = (score: number): string => {
    if (score >= 4) return 'var(--accent-success)';
    if (score >= 3) return 'var(--accent-warning)';
    return 'var(--accent-error)';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 5) return 'Excellent';
    if (score >= 4) return 'Good';
    if (score >= 3) return 'Fair';
    if (score >= 2) return 'Needs Work';
    return 'Poor';
  };

  return (
    <>
      <div className="chapters-panel">
        <div className="chapters-panel-scroll">
          <div className="text-muted" style={{ fontSize: '11px', marginBottom: '8px' }}>
            {chapters.length} chapters
          </div>
          <ul className="chapter-list">
            {chapters.map((chapter, index) => (
              <li
                key={chapter.id}
                className={`chapter-item ${chapter.id === activeChapterId && !ui.activeDocumentTabId ? 'active' : ''}`}
                onClick={() => {
                  setActiveDocumentTab(null);
                  setActiveChapter(chapter.id);
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  opacity: draggedIndex === index ? 0.5 : 1,
                }}
              >
                <div className="chapter-item-row1">
                  <div className="chapter-item-row1-left">
                    <DocumentIcon />
                    <span className="chapter-item-number">Chapter {chapter.order}</span>
                  </div>
                  <div className="chapter-item-right">
                    <span className="chapter-item-slot chapter-item-slot-indicator">
                      {getChapterVariation(chapter.id) && <VariationIndicator />}
                    </span>
                    <span className="chapter-item-slot chapter-item-slot-indicator">
                      {chapter.originalContent && !getChapterVariation(chapter.id) && <OriginalSavedIndicator />}
                    </span>
                    <span className="chapter-item-slot chapter-item-slot-words">
                      {formatWordCount(chapter.wordCount)}
                    </span>
                    <span className="chapter-item-slot chapter-item-slot-score">
                      {(() => {
                        const score = getStoryCraftScore(chapter.id);
                        if (score === null) return null;
                        return (
                          <span
                            className="chapter-item-sc-score"
                            style={{ backgroundColor: getScoreColor(score) }}
                            title={`Story Craft: ${score.toFixed(1)} - ${getScoreLabel(score)}`}
                          >
                            {score.toFixed(1)}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="chapter-item-slot chapter-item-slot-actions">
                      <ChapterRowActions
                        chapter={chapter}
                        index={index}
                        bookId={book.id}
                        onVariationDialog={setVariationDialogChapterId}
                        onAudioExport={setAudioExportChapterId}
                        onPurposeDialog={setDetailsDialogChapterId}
                      />
                    </span>
                  </div>
                </div>
                <div className="chapter-item-row2">
                  <span className="chapter-item-title">{chapter.title}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="chapter-add-row">
            <button type="button" className="chapter-add-btn" onClick={addChapter}>
              <PlusIcon />
              <span>Add Chapter</span>
            </button>
            <button
              type="button"
              className="chapter-add-btn chapter-add-btn-icon"
              onClick={renumberChapters}
              title="Renumber all chapters sequentially (Chapter 1, Chapter 2, etc.)"
            >
              <ListOrderedIcon />
            </button>
          </div>

          <DocumentTabs />
        </div>

        <div className="chapters-panel-stats">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Book Stats
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <span className="text-secondary">Total Words</span>
            <span>{chapters.reduce((sum, c) => sum + c.wordCount, 0).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span className="text-secondary">Chapters</span>
            <span>{chapters.length}</span>
          </div>
        </div>
      </div>

      <ChapterVariationDialog
        isOpen={variationDialogChapterId !== null}
        onClose={() => setVariationDialogChapterId(null)}
        chapterId={variationDialogChapterId || ''}
      />
      <ChapterDetailsDialog
        isOpen={detailsDialogChapterId !== null}
        onClose={() => setDetailsDialogChapterId(null)}
        chapterTitle={detailsDialogChapter?.title ?? ''}
        currentPurpose={detailsDialogChapter?.purpose}
        chapterText={detailsDialogChapter ? extractTextFromContent(detailsDialogChapter.content) : ''}
        storyCraftSummary={detailsDialogChapterId ? getStoryCraftFeedback(detailsDialogChapterId)?.summary : undefined}
        onSave={(updates) => {
          if (detailsDialogChapterId) updateChapter(detailsDialogChapterId, updates);
          setDetailsDialogChapterId(null);
        }}
      />
      <AudioExportDialog
        isOpen={audioExportChapterId !== null}
        onClose={() => setAudioExportChapterId(null)}
        chapterId={audioExportChapterId || ''}
      />
    </>
  );
};

