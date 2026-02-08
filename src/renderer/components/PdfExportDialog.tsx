import React, { useState, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { PageSize, Margins, DEFAULT_PAGE_SIZE, DEFAULT_MARGINS } from '../../shared/types';
import { exportService, ExportDocxOptions } from '../services/exportService';

interface PdfExportDialogProps {
  onClose: () => void;
}

// Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const PAGE_SIZES: { name: string; width: number; height: number }[] = [
  { name: 'Letter', width: 8.5, height: 11 },
  { name: 'A4', width: 8.27, height: 11.69 },
  { name: 'A5', width: 5.83, height: 8.27 },
  { name: 'Legal', width: 8.5, height: 14 },
  { name: '6x9', width: 6, height: 9 },
  { name: '5.5x8.5', width: 5.5, height: 8.5 },
];

export const PdfExportDialog: React.FC<PdfExportDialogProps> = ({ onClose }) => {
  const { book } = useBookStore();
  
  const [useBookSettings, setUseBookSettings] = useState(true);
  const [useDocxConversion, setUseDocxConversion] = useState(false);
  const [libreofficeAvailable, setLibreofficeAvailable] = useState<boolean | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(
    new Set(book.chapters.map(ch => ch.id))
  );
  const [pageSize, setPageSize] = useState<PageSize>(book.settings.pageSize);
  const [margins, setMargins] = useState<Margins>(book.settings.margins);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI?.libreofficeAvailable) {
      window.electronAPI.libreofficeAvailable().then(setLibreofficeAvailable).catch(() => setLibreofficeAvailable(false));
    } else {
      setLibreofficeAvailable(false);
    }
  }, []);

  // Update page size when selection changes
  const handlePageSizeChange = (name: string) => {
    const size = PAGE_SIZES.find((s) => s.name === name);
    if (size) {
      setPageSize({ ...size, name });
    }
  };

  // Toggle chapter selection
  const toggleChapter = (chapterId: string) => {
    setSelectedChapterIds(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  // Select all chapters
  const selectAllChapters = () => {
    setSelectedChapterIds(new Set(book.chapters.map(ch => ch.id)));
  };

  // Deselect all chapters
  const deselectAllChapters = () => {
    setSelectedChapterIds(new Set());
  };

  // Handle export
  const handleExport = async () => {
    if (selectedChapterIds.size === 0) {
      setError('Please select at least one chapter to export');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const exportPageSize = useBookSettings ? book.settings.pageSize : pageSize;
      const exportMargins = useBookSettings ? book.settings.margins : margins;

      if (!window.electronAPI) {
        throw new Error('PDF export requires Electron');
      }

      let filePath: string | null;

      if (useDocxConversion) {
        // Export via DOCX → PDF (LibreOffice) for better typography
        const docxOptions: ExportDocxOptions = {
          selectedChapterIds: Array.from(selectedChapterIds),
          pageSize: exportPageSize,
          margins: exportMargins,
        };
        const docxBase64 = await exportService.exportToDocxWithOptions(book, docxOptions);
        filePath = await window.electronAPI.exportPdfViaDocx(docxBase64, book.title);
      } else {
        // Direct HTML → PDF (Chromium)
        const html = exportService.generateHtmlForPdf(
          book,
          Array.from(selectedChapterIds),
          exportPageSize,
          exportMargins
        );
        filePath = await window.electronAPI.exportPdf(html, book.title, {
          margins: {
            top: exportMargins.top,
            right: exportMargins.right,
            bottom: exportMargins.bottom,
            left: exportMargins.left,
          },
          pageWidthIn: exportPageSize.width,
          pageHeightIn: exportPageSize.height,
          bodyFontSize: Number(book.settings.bodyFontSize ?? book.settings.defaultFontSize ?? 12),
          bodyFont: book.settings.bodyFont || book.settings.defaultFont || undefined,
          titleFontSize: book.settings.titleFontSize,
          titleFont: book.settings.titleFont || book.settings.defaultFont,
        });
      }

      if (filePath) {
        onClose();
      } else {
        setIsExporting(false);
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePreview = async () => {
    if (selectedChapterIds.size === 0) {
      setError('Please select at least one chapter to preview');
      return;
    }
    setIsGeneratingPreview(true);
    setError(null);
    setPreviewPdfBase64(null);
    try {
      const exportPageSize = useBookSettings ? book.settings.pageSize : pageSize;
      const exportMargins = useBookSettings ? book.settings.margins : margins;
      const html = exportService.generateHtmlForPdf(
        book,
        Array.from(selectedChapterIds),
        exportPageSize,
        exportMargins
      );
      if (!window.electronAPI?.exportPdfPreview) {
        throw new Error('PDF preview not available');
      }
      const base64 = await window.electronAPI.exportPdfPreview(html, book.title, {
        margins: { top: exportMargins.top, right: exportMargins.right, bottom: exportMargins.bottom, left: exportMargins.left },
        pageWidthIn: exportPageSize.width,
        pageHeightIn: exportPageSize.height,
        bodyFontSize: Number(book.settings.bodyFontSize ?? book.settings.defaultFontSize ?? 12),
        bodyFont: book.settings.bodyFont || book.settings.defaultFont || undefined,
        titleFontSize: book.settings.titleFontSize,
        titleFont: book.settings.titleFont || book.settings.defaultFont,
      });
      setPreviewPdfBase64(base64 || null);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
      const msg = err instanceof Error ? err.message : 'Failed to generate preview';
      if (msg.includes('No handler registered') || msg.includes('export-pdf-preview')) {
        setError('PDF preview requires a restart. Quit the app, run "npm run build", then start the app again.');
      } else {
        setError(msg);
      }
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const closePreview = () => setPreviewPdfBase64(null);

  const allSelected = selectedChapterIds.size === book.chapters.length;
  const someSelected = selectedChapterIds.size > 0 && selectedChapterIds.size < book.chapters.length;

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog pdf-export-dialog" style={{ width: '600px', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Export as PDF</h2>
          <button className="dialog-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="dialog-content" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {error && (
            <div className="error-message" style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '4px', color: '#EF4444' }}>
              {error}
            </div>
          )}

          {/* Chapter Selection */}
          <div className="form-section">
            <label className="form-label">Chapters to Export</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button 
                type="button"
                className="btn-small"
                onClick={selectAllChapters}
                disabled={allSelected}
              >
                Select All
              </button>
              <button 
                type="button"
                className="btn-small"
                onClick={deselectAllChapters}
                disabled={selectedChapterIds.size === 0}
              >
                Deselect All
              </button>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedChapterIds.size} of {book.chapters.length} selected
              </span>
            </div>
            <div className="chapter-selection-list" style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: '4px', 
              maxHeight: '200px', 
              overflowY: 'auto',
              padding: '8px'
            }}>
              {book.chapters.map((chapter) => (
                <label 
                  key={chapter.id}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={selectedChapterIds.has(chapter.id)}
                    onChange={() => toggleChapter(chapter.id)}
                    style={{ marginRight: '8px' }}
                  />
                  <span>{chapter.title}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Settings Toggle */}
          <div className="form-section">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={useBookSettings}
                onChange={(e) => setUseBookSettings(e.target.checked)}
              />
              <span>Use book settings (page size and margins)</span>
            </label>
          </div>

          {/* DOCX → PDF option for better formatting */}
          <div className="form-section">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={useDocxConversion}
                onChange={(e) => setUseDocxConversion(e.target.checked)}
              />
              <span>Export via DOCX for better PDF formatting</span>
            </label>
            {useDocxConversion && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', marginLeft: '24px' }}>
                Converts to Word first, then to PDF using LibreOffice. Requires LibreOffice to be installed.
                {libreofficeAvailable === false && (
                  <span style={{ color: 'var(--color-warning, #b45309)' }}> LibreOffice not detected—install it for this option to work.</span>
                )}
              </p>
            )}
          </div>

          {/* Custom Settings */}
          {!useBookSettings && (
            <>
              {/* Page Size */}
              <div className="form-section">
                <label className="form-label">Page Size</label>
                <select
                  value={pageSize.name}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="form-input"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size.name} value={size.name}>
                      {size.name} ({size.width}" × {size.height}")
                    </option>
                  ))}
                </select>
              </div>

              {/* Margins */}
              <div className="form-section">
                <label className="form-label">Margins (inches)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Top</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={margins.top}
                      onChange={(e) => setMargins({ ...margins, top: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Bottom</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={margins.bottom}
                      onChange={(e) => setMargins({ ...margins, bottom: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Left</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={margins.left}
                      onChange={(e) => setMargins({ ...margins, left: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Right</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={margins.right}
                      onChange={(e) => setMargins({ ...margins, right: parseFloat(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dialog Footer */}
        <div className="dialog-footer">
          <button 
            className="btn-secondary" 
            onClick={onClose}
            disabled={isExporting || isGeneratingPreview}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={isExporting || isGeneratingPreview || selectedChapterIds.size === 0 || useDocxConversion}
            title={useDocxConversion ? 'Preview uses direct PDF export; disable "Export via DOCX" to preview.' : undefined}
          >
            {isGeneratingPreview ? 'Generating…' : 'Preview (first 5 pages)'}
          </button>
          <button 
            className="btn-primary" 
            onClick={handleExport}
            disabled={isExporting || isGeneratingPreview || selectedChapterIds.size === 0}
          >
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Preview modal */}
      {previewPdfBase64 && (
        <div className="dialog-overlay" onClick={closePreview} style={{ zIndex: 10001 }}>
          <div className="dialog" style={{ width: '90vw', height: '90vh', maxWidth: '1000px', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header" style={{ flexShrink: 0 }}>
              <h2 className="dialog-title">PDF preview (first 5 pages)</h2>
              <button type="button" className="dialog-close" onClick={closePreview} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <iframe
                title="PDF preview"
                src={`data:application/pdf;base64,${previewPdfBase64}`}
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
              />
            </div>
            <div className="dialog-footer" style={{ flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={closePreview}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { closePreview(); handleExport(); }}>
                Save full PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
