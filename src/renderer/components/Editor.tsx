import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import { useBookStore } from '../stores/bookStore';
import { TipTapContent, DEFAULT_TIPTAP_CONTENT } from '../../shared/types';
import { Extension } from '@tiptap/core';
import { SearchDialog } from './SearchDialog';

// Custom extension for font size
const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    } as any;
  },
});

export const Editor: React.FC = () => {
  const { 
    activeChapterId, 
    updateChapterContent, 
    ui,
    book 
  } = useBookStore();

  // Get active chapter reactively from the store
  const activeChapter = useMemo(() => {
    return book.chapters.find(c => c.id === activeChapterId);
  }, [book.chapters, activeChapterId]);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Global keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
    ],
    content: activeChapter?.content || DEFAULT_TIPTAP_CONTENT,
    editable: true,
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      if (activeChapterId) {
        const content = editor.getJSON() as TipTapContent;
        updateChapterContent(activeChapterId, content);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose-editor',
        'data-placeholder': 'Start writing your chapter here...',
      },
    },
  });

  // Expose editor globally for toolbar access
  useEffect(() => {
    if (editor) {
      (window as any).__tiptapEditor = editor;
      // Force focus on initial load
      setTimeout(() => {
        if (!editor.isFocused) {
          editor.commands.focus('end');
        }
      }, 100);
    }
    return () => {
      (window as any).__tiptapEditor = null;
    };
  }, [editor]);

  // Listen for edit notifications from the chatbot
  useEffect(() => {
    const handleEditMade = (event: CustomEvent<{ lineNumbers: number[] }>) => {
      setHighlightedLines(event.detail.lineNumbers);
      
      // Add highlight class to paragraphs
      const proseMirror = document.querySelector('.ProseMirror');
      if (proseMirror) {
        // Remove existing highlights
        proseMirror.querySelectorAll('.line-highlighted').forEach(el => {
          el.classList.remove('line-highlighted');
        });
        
        // Add highlights to specific lines
        const children = proseMirror.children;
        event.detail.lineNumbers.forEach(lineNum => {
          if (children[lineNum - 1]) {
            children[lineNum - 1].classList.add('line-highlighted');
          }
        });
      }
      
      // Clear highlights after 5 seconds
      setTimeout(() => {
        setHighlightedLines([]);
        const proseMirror = document.querySelector('.ProseMirror');
        if (proseMirror) {
          proseMirror.querySelectorAll('.line-highlighted').forEach(el => {
            el.classList.remove('line-highlighted');
          });
        }
      }, 5000);
    };
    
    window.addEventListener('editor-edit-made' as any, handleEditMade);
    return () => window.removeEventListener('editor-edit-made' as any, handleEditMade);
  }, []);

  // Update editor content when active chapter changes or content is updated externally
  useEffect(() => {
    if (editor && activeChapter) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(activeChapter.content);
      
      console.log('[Editor] Checking for content change...');
      console.log('[Editor] Current hash:', currentContent.length, 'chars');
      console.log('[Editor] New hash:', newContent.length, 'chars');
      console.log('[Editor] Same?', currentContent === newContent);
      
      if (currentContent !== newContent) {
        console.log('[Editor] ✅ Content changed externally, updating editor!');
        // Preserve cursor position when possible
        const { from, to } = editor.state.selection;
        editor.commands.setContent(activeChapter.content);
        // Try to restore cursor position
        try {
          const docLength = editor.state.doc.content.size;
          const safeFrom = Math.min(from, docLength);
          const safeTo = Math.min(to, docLength);
          editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
        } catch (e) {
          // If cursor restoration fails, just focus at end
          editor.commands.focus('end');
        }
      }
    }
  }, [editor, activeChapterId, activeChapter?.content, activeChapter?.updatedAt]);

  // Page dimensions based on settings
  const pageStyle = useMemo(() => {
    const { pageSize, margins, defaultFont, defaultFontSize, lineSpacing, titleFont, titleFontSize } = book.settings;
    const scale = ui.zoom / 100;
    
    // Convert inches to pixels (96 DPI)
    const pageWidthPx = pageSize.width * 96;
    const pageHeightPx = pageSize.height * 96;
    const marginTopPx = margins.top * 96;
    const marginBottomPx = margins.bottom * 96;
    const marginLeftPx = margins.left * 96;
    const marginRightPx = margins.right * 96;

    return {
      width: `${pageWidthPx}px`,
      minHeight: `${pageHeightPx}px`,
      padding: `${marginTopPx}px ${marginRightPx}px ${marginBottomPx}px ${marginLeftPx}px`,
      fontFamily: defaultFont,
      fontSize: `${defaultFontSize}pt`,
      lineHeight: lineSpacing,
      transform: `scale(${scale})`,
      transformOrigin: 'top center',
      // CSS custom properties for headings
      '--title-font': titleFont || defaultFont,
      '--title-font-size': `${titleFontSize || 24}pt`,
    } as React.CSSProperties;
  }, [book.settings, ui.zoom]);

  if (!activeChapter) {
    return (
      <div className="editor-empty">
        <div className="empty-state">
          <svg 
            className="empty-state-icon" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p className="empty-state-text">Select a chapter to start editing</p>
        </div>
      </div>
    );
  }

  const handlePageClick = useCallback(() => {
    if (editor && !editor.isFocused) {
      editor.commands.focus('end');
    }
  }, [editor]);

  // Dynamic heading styles based on book settings
  const headingStyles = useMemo(() => {
    const { titleFont, titleFontSize } = book.settings;
    const font = titleFont || 'Carlito';
    const size = titleFontSize || 24;
    
    return `
      .page .ProseMirror h1 {
        font-family: "${font}", serif !important;
        font-size: ${size}pt !important;
        font-weight: 700 !important;
      }
      .page .ProseMirror h2 {
        font-family: "${font}", serif !important;
        font-size: ${Math.round(size * 0.85)}pt !important;
        font-weight: 600 !important;
      }
      .page .ProseMirror h3 {
        font-family: "${font}", serif !important;
        font-size: ${Math.round(size * 0.75)}pt !important;
        font-weight: 600 !important;
      }
    `;
  }, [book.settings.titleFont, book.settings.titleFontSize]);

  return (
    <div className={`editor-wrapper ${showLineNumbers ? 'show-line-numbers' : ''}`}>
      {/* Dynamic heading styles */}
      <style>{headingStyles}</style>
      
      {/* Search Dialog */}
      <SearchDialog 
        isOpen={showSearch} 
        onClose={() => setShowSearch(false)} 
        editor={editor} 
      />
      
      <div className="editor-scroll-area">
        <div 
          className="page-container"
          style={{
            paddingTop: `${40 * (ui.zoom / 100)}px`,
            paddingBottom: `${80 * (ui.zoom / 100)}px`,
          }}
        >
          <div className={`page ${showLineNumbers ? 'with-line-numbers' : ''}`} style={pageStyle} onClick={handlePageClick}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      
      {/* Status bar */}
      <div className="editor-status-bar">
        <span>{activeChapter.title}</span>
        <span className="text-muted">•</span>
        <span className="text-muted">{activeChapter.wordCount.toLocaleString()} words</span>
        <span className="text-muted">•</span>
        <span className="text-muted">{book.settings.pageSize.name}</span>
        <div className="status-bar-spacer" />
        <button 
          className={`line-number-toggle ${showLineNumbers ? 'active' : ''}`}
          onClick={() => setShowLineNumbers(!showLineNumbers)}
          title={showLineNumbers ? 'Hide line numbers (Ln)' : 'Show line numbers (Ln)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="4" y2="6.01" />
            <line x1="4" y1="12" x2="4" y2="12.01" />
            <line x1="4" y1="18" x2="4" y2="18.01" />
            <line x1="8" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="20" y2="12" />
            <line x1="8" y1="18" x2="20" y2="18" />
          </svg>
          <span>Ln</span>
        </button>
      </div>
    </div>
  );
};

