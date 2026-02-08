import React, { useState, useEffect } from 'react';
import {
  CHAPTER_PURPOSE_OPTIONS,
  CHAPTER_PURPOSE_DESCRIPTIONS,
} from '../../shared/types';
import { openAIService } from '../services/openaiService';
import { useOpenAI } from '../hooks/useOpenAI';

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
}

export const ChapterDetailsDialog: React.FC<ChapterDetailsDialogProps> = ({
  isOpen,
  onClose,
  chapterTitle,
  currentPurpose,
  chapterText,
  storyCraftSummary,
  onSave,
}) => {
  const { isConfigured } = useOpenAI();
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
