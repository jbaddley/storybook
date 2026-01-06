import React, { useState, useEffect, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import { useFileOperations } from '../hooks/useFileOperations';
import { SyncStatusIndicator } from './SyncStatusIndicator';

// SVG Icons as components
const Icons = {
  Bold: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
    </svg>
  ),
  Italic: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="4" x2="10" y2="4"/>
      <line x1="14" y1="20" x2="5" y2="20"/>
      <line x1="15" y1="4" x2="9" y2="20"/>
    </svg>
  ),
  Underline: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/>
      <line x1="4" y1="21" x2="20" y2="21"/>
    </svg>
  ),
  Strikethrough: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4H9a3 3 0 0 0-2.83 4"/>
      <path d="M14 12a4 4 0 0 1 0 8H6"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
    </svg>
  ),
  H1: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8"/>
      <path d="M4 18V6"/>
      <path d="M12 18V6"/>
      <path d="M17 10v8"/>
      <path d="M15 10h4"/>
    </svg>
  ),
  H2: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h8"/>
      <path d="M4 18V6"/>
      <path d="M12 18V6"/>
      <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>
    </svg>
  ),
  ListBullet: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="4" cy="6" r="1" fill="currentColor"/>
      <circle cx="4" cy="12" r="1" fill="currentColor"/>
      <circle cx="4" cy="18" r="1" fill="currentColor"/>
    </svg>
  ),
  ListNumber: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="10" y1="6" x2="21" y2="6"/>
      <line x1="10" y1="12" x2="21" y2="12"/>
      <line x1="10" y1="18" x2="21" y2="18"/>
      <path d="M4 6h1v4"/>
      <path d="M4 10h2"/>
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
    </svg>
  ),
  AlignLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="17" y1="10" x2="3" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="17" y1="18" x2="3" y2="18"/>
    </svg>
  ),
  AlignCenter: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="10" x2="6" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="18" y1="18" x2="6" y2="18"/>
    </svg>
  ),
  AlignRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="21" y1="10" x2="7" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="21" y1="18" x2="7" y2="18"/>
    </svg>
  ),
  AlignJustify: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="21" y1="10" x2="3" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="21" y1="18" x2="3" y2="18"/>
    </svg>
  ),
  ZoomIn: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  ZoomOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  Undo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7v6h6"/>
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
    </svg>
  ),
  Redo: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 7v6h-6"/>
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
    </svg>
  ),
  Save: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/>
      <polyline points="7,3 7,8 15,8"/>
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Help: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Import: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Export: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Sync: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.5 2v6h-6"/>
      <path d="M2.5 22v-6h6"/>
      <path d="M2 11.5a10 10 0 0 1 18.8-4.3"/>
      <path d="M22 12.5a10 10 0 0 1-18.8 4.2"/>
    </svg>
  ),
};