// Add styles for the editor
const editorStyles = `
.editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.editor-scroll-area {
  flex: 1;
  overflow: auto;
  background: var(--bg-editor);
}

.page-container {
  display: flex;
  justify-content: center;
  min-height: 100%;
}

.page {
  background: var(--bg-page);
  color: var(--text-on-page);
  box-shadow: var(--shadow-lg);
  margin: 0 auto;
  cursor: text;
}

.page .ProseMirror {
  min-height: 100%;
  outline: none;
}

.page .ProseMirror p {
  margin: 0 0 1em 0;
}

.page .ProseMirror h1 {
  font-size: 26pt;
  font-weight: 400;
  margin: 0 0 0.5em 0;
  color: var(--text-on-page);
}

.page .ProseMirror h2 {
  font-size: 16pt;
  font-weight: 400;
  margin: 0 0 1em 0;
  color: #666;
}

.page .ProseMirror h3 {
  font-size: 14pt;
  font-weight: 600;
  margin: 1em 0 0.5em 0;
  color: var(--text-on-page);
}

.page .ProseMirror h4 {
  font-size: 12pt;
  font-weight: 600;
  margin: 1em 0 0.5em 0;
  color: var(--text-on-page);
}

/* Centered headings (Title/Subtitle style) */
.page .ProseMirror h1[style*="text-align: center"],
.page .ProseMirror h1[style*="text-align:center"] {
  font-size: 28pt;
  font-weight: 400;
  margin-bottom: 0.25em;
}

.page .ProseMirror h2[style*="text-align: center"],
.page .ProseMirror h2[style*="text-align:center"] {
  font-size: 14pt;
  font-weight: 400;
  color: #888;
  margin-top: 0;
}

.editor-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--bg-toolbar);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
}

.status-bar-spacer {
  flex: 1;
}

.line-number-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  transition: all 0.15s ease;
}

.line-number-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.line-number-toggle.active {
  background: rgba(137, 180, 250, 0.15);
  color: #89b4fa;
  border-color: #89b4fa;
}

.line-number-toggle svg {
  opacity: 0.7;
}

.line-number-toggle.active svg {
  opacity: 1;
}

/* Line numbers using CSS counters */
.page-container {
  display: flex;
  justify-content: center;
  min-height: 100%;
}

/* When line numbers are enabled - use a gutter approach */
.editor-wrapper.show-line-numbers .page {
  position: relative;
}

.editor-wrapper.show-line-numbers .page .ProseMirror {
  counter-reset: line-number;
  margin-left: 45px;
}

.editor-wrapper.show-line-numbers .page .ProseMirror > p,
.editor-wrapper.show-line-numbers .page .ProseMirror > h1,
.editor-wrapper.show-line-numbers .page .ProseMirror > h2,
.editor-wrapper.show-line-numbers .page .ProseMirror > h3,
.editor-wrapper.show-line-numbers .page .ProseMirror > h4,
.editor-wrapper.show-line-numbers .page .ProseMirror > h5,
.editor-wrapper.show-line-numbers .page .ProseMirror > h6,
.editor-wrapper.show-line-numbers .page .ProseMirror > blockquote,
.editor-wrapper.show-line-numbers .page .ProseMirror > ul,
.editor-wrapper.show-line-numbers .page .ProseMirror > ol,
.editor-wrapper.show-line-numbers .page .ProseMirror > pre {
  counter-increment: line-number;
  position: relative;
}

.editor-wrapper.show-line-numbers .page .ProseMirror > p::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > h1::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > h2::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > h3::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > h4::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > h5::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > h6::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > blockquote::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > ul::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > ol::before,
.editor-wrapper.show-line-numbers .page .ProseMirror > pre::before {
  content: counter(line-number);
  position: absolute;
  left: -45px;
  width: 35px;
  text-align: right;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: inherit;
  color: #6c7086;
  user-select: none;
  pointer-events: none;
  top: 0;
}

.editor-wrapper.show-line-numbers .page .ProseMirror > *:hover::before {
  color: #89b4fa;
}

/* Highlighted line (for AI edits) */
.editor-wrapper.show-line-numbers .page .ProseMirror > .line-highlighted::before {
  color: #89b4fa !important;
  font-weight: bold;
}

.editor-wrapper.show-line-numbers .page .ProseMirror > .line-highlighted {
  background: rgba(137, 180, 250, 0.15);
  margin-left: -8px;
  padding-left: 8px;
  border-radius: 4px;
}

.page.with-line-numbers {
  /* Handled by parent selector */
}

.editor-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.prose-editor {
  min-height: 100%;
  cursor: text;
}

/* Placeholder styling - show when editor is empty */
.prose-editor.ProseMirror:empty::before,
.prose-editor.ProseMirror > p:only-child:empty::before {
  content: attr(data-placeholder);
  color: #adb5bd;
  pointer-events: none;
  font-style: italic;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = editorStyles;
  document.head.appendChild(styleEl);
}

