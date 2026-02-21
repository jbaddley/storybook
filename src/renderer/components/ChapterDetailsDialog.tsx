import React, { useState, useEffect } from 'react';
import {
  CHAPTER_PURPOSE_OPTIONS,
  CHAPTER_PURPOSE_DESCRIPTIONS,
} from '../../shared/types';
import { openAIService } from '../services/openaiService';
import { useOpenAI } from '../hooks/useOpenAI';
import { useBookStore } from '../stores/bookStore';
import { getLatestRevisionPassForChapter, isChapterDoneForRevision } from '../utils/revisionUtils';

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
  </svg>
);

export interface ChapterDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
  currentPurpose: string | undefined;
  chapterText: string;
  storyCraftSummary?: string;
  onSave: (updates: { title?: string; purpose?: string }) => void;
  /** When set, shows revision pass status and "Mark done for current pass" */
  chapterId?: string;
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

export const ChapterDetailsDialog: React.FC<ChapterDetailsDialogProps> = ({
  isOpen,
  onClose,
  chapterTitle,
  currentPurpose,
  chapterText,
  storyCraftSummary,
  onSave,
  chapterId,
}) => {
  const { isConfigured } = useOpenAI();
  const {
    book,
    currentRevisionPassId,
    markChapterDoneForRevision,
    unmarkChapterDoneForRevision,
  } = useBookStore();
  const revisionPasses = book.revisionPasses ?? [];
  const chapterRevisionCompletions = book.chapterRevisionCompletions ?? [];
  const latestPass = chapterId
    ? getLatestRevisionPassForChapter(chapterId, revisionPasses, chapterRevisionCompletions)
    : null;
  const isDoneForCurrent =
    chapterId &&
    currentRevisionPassId &&
    isChapterDoneForRevision(chapterId, currentRevisionPassId, chapterRevisionCompletions);
  const [title, setTitle] = useState(chapterTitle);
  const [selectedPurpose, setSelectedPurpose] = useState<string>(currentPurpose ?? '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(chapterTitle);
      setSelectedPurpose(currentPurpose ?? '');
      setGenerateError(null);
    }
  }, [isOpen, chapterTitle, currentPurpose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleGenerateTitle = async () => {
    if (!isConfigured || !chapterText.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const generated = await openAIService.generateChapterTitle(chapterText, storyCraftSummary, title.trim() || undefined);
      setTitle(generated);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate title');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const updates: { title?: string; purpose?: string } = {};
    if (title.trim() !== chapterTitle) updates.title = title.trim();
    if (selectedPurpose !== (currentPurpose ?? '')) updates.purpose = selectedPurpose || undefined;
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
    onClose();
  };

  const purposeDescription = selectedPurpose ? CHAPTER_PURPOSE_DESCRIPTIONS[selectedPurpose] : null;
  const hasChanges =
    title.trim() !== chapterTitle || selectedPurpose !== (currentPurpose ?? '');

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog chapter-details-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Chapter details</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="dialog-content">
          <label className="form-label" htmlFor="chapter-details-title">
            Title
          </label>
          <input
            id="chapter-details-title"
            type="text"
            className="form-input chapter-details-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chapter title"
          />
          <div className="chapter-details-generate-row">
            <button
              type="button"
              className="btn btn-secondary chapter-details-generate-btn"
              onClick={handleGenerateTitle}
              disabled={!isConfigured || isGenerating || !chapterText.trim()}
              title={
                !isConfigured
                  ? 'Configure OpenAI in Settings to use this feature'
                  : 'Generate a title from chapter content and Story Craft analysis'
              }
            >
              {isGenerating ? (
                <>
                  <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                  Generating…
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Generate from content
                </>
              )}
            </button>
            {!isConfigured && (
              <span className="chapter-details-hint">Configure OpenAI in Settings to generate titles.</span>
            )}
          </div>
          {generateError && (
            <p className="chapter-details-error" role="alert">
              {generateError}
            </p>
          )}

          {chapterId && (
            <div className="chapter-details-revision" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                Revision pass
              </label>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Latest pass completed: {latestPass ? `Pass ${latestPass.revisionNumber} – ${latestPass.title}` : '—'}
              </p>
              {currentRevisionPassId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isDoneForCurrent)
                        unmarkChapterDoneForRevision(chapterId, currentRevisionPassId);
                      else
                        markChapterDoneForRevision(chapterId, currentRevisionPassId);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      padding: 0,
                      border: isDoneForCurrent ? 'none' : '1px solid var(--border)',
                      borderRadius: 2,
                      background: isDoneForCurrent ? 'var(--accent-primary)' : 'transparent',
                      color: isDoneForCurrent ? 'var(--text-on-accent)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    title={isDoneForCurrent ? 'Unmark as done for this pass' : 'Mark as done for current pass'}
                  >
                    {isDoneForCurrent ? <CheckIcon /> : null}
                  </button>
                  <span>{isDoneForCurrent ? 'Done for current pass' : 'Mark done for current pass'}</span>
                </label>
              )}
              {!currentRevisionPassId && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Select a revision pass in the chapter list to mark this chapter done.
                </p>
              )}
            </div>
          )}

          <label className="form-label" style={{ display: 'block', marginTop: '16px', marginBottom: '6px' }}>
            Purpose
          </label>
          <p className="chapter-details-purpose-intro">
            Set the story role according to modern plot frameworks (e.g. three-act structure, Hero&apos;s Journey).
          </p>
          <select
            className="chapter-purpose-select-dialog"
            value={selectedPurpose}
            onChange={(e) => setSelectedPurpose(e.target.value)}
            aria-label="Chapter purpose"
          >
            <option value="">No purpose set</option>
            {CHAPTER_PURPOSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {purposeDescription && (
            <div className="chapter-purpose-description">
              <div className="chapter-purpose-description-label">What this purpose means</div>
              <p className="chapter-purpose-description-text">{purposeDescription}</p>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!hasChanges || !title.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