interface ToolbarProps {
  editorRef?: React.RefObject<any>;
  onShowShortcuts?: () => void;
  onImportGoogleDocs?: () => void;
  onExportGoogleDocs?: () => void;
  onSyncGoogleDocs?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editorRef, onShowShortcuts, onImportGoogleDocs, onExportGoogleDocs, onSyncGoogleDocs }) => {
  const { ui, book, zoomIn, zoomOut, resetZoom, setSettingsOpen } = useBookStore();
  const { handleSave } = useFileOperations();
  
  // State for current formatting at cursor
  const [currentFont, setCurrentFont] = useState('Times New Roman');
  const [currentSize, setCurrentSize] = useState('12pt');
  const [currentStyle, setCurrentStyle] = useState('normal');
  const [, forceUpdate] = useState(0);

  // Get editor instance from window for formatting commands
  const getEditor = () => (window as any).__tiptapEditor;

  // Get current formatting from editor
  const updateCurrentFormatting = useCallback(() => {
    const editor = getEditor();
    if (!editor) return;

    // Get font family
    const fontFamily = editor.getAttributes('textStyle').fontFamily;
    if (fontFamily) {
      setCurrentFont(fontFamily);
    } else {
      setCurrentFont('Times New Roman');
    }

    // Get font size
    const fontSize = editor.getAttributes('textStyle').fontSize;
    if (fontSize) {
      setCurrentSize(fontSize);
    } else {
      setCurrentSize('12pt');
    }

    // Get text style (heading level)
    if (editor.isActive('heading', { level: 1 })) {
      if (editor.isActive({ textAlign: 'center' })) {
        setCurrentStyle('title');
      } else {
        setCurrentStyle('heading1');
      }
    } else if (editor.isActive('heading', { level: 2 })) {
      if (editor.isActive({ textAlign: 'center' })) {
        setCurrentStyle('subtitle');
      } else {
        setCurrentStyle('heading2');
      }
    } else if (editor.isActive('heading', { level: 3 })) {
      setCurrentStyle('heading3');
    } else {
      setCurrentStyle('normal');
    }
    
    // Force re-render for isActive checks
    forceUpdate(n => n + 1);
  }, []);

  // Listen to editor selection changes
  useEffect(() => {
    const editor = getEditor();
    if (!editor) {
      // Retry after a short delay if editor not ready
      const timeout = setTimeout(() => {
        const e = getEditor();
        if (e) {
          e.on('selectionUpdate', updateCurrentFormatting);
          e.on('transaction', updateCurrentFormatting);
          updateCurrentFormatting();
        }
      }, 500);
      return () => clearTimeout(timeout);
    }

    editor.on('selectionUpdate', updateCurrentFormatting);
    editor.on('transaction', updateCurrentFormatting);
    updateCurrentFormatting();

    return () => {
      editor.off('selectionUpdate', updateCurrentFormatting);
      editor.off('transaction', updateCurrentFormatting);
    };
  }, [updateCurrentFormatting]);

  const formatText = (command: string, value?: any) => {
    const editor = getEditor();
    if (!editor) return;

    switch (command) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'strike':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'heading':
        editor.chain().focus().toggleHeading({ level: value }).run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'alignLeft':
        editor.chain().focus().setTextAlign('left').run();
        break;
      case 'alignCenter':
        editor.chain().focus().setTextAlign('center').run();
        break;
      case 'alignRight':
        editor.chain().focus().setTextAlign('right').run();
        break;
      case 'alignJustify':
        editor.chain().focus().setTextAlign('justify').run();
        break;
      case 'undo':
        editor.chain().focus().undo().run();
        break;
      case 'redo':
        editor.chain().focus().redo().run();
        break;
    }
  };

  // Apply text style (Normal, Title, Subtitle, Headings)
  const applyTextStyle = (style: string) => {
    const editor = getEditor();
    if (!editor) return;

    switch (style) {
      case 'normal':
        // Convert to normal paragraph
        editor.chain().focus().setParagraph().run();
        break;
      case 'title':
        // Title: Large, bold, centered heading 1
        editor.chain().focus()
          .setHeading({ level: 1 })
          .setTextAlign('center')
          .run();
        break;
      case 'subtitle':
        // Subtitle: Smaller, centered heading 2 with muted appearance
        editor.chain().focus()
          .setHeading({ level: 2 })
          .setTextAlign('center')
          .run();
        break;
      case 'heading1':
        editor.chain().focus().setHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().setHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().setHeading({ level: 3 }).run();
        break;
    }
  };


  const isActive = (command: string, value?: any): boolean => {
    const editor = getEditor();
    if (!editor) return false;

    switch (command) {
      case 'bold':
        return editor.isActive('bold');
      case 'italic':
        return editor.isActive('italic');
      case 'underline':
        return editor.isActive('underline');
      case 'strike':
        return editor.isActive('strike');
      case 'heading':
        return editor.isActive('heading', { level: value });
      case 'bulletList':
        return editor.isActive('bulletList');
      case 'orderedList':
        return editor.isActive('orderedList');
      case 'alignLeft':
        return editor.isActive({ textAlign: 'left' });
      case 'alignCenter':
        return editor.isActive({ textAlign: 'center' });
      case 'alignRight':
        return editor.isActive({ textAlign: 'right' });
      case 'alignJustify':
        return editor.isActive({ textAlign: 'justify' });
      default:
        return false;
    }
  };

  return (
    <div className="toolbar no-drag">
      {/* Undo/Redo */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => formatText('undo')}
          title="Undo (Ctrl+Z)"
        >
          <Icons.Undo />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => formatText('redo')}
          title="Redo (Ctrl+Y)"
        >
          <Icons.Redo />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Font selection */}
      <select
        className="toolbar-select"
        style={{ minWidth: '140px' }}
        value={currentFont}
        onChange={(e) => {
          const editor = getEditor();
          if (editor) {
            const { from, to } = editor.state.selection;
            // If no text is selected, apply to whole document
            if (from === to) {
              editor.chain().focus().selectAll().setFontFamily(e.target.value).run();
            } else {
              editor.chain().focus().setFontFamily(e.target.value).run();
            }
            setCurrentFont(e.target.value);
          }
        }}
        title="Font Family"
      >
        <optgroup label="Popular">
          <option value="Carlito">Carlito (like Calibri)</option>
          <option value="Caladea">Caladea (like Cambria)</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
        </optgroup>
        <optgroup label="System Fonts">
          <option value="Comic Sans MS">Comic Sans MS</option>
          <option value="Courier New">Courier New</option>
          <option value="Garamond">Garamond</option>
          <option value="Impact">Impact</option>
          <option value="Palatino">Palatino</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Verdana">Verdana</option>
        </optgroup>
        <optgroup label="Serif">
          <option value="Alegreya">Alegreya</option>
          <option value="Bitter">Bitter</option>
          <option value="Bree Serif">Bree Serif</option>
          <option value="Crimson Text">Crimson Text</option>
          <option value="EB Garamond">EB Garamond</option>
          <option value="Libre Baskerville">Libre Baskerville</option>
          <option value="Lora">Lora</option>
          <option value="Merriweather">Merriweather</option>
          <option value="Noto Serif">Noto Serif</option>
          <option value="Playfair Display">Playfair Display</option>
          <option value="PT Serif">PT Serif</option>
          <option value="Roboto Slab">Roboto Slab</option>
          <option value="Source Serif Pro">Source Serif Pro</option>
          <option value="Spectral">Spectral</option>
        </optgroup>
        <optgroup label="Sans-Serif">
          <option value="Cabin">Cabin</option>
          <option value="Comfortaa">Comfortaa</option>
          <option value="Lato">Lato</option>
          <option value="Lexend">Lexend</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Nunito">Nunito</option>
          <option value="Open Sans">Open Sans</option>
          <option value="Oswald">Oswald</option>
          <option value="Poppins">Poppins</option>
          <option value="Raleway">Raleway</option>
          <option value="Roboto">Roboto</option>
        </optgroup>
        <optgroup label="Handwriting">
          <option value="Caveat">Caveat</option>
          <option value="Lobster">Lobster</option>
        </optgroup>
      </select>

      {/* Font size */}
      <select
        className="toolbar-select"
        style={{ minWidth: '70px' }}
        value={currentSize}
        onChange={(e) => {
          const editor = getEditor();
          if (editor) {
            const { from, to } = editor.state.selection;
            // If no text is selected, apply to whole document
            if (from === to) {
              editor.chain().focus().selectAll().setFontSize(e.target.value).run();
            } else {
              editor.chain().focus().setFontSize(e.target.value).run();
            }
            setCurrentSize(e.target.value);
          }
        }}
        title="Font Size"
      >
        <option value="10pt">10</option>
        <option value="11pt">11</option>
        <option value="12pt">12</option>
        <option value="14pt">14</option>
        <option value="16pt">16</option>
        <option value="18pt">18</option>
        <option value="24pt">24</option>
        <option value="36pt">36</option>
      </select>

      <div className="toolbar-divider" />

      {/* Text formatting */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isActive('bold') ? 'active' : ''}`}
          onClick={() => formatText('bold')}
          title="Bold (Ctrl+B)"
        >
          <Icons.Bold />
        </button>
        <button
          className={`toolbar-btn ${isActive('italic') ? 'active' : ''}`}
          onClick={() => formatText('italic')}
          title="Italic (Ctrl+I)"
        >
          <Icons.Italic />
        </button>
        <button
          className={`toolbar-btn ${isActive('underline') ? 'active' : ''}`}
          onClick={() => formatText('underline')}
          title="Underline (Ctrl+U)"
        >
          <Icons.Underline />
        </button>
        <button
          className={`toolbar-btn ${isActive('strike') ? 'active' : ''}`}
          onClick={() => formatText('strike')}
          title="Strikethrough"
        >
          <Icons.Strikethrough />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Text Styles Dropdown */}
      <select
        className="toolbar-select"
        style={{ minWidth: '120px' }}
        value={currentStyle}
        onChange={(e) => {
          applyTextStyle(e.target.value);
          setCurrentStyle(e.target.value);
        }}
        title="Text Style"
      >
        <option value="normal">Normal text</option>
        <option value="title">Title</option>
        <option value="subtitle">Subtitle</option>
        <option value="heading1">Heading 1</option>
        <option value="heading2">Heading 2</option>
        <option value="heading3">Heading 3</option>
      </select>

      <div className="toolbar-divider" />

      {/* Lists */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isActive('bulletList') ? 'active' : ''}`}
          onClick={() => formatText('bulletList')}
          title="Bullet List"
        >
          <Icons.ListBullet />
        </button>
        <button
          className={`toolbar-btn ${isActive('orderedList') ? 'active' : ''}`}
          onClick={() => formatText('orderedList')}
          title="Numbered List"
        >
          <Icons.ListNumber />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Alignment */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${isActive('alignLeft') ? 'active' : ''}`}
          onClick={() => formatText('alignLeft')}
          title="Align Left"
        >
          <Icons.AlignLeft />
        </button>
        <button
          className={`toolbar-btn ${isActive('alignCenter') ? 'active' : ''}`}
          onClick={() => formatText('alignCenter')}
          title="Align Center"
        >
          <Icons.AlignCenter />
        </button>
        <button
          className={`toolbar-btn ${isActive('alignRight') ? 'active' : ''}`}
          onClick={() => formatText('alignRight')}
          title="Align Right"
        >
          <Icons.AlignRight />
        </button>
        <button
          className={`toolbar-btn ${isActive('alignJustify') ? 'active' : ''}`}
          onClick={() => formatText('alignJustify')}
          title="Justify"
        >
          <Icons.AlignJustify />
        </button>
      </div>

      <div className="toolbar-spacer" />

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button
          className="toolbar-btn"
          onClick={zoomOut}
          title="Zoom Out"
        >
          <Icons.ZoomOut />
        </button>
        <span 
          className="zoom-label" 
          onClick={resetZoom}
          style={{ cursor: 'pointer' }}
          title="Click to reset zoom"
        >
          {ui.zoom}%
        </span>
        <button
          className="toolbar-btn"
          onClick={zoomIn}
          title="Zoom In"
        >
          <Icons.ZoomIn />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Sync Status Indicator */}
      <SyncStatusIndicator />

      {/* Save button */}
      <button
        className="toolbar-btn"
        onClick={handleSave}
        title="Save (Ctrl+S)"
      >
        <Icons.Save />
      </button>

      {/* Import button */}
      {onImportGoogleDocs && (
        <button
          className="toolbar-btn"
          onClick={onImportGoogleDocs}
          title="Import from Google Docs"
        >
          <Icons.Import />
        </button>
      )}

      {/* Export button */}
      {onExportGoogleDocs && (
        <button
          className="toolbar-btn"
          onClick={onExportGoogleDocs}
          title="Export to Google Docs"
        >
          <Icons.Export />
        </button>
      )}

      {/* Sync button - always show if handler is provided */}
      {onSyncGoogleDocs && (
        <button
          className="toolbar-btn"
          onClick={onSyncGoogleDocs}
          title={book.metadata.googleDocsExport 
            ? `Sync with ${book.metadata.googleDocsExport.documentName}` 
            : 'Sync with Google Docs (export first)'}
          style={{ 
            ...((!book.metadata.googleDocsExport) ? { opacity: 0.5 } : {}),
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Icons.Sync />
          <span style={{ fontSize: '11px' }}>Sync</span>
        </button>
      )}

      {/* Settings */}
      <button
        className="toolbar-btn"
        onClick={() => setSettingsOpen(true)}
        title="Settings"
      >
        <Icons.Settings />
      </button>

      {/* Help / Keyboard Shortcuts */}
      {onShowShortcuts && (
        <button
          className="toolbar-btn"
          onClick={onShowShortcuts}
          title="Keyboard Shortcuts (?)"
        >
          <Icons.Help />
        </button>
      )}
    </div>
  );
};

