import React, { useState, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { PageSize, Margins, DEFAULT_PAGE_SIZE, DEFAULT_MARGINS, BookContextSettings, DEFAULT_BOOK_CONTEXT } from '../../shared/types';

// Genre options for dropdown
const GENRE_OPTIONS = [
  'Literary Fiction',
  'Commercial Fiction',
  'Thriller',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Fantasy',
  'Horror',
  'Historical Fiction',
  'Contemporary Fiction',
  'Young Adult Fiction',
  'Middle Grade Fiction',
  'Memoir',
  'Biography',
  'Self-Help',
  'Other',
];

// Common sub-genre options
const SUB_GENRE_OPTIONS = [
  'Coming-of-age',
  'Psychological',
  'Suspense',
  'Cozy Mystery',
  'Police Procedural',
  'Paranormal',
  'Urban Fantasy',
  'Epic Fantasy',
  'Space Opera',
  'Dystopian',
  'Post-Apocalyptic',
  'Time Travel',
  'Romantic Comedy',
  'Historical Romance',
  'Family Saga',
  'War',
  'Sports',
  'Crime',
  'Legal',
  'Medical',
  'Political',
];

// Target demographic options
const DEMOGRAPHIC_OPTIONS = [
  'Adult',
  'Young Adult (13-18)',
  'Middle Grade (8-12)',
  "Children's (5-8)",
  'New Adult (18-25)',
  'All Ages',
];

// Time period options
const TIME_PERIOD_OPTIONS = [
  'Contemporary (2020s)',
  'Recent Past (2000s-2010s)',
  'Late 20th Century (1970s-1990s)',
  'Mid 20th Century (1940s-1960s)',
  'Early 20th Century (1900s-1930s)',
  'Victorian Era (1837-1901)',
  'Regency Era (1811-1820)',
  'Renaissance (14th-17th Century)',
  'Medieval (5th-15th Century)',
  'Ancient (Before 5th Century)',
  'Future/Sci-Fi',
  'Timeless/Unspecified',
  'Other',
];

interface SettingsDialogProps {
  onClose: () => void;
}

const PAGE_SIZES: { name: string; width: number; height: number }[] = [
  { name: 'Letter', width: 8.5, height: 11 },
  { name: 'A4', width: 8.27, height: 11.69 },
  { name: 'A5', width: 5.83, height: 8.27 },
  { name: 'Legal', width: 8.5, height: 14 },
  { name: '6x9', width: 6, height: 9 },
  { name: '5.5x8.5', width: 5.5, height: 8.5 },
];

const FONT_OPTIONS = [
  // Popular
  { value: 'Carlito', label: 'Carlito (like Calibri)' },
  { value: 'Caladea', label: 'Caladea (like Cambria)' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  // Serif
  { value: 'Alegreya', label: 'Alegreya' },
  { value: 'Bitter', label: 'Bitter' },
  { value: 'Bree Serif', label: 'Bree Serif' },
  { value: 'Crimson Text', label: 'Crimson Text' },
  { value: 'EB Garamond', label: 'EB Garamond' },
  { value: 'Libre Baskerville', label: 'Libre Baskerville' },
  { value: 'Lora', label: 'Lora' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Noto Serif', label: 'Noto Serif' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'PT Serif', label: 'PT Serif' },
  { value: 'Roboto Slab', label: 'Roboto Slab' },
  { value: 'Source Serif Pro', label: 'Source Serif Pro' },
  { value: 'Spectral', label: 'Spectral' },
  // Sans-Serif
  { value: 'Cabin', label: 'Cabin' },
  { value: 'Comfortaa', label: 'Comfortaa' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Lexend', label: 'Lexend' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Roboto', label: 'Roboto' },
  // Handwriting
  { value: 'Caveat', label: 'Caveat' },
  { value: 'Lobster', label: 'Lobster' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48, 72];

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const { book, updateBookMetadata, ui, setContentEditorTheme } = useBookStore();
  const [activeTab, setActiveTab] = useState<'general' | 'context' | 'fonts' | 'page' | 'api'>('general');
  
  // Form state - General
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [description, setDescription] = useState(book.description);
  
  // Form state - Book Context
  const bookContext = book.settings.bookContext || DEFAULT_BOOK_CONTEXT;
  const [genre, setGenre] = useState(bookContext.genre);
  const [customGenre, setCustomGenre] = useState(GENRE_OPTIONS.includes(bookContext.genre) ? '' : bookContext.genre);
  const [subGenres, setSubGenres] = useState<string[]>(bookContext.subGenres || []);
  const [targetDemographic, setTargetDemographic] = useState(bookContext.targetDemographic);
  const [timePeriod, setTimePeriod] = useState(bookContext.timePeriod);
  const [customTimePeriod, setCustomTimePeriod] = useState(TIME_PERIOD_OPTIONS.includes(bookContext.timePeriod) ? '' : bookContext.timePeriod);
  const [year, setYear] = useState(bookContext.year || '');
  const [primaryLocation, setPrimaryLocation] = useState(bookContext.primaryLocation);
  const [additionalContext, setAdditionalContext] = useState(bookContext.additionalContext);
  
  // Form state - Page
  const [pageSize, setPageSize] = useState(book.settings.pageSize);
  const [margins, setMargins] = useState(book.settings.margins);
  const [lineSpacing, setLineSpacing] = useState(book.settings.lineSpacing);
  const [paragraphSpacing, setParagraphSpacing] = useState(book.settings.paragraphSpacing || 0);
  
  // Form state - Fonts
  const [titleFont, setTitleFont] = useState(book.settings.titleFont || 'Carlito');
  const [titleFontSize, setTitleFontSize] = useState(book.settings.titleFontSize || 24);
  const [bodyFont, setBodyFont] = useState(book.settings.bodyFont || book.settings.defaultFont || 'Carlito');
  const [bodyFontSize, setBodyFontSize] = useState(book.settings.bodyFontSize || book.settings.defaultFontSize || 12);
  
  // Form state - API
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-5.2');
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  
  // Helper to toggle sub-genre
  const toggleSubGenre = (subGenre: string) => {
    if (subGenres.includes(subGenre)) {
      setSubGenres(subGenres.filter(sg => sg !== subGenre));
    } else {
      setSubGenres([...subGenres, subGenre]);
    }
  };

  const AI_MODELS = [
    { value: 'gpt-5.2', label: 'GPT-5.2 (Latest, most capable)' },
    { value: 'gpt-4o', label: 'GPT-4o (Best quality, slower)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast, good quality)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (High quality)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fastest, cheapest)' },
    { value: 'o1-preview', label: 'o1-preview (Reasoning, expensive)' },
    { value: 'o1-mini', label: 'o1-mini (Reasoning, affordable)' },
  ];

  // Load API key and model from electron store or localStorage
  useEffect(() => {
    const loadSettings = async () => {
      // Check if running in Electron
      const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
      
      if (!isElectron) {
        // Browser mode: use localStorage
        const key = localStorage.getItem('openai-api-key');
        const model = localStorage.getItem('openai-model');
        if (key) {
          setApiKey(key);
        }
        if (model) {
          setAiModel(model);
        }
        setApiKeyLoaded(true);
        return;
      }
      
      try {
        const key = await window.electronAPI.storeGet('openai-api-key');
        const model = await window.electronAPI.storeGet('openai-model');
        if (key) {
          setApiKey(key as string);
        }
        if (model) {
          setAiModel(model as string);
        }
        setApiKeyLoaded(true);
      } catch (error) {
        console.error('Failed to load API settings:', error);
        setApiKeyLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    // Determine final genre and time period (use custom if "Other" selected)
    const finalGenre = genre === 'Other' ? customGenre : genre;
    const finalTimePeriod = timePeriod === 'Other' ? customTimePeriod : timePeriod;
    
    // Build book context settings
    const newBookContext: BookContextSettings = {
      genre: finalGenre,
      subGenres,
      targetDemographic,
      timePeriod: finalTimePeriod,
      year: year.trim() || undefined,
      primaryLocation,
      additionalContext,
    };
    
    // Save book metadata
    updateBookMetadata({
      title,
      author,
      description,
      settings: {
        ...book.settings,
        pageSize,
        margins,
        titleFont,
        titleFontSize,
        bodyFont,
        bodyFontSize,
        defaultFont: bodyFont,
        defaultFontSize: bodyFontSize,
        lineSpacing,
        paragraphSpacing,
        bookContext: newBookContext,
      },
    });

    // Save API key and model
    if (apiKeyLoaded) {
      const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
      
      if (!isElectron) {
        // Browser mode: use localStorage
        localStorage.setItem('openai-api-key', apiKey);
        localStorage.setItem('openai-model', aiModel);
      } else {
        try {
          await window.electronAPI.storeSet('openai-api-key', apiKey);
          await window.electronAPI.storeSet('openai-model', aiModel);
        } catch (error) {
          console.error('Failed to save API settings:', error);
        }
      }
      
      // Notify openaiService of model change
      window.dispatchEvent(new CustomEvent('openai-model-changed', { detail: { model: aiModel } }));
    }

    onClose();
  };

  const handlePageSizeChange = (name: string) => {
    const size = PAGE_SIZES.find((s) => s.name === name);
    if (size) {
      setPageSize(size);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog" style={{ width: '550px' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Settings</h2>
          <button className="dialog-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="dialog-tabs" style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)',
          padding: '0 20px',
        }}>
          {(['general', 'context', 'fonts', 'page', 'api'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                marginBottom: '-1px',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'api' ? 'API Keys' : tab === 'context' ? 'Book Context' : tab}
            </button>
          ))}
        </div>

        <div className="dialog-content">
          {activeTab === 'general' && (
            <>
              <div className="form-group">
                <label className="form-label">Book Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter book title"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Author</label>
                <input
                  type="text"
                  className="form-input"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Enter author name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter book description"
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Content editor theme</label>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Choose how the chapter editing area (the page) looks. Light shows a white page; Dark shows a dark page to match the app.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="contentEditorTheme"
                      value="light"
                      checked={ui.contentEditorTheme === 'light'}
                      onChange={() => setContentEditorTheme('light')}
                    />
                    <span>Light (white page)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="contentEditorTheme"
                      value="dark"
                      checked={ui.contentEditorTheme === 'dark'}
                      onChange={() => setContentEditorTheme('dark')}
                    />
                    <span>Dark (dark page)</span>
                  </label>
                </div>
              </div>

              {/* Google Docs Source Info */}
              {book.metadata.googleDocsSource && (
                <div style={{ 
                  marginTop: '20px',
                  padding: '16px',
                  background: 'var(--bg-input)',
                  borderRadius: '8px',
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>Google Docs Source</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Document:</span>{' '}
                      <strong>{book.metadata.googleDocsSource.documentName}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Last imported: {new Date(book.metadata.googleDocsSource.lastImported).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Google Docs Export Info */}
              {book.metadata.googleDocsExport && (
                <div style={{ 
                  marginTop: '20px',
                  padding: '16px',
                  background: 'var(--bg-input)',
                  borderRadius: '8px',
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>Google Docs Export</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Document:</span>{' '}
                      <strong>{book.metadata.googleDocsExport.documentName}</strong>
                    </div>
                    {book.metadata.googleDocsExport.folderPath && (
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Location:</span>{' '}
                        {book.metadata.googleDocsExport.folderPath}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Last exported: {new Date(book.metadata.googleDocsExport.lastExported).toLocaleString()}
                    </div>
                    <a 
                      href={book.metadata.googleDocsExport.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ 
                        fontSize: '12px', 
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      Open in Google Docs →
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'context' && (
            <>
              <div style={{ 
                padding: '12px 16px', 
                background: 'var(--bg-input)', 
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                These settings help the AI understand your book's context, ensuring variations and generated content match your genre, audience, and setting.
              </div>

              {/* Genre */}
              <div className="form-group">
                <label className="form-label">Genre</label>
                <select
                  className="form-input"
                  value={GENRE_OPTIONS.includes(genre) ? genre : 'Other'}
                  onChange={(e) => {
                    setGenre(e.target.value);
                    if (e.target.value !== 'Other') {
                      setCustomGenre('');
                    }
                  }}
                >
                  <option value="">Select a genre...</option>
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {(genre === 'Other' || (!GENRE_OPTIONS.includes(genre) && genre)) && (
                  <input
                    type="text"
                    className="form-input"
                    value={customGenre || (GENRE_OPTIONS.includes(genre) ? '' : genre)}
                    onChange={(e) => setCustomGenre(e.target.value)}
                    placeholder="Enter custom genre..."
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>

              {/* Sub-genres */}
              <div className="form-group">
                <label className="form-label">Sub-genres (optional)</label>
                <div className="sub-genre-tags">
                  {SUB_GENRE_OPTIONS.map((sg) => (
                    <button
                      key={sg}
                      type="button"
                      onClick={() => toggleSubGenre(sg)}
                      className={`sub-genre-tag ${subGenres.includes(sg) ? 'selected' : ''}`}
                    >
                      {sg}
                    </button>
                  ))}
                </div>
                {subGenres.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Selected: {subGenres.join(', ')}
                  </div>
                )}
              </div>

              {/* Target Demographic */}
              <div className="form-group">
                <label className="form-label">Target Audience</label>
                <select
                  className="form-input"
                  value={targetDemographic}
                  onChange={(e) => setTargetDemographic(e.target.value)}
                >
                  <option value="">Select target audience...</option>
                  {DEMOGRAPHIC_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Time Period */}
              <div className="form-group">
                <label className="form-label">Time Period</label>
                <select
                  className="form-input"
                  value={TIME_PERIOD_OPTIONS.includes(timePeriod) ? timePeriod : 'Other'}
                  onChange={(e) => {
                    setTimePeriod(e.target.value);
                    if (e.target.value !== 'Other') {
                      setCustomTimePeriod('');
                    }
                  }}
                >
                  <option value="">Select time period...</option>
                  {TIME_PERIOD_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {(timePeriod === 'Other' || (!TIME_PERIOD_OPTIONS.includes(timePeriod) && timePeriod)) && (
                  <input
                    type="text"
                    className="form-input"
                    value={customTimePeriod || (TIME_PERIOD_OPTIONS.includes(timePeriod) ? '' : timePeriod)}
                    onChange={(e) => setCustomTimePeriod(e.target.value)}
                    placeholder="Enter custom time period..."
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>

              {/* Year */}
              <div className="form-group">
                <label className="form-label">Year / Time Setting</label>
                <input
                  type="text"
                  className="form-input"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g., 1985, 2023, 1776-1783, Spring 1985"
                />
                <p className="form-hint">
                  Specific year or year range when the story takes place. This helps with timeline accuracy and historical context.
                </p>
              </div>

              {/* Primary Location */}
              <div className="form-group">
                <label className="form-label">Primary Location / Setting</label>
                <input
                  type="text"
                  className="form-input"
                  value={primaryLocation}
                  onChange={(e) => setPrimaryLocation(e.target.value)}
                  placeholder="e.g., Boston, Massachusetts or Rural England"
                />
                <p className="form-hint">
                  Where does most of your story take place?
                </p>
              </div>

              {/* Additional Context */}
              <div className="form-group">
                <label className="form-label">Additional Style Notes (optional)</label>
                <textarea
                  className="form-input"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="e.g., Dark and atmospheric tone, unreliable narrator, multiple POV, Southern Gothic style..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
                <p className="form-hint">
                  Any additional notes about tone, style, themes, or special considerations for the AI.
                </p>
              </div>
            </>
          )}

          {activeTab === 'fonts' && (
            <>
              <div style={{ 
                padding: '12px 16px', 
                background: 'var(--bg-input)', 
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                These fonts will be applied when you click "Format Document" and will be used by the AI when making changes.
              </div>

              {/* Title Font Settings */}
              <div style={{ 
                padding: '16px', 
                background: 'var(--bg-hover)', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                  Chapter Titles / Headings
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Font</label>
                    <select
                      className="form-input"
                      value={titleFont}
                      onChange={(e) => setTitleFont(e.target.value)}
                      style={{ fontFamily: titleFont }}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Size (pt)</label>
                    <select
                      className="form-input"
                      value={titleFontSize}
                      onChange={(e) => setTitleFontSize(parseInt(e.target.value))}
                    >
                      {FONT_SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  background: 'var(--bg-page)', 
                  borderRadius: '4px',
                  color: 'var(--text-on-page)',
                  fontFamily: titleFont,
                  fontSize: `${Math.min(titleFontSize, 28)}px`
                }}>
                  Chapter 1
                </div>
              </div>

              {/* Body Font Settings */}
              <div style={{ 
                padding: '16px', 
                background: 'var(--bg-hover)', 
                borderRadius: '8px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                  Body Text
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Font</label>
                    <select
                      className="form-input"
                      value={bodyFont}
                      onChange={(e) => setBodyFont(e.target.value)}
                      style={{ fontFamily: bodyFont }}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Size (pt)</label>
                    <select
                      className="form-input"
                      value={bodyFontSize}
                      onChange={(e) => setBodyFontSize(parseInt(e.target.value))}
                    >
                      {FONT_SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  background: 'var(--bg-page)', 
                  borderRadius: '4px',
                  color: 'var(--text-on-page)',
                  fontFamily: bodyFont,
                  fontSize: `${bodyFontSize}px`,
                  lineHeight: 1.6
                }}>
                  The quick brown fox jumps over the lazy dog. This is sample body text showing how your chapters will look.
                </div>
              </div>
            </>
          )}

          {activeTab === 'page' && (
            <>
              <div className="form-group">
                <label className="form-label">Page Size</label>
                <select
                  className="form-input"
                  value={pageSize.name}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size.name} value={size.name}>
                      {size.name} ({size.width}" × {size.height}")
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Margins (inches)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Top</label>
                    <input
                      type="number"
                      className="form-input"
                      value={margins.top}
                      onChange={(e) => setMargins({ ...margins, top: parseFloat(e.target.value) || 0 })}
                      step="0.125"
                      min="0"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bottom</label>
                    <input
                      type="number"
                      className="form-input"
                      value={margins.bottom}
                      onChange={(e) => setMargins({ ...margins, bottom: parseFloat(e.target.value) || 0 })}
                      step="0.125"
                      min="0"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Left</label>
                    <input
                      type="number"
                      className="form-input"
                      value={margins.left}
                      onChange={(e) => setMargins({ ...margins, left: parseFloat(e.target.value) || 0 })}
                      step="0.125"
                      min="0"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Right</label>
                    <input
                      type="number"
                      className="form-input"
                      value={margins.right}
                      onChange={(e) => setMargins({ ...margins, right: parseFloat(e.target.value) || 0 })}
                      step="0.125"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Line Spacing</label>
                <select
                  className="form-input"
                  value={lineSpacing}
                  onChange={(e) => setLineSpacing(parseFloat(e.target.value))}
                >
                  <option value="1">Single</option>
                  <option value="1.15">1.15</option>
                  <option value="1.5">1.5</option>
                  <option value="2">Double</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Paragraph Spacing (em)</label>
                <input
                  type="number"
                  className="form-input"
                  value={paragraphSpacing}
                  onChange={(e) => setParagraphSpacing(parseFloat(e.target.value) || 0)}
                  step="0.1"
                  min="0"
                  max="2"
                />
                <p className="form-hint">
                  Space between paragraphs. 0 = no spacing (uses text indent), 0.5+ = spacing between paragraphs (no indent).
                </p>
              </div>
            </>
          )}

          {activeTab === 'api' && (
            <>
              <div className="form-group">
                <label className="form-label">OpenAI API Key</label>
                <input
                  type="password"
                  className="form-input"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <p className="form-hint">
                  Your API key is stored locally and never sent anywhere except OpenAI.
                  Get your API key from{' '}
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      // Open external link would go here
                    }}
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">AI Model</label>
                <select
                  className="form-select"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                >
                  {AI_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="form-hint">
                  {aiModel === 'gpt-5.2' && '✨ Latest and most capable model. Best for complex writing tasks.'}
                  {aiModel === 'gpt-4o' && '🌟 Best quality for complex edits and analysis. ~$5/1M tokens.'}
                  {aiModel === 'gpt-4o-mini' && '⚡ Good balance of speed and quality. ~$0.15/1M tokens.'}
                  {aiModel === 'gpt-4-turbo' && '💪 High quality with 128k context. ~$10/1M tokens.'}
                  {aiModel === 'gpt-3.5-turbo' && '🚀 Fastest and cheapest, but less capable. ~$0.50/1M tokens.'}
                  {aiModel === 'o1-preview' && '🧠 Advanced reasoning for complex analysis. ~$15/1M tokens.'}
                  {aiModel === 'o1-mini' && '🧠 Reasoning model, more affordable. ~$3/1M tokens.'}
                </p>
              </div>

              <div style={{ 
                padding: '16px', 
                background: 'var(--bg-input)', 
                borderRadius: '8px',
                marginTop: '16px'
              }}>
                <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>AI Features</h4>
                <ul style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  paddingLeft: '16px',
                  margin: 0
                }}>
                  <li>Chapter summarization</li>
                  <li>Grammar and style checking</li>
                  <li>Character, location, and timeline extraction</li>
                  <li>Content flow analysis</li>
                  <li>AI Chat assistant with editing</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
