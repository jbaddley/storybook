import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import { useBookStore } from '../stores/bookStore';
import { TipTapContent, TipTapNode, DEFAULT_TIPTAP_CONTENT, ChapterComment, ChapterVariation } from '../../shared/types';
import { Extension } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { SearchDialog } from './SearchDialog';
import { CommentMark } from '../extensions/CommentMark';

/** Block tags we map to editor nodes; div/span/blockquote/ul/ol are unwrapped (not emitted as nodes). */
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre']);

type BlockDesc = { tagName: string; textContent: string };

/**
 * Recursively collect block nodes from HTML, unwrapping wrapper divs (and blockquote/ul/ol).
 * Returns a flat list of { tagName, textContent } in document order – no wrapper divs.
 */
function collectBlocksFromElement(el: Element): BlockDesc[] {
  const tag = el.tagName?.toLowerCase();
  const blocks: BlockDesc[] = [];

  if (BLOCK_TAGS.has(tag)) {
    const textContent = (el.textContent || '').trim();
    blocks.push({ tagName: tag, textContent });
    return blocks;
  }

  // Unwrap: div, span, blockquote, ul, ol, etc. – process children only
  for (let i = 0; i < el.children.length; i++) {
    blocks.push(...collectBlocksFromElement(el.children[i]));
  }
  // Bare text inside a wrapper (e.g. div with no child blocks) – treat as one paragraph
  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => (n.textContent || '').trim())
    .filter(Boolean)
    .join(' ');
  if (directText && blocks.length === 0) {
    blocks.push({ tagName: 'p', textContent: directText });
  }
  return blocks;
}

/** Parse HTML into a flat list of blocks with wrapper divs (and similar) stripped. */
function parseHtmlToBlocks(html: string): BlockDesc[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const blocks: BlockDesc[] = [];
  for (let i = 0; i < div.children.length; i++) {
    blocks.push(...collectBlocksFromElement(div.children[i]));
  }
  return blocks;
}

/** Build nodes from html/plain and insert at current selection (used when Electron clipboard has no image). */
function doHtmlOrPlainPaste(view: any, schema: any, html: string, plain: string): void {
  const nodes: any[] = [];
  if (html) {
    const blocks = parseHtmlToBlocks(html);
    for (const block of blocks) {
      const text = block.textContent.trim();
      if (block.tagName === 'p') {
        nodes.push(text ? schema.nodes.paragraph.create(null, schema.text(text)) : schema.nodes.paragraph.create());
      } else if (/^h[1-6]$/.test(block.tagName)) {
        const level = parseInt(block.tagName.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
        nodes.push(text ? schema.nodes.heading.create({ level }, schema.text(text)) : schema.nodes.heading.create({ level }));
      } else if (block.tagName === 'pre' && schema.nodes.codeBlock) {
        nodes.push(schema.nodes.codeBlock.create(null, schema.text(text || '')));
      } else {
        nodes.push(text ? schema.nodes.paragraph.create(null, schema.text(text)) : schema.nodes.paragraph.create());
      }
    }
  }
  if (nodes.length === 0 && plain) {
    const paragraphs = plain.split(/\r?\n/);
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraphText = paragraphs[i];
      if (paragraphText.length > 0) {
        nodes.push(schema.nodes.paragraph.create(null, schema.text(paragraphText)));
      } else if (i > 0 && i < paragraphs.length - 1) {
        nodes.push(schema.nodes.paragraph.create());
      }
    }
  }
  if (nodes.length > 0) {
    const fragment = Fragment.from(nodes);
    const tr = view.state.tr.replaceSelection(new Slice(fragment, 0, 0));
    view.dispatch(tr);
  }
}

/** Node types we keep as-is; others (blockquote, bulletList, etc.) are unwrapped to their inner blocks. */
const PLAIN_BLOCK_TYPES = new Set(['paragraph', 'heading', 'codeBlock', 'code_block']);

/**
 * Normalize TipTap content: unwrap blockquote, bulletList, orderedList and any styled wrappers
 * into plain paragraphs/headings so no pasted styling (grey block, indentation) remains.
 */
function normalizeContent(content: TipTapContent): TipTapContent {
  if (!content?.content?.length) return content;

  function flatten(nodes: TipTapNode[]): TipTapNode[] {
    const out: TipTapNode[] = [];
    for (const node of nodes) {
      if (PLAIN_BLOCK_TYPES.has(node.type)) {
        out.push(node);
      } else if (node.content?.length) {
        // blockquote, bulletList, orderedList, listItem, etc. – unwrap and flatten
        out.push(...flatten(node.content));
      } else if (node.type === 'listItem') {
        out.push(...flatten(node.content || []));
      } else {
        // unknown block – treat as empty paragraph so we don't drop structure
        out.push({ type: 'paragraph', content: [] });
      }
    }
    return out;
  }

  return {
    type: 'doc',
    content: flatten(content.content),
  };
}

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

/** Get the sentence containing the cursor (or selection) in the editor. */
function getSentenceAtCursor(editor: { state: { selection: { from: number }; doc: { content: { size: number }; textBetween: (from: number, to: number, sep: string) => string; resolve: (pos: number) => { before: (depth: number) => number; after: (depth: number) => number; depth: number } } } }): string | null {
  const { state } = editor;
  const { from } = state.selection;
  const doc = state.doc;
  if (!doc.content || doc.content.size === 0) return null;
  const $from = doc.resolve(from);
  const depth = $from.depth;
  const blockStart = $from.before(depth) + 1;
  const blockEnd = $from.after(depth) - 1;
  if (blockEnd <= blockStart) return null;
  const blockText = doc.textBetween(blockStart, blockEnd, ' ');
  if (!blockText.trim()) return null;
  const charOffsetInBlock = doc.textBetween(blockStart, from, ' ').length;
  let start = 0;
  let end = blockText.length;
  const re = /[.!?]+[\s\n]*/g;
  let match;
  while ((match = re.exec(blockText)) !== null) {
    if (match.index + match[0].length <= charOffsetInBlock) start = match.index + match[0].length;
    if (match.index > charOffsetInBlock && end > match.index) end = match.index;
  }
  const sentence = blockText.slice(start, end).trim();
  return sentence || null;
}

export const Editor: React.FC = () => {
  const { 
    activeChapterId, 
    updateChapterContent, 
    ui,
    book,
    applyVariation,
    discardVariation,
    restoreOriginal,
    clearOriginal,
    hasOriginal,
    setChatInputPreFill,
    setAIPanelTab,
    setPanelSettings,
  } = useBookStore();

  // Get active chapter reactively from the store
  const activeChapter = useMemo(() => {
    return book.chapters.find(c => c.id === activeChapterId);
  }, [book.chapters, activeChapterId]);

  // Get the chapter number (1-based, sorted by order)
  const chapterNumber = useMemo(() => {
    if (!activeChapter) return 0;
    const sortedChapters = [...book.chapters].sort((a, b) => a.order - b.order);
    return sortedChapters.findIndex(c => c.id === activeChapterId) + 1;
  }, [book.chapters, activeChapterId, activeChapter]);
  
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [viewingVariation, setViewingVariation] = useState(false);
  
  // Use ref to track viewingVariation for use in callbacks without stale closures
  const viewingVariationRef = useRef(viewingVariation);
  useEffect(() => {
    viewingVariationRef.current = viewingVariation;
  }, [viewingVariation]);
  
  // Store the last content we programmatically set to detect if onUpdate is from our own setContent
  // This prevents infinite loops when the effect sets content and onUpdate fires
  const lastSetContentRef = useRef<string | null>(null);

  // Check if chapter has a pending variation (in-dialog draft)
  const pendingVariation = useBookStore((s) => (activeChapterId ? s.pendingChapterVariation[activeChapterId] : undefined));
  const hasVariation = pendingVariation !== undefined;
  
  // Check if chapter has stored original content (from a previously applied variation)
  const hasStoredOriginal = activeChapter?.originalContent !== undefined;

  // Reset view mode when switching chapters
  useEffect(() => {
    setViewingVariation(false);
  }, [activeChapterId]);

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

  // Pending context menu: sentence + coords from last right-click in editor; consumed when main sends spell data (editor-context-menu-show)
  const contextMenuPendingRef = useRef<{ sentence: string; x: number; y: number } | null>(null);

  // When main sends spell params (after context-menu), send build with our pending sentence + coords so main can show native menu
  useEffect(() => {
    const api = window.electronAPI;
    const unsubscribe = api?.onEditorContextMenuShow?.((spellData: { x: number; y: number; misspelledWord: string; dictionarySuggestions: string[] }) => {
      const pending = contextMenuPendingRef.current;
      contextMenuPendingRef.current = null;
      if (!pending) return;
      api.sendEditorContextMenuBuild?.({
        sentence: pending.sentence,
        x: pending.x,
        y: pending.y,
        misspelledWord: spellData.misspelledWord || undefined,
        dictionarySuggestions: spellData.dictionarySuggestions?.length ? spellData.dictionarySuggestions : undefined,
      });
    });
    return () => { unsubscribe?.(); };
  }, []);

  // When user chooses "Add to chat" from native context menu: prefill input only (no auto-send) so they can add context
  useEffect(() => {
    const api = window.electronAPI;
    const unsubscribe = api?.onEditorContextMenuAddToChat?.((sentence: string) => {
      if (sentence?.trim()) {
        setChatInputPreFill(sentence.trim());
        setAIPanelTab('chat');
        setPanelSettings({ showAIPanel: true });
      }
    });
    return () => { unsubscribe?.(); };
  }, [setChatInputPreFill, setAIPanelTab, setPanelSettings]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // Disable auto-conversion of "1. " to ordered list so "1. " can be typed as plain text
        orderedList: false,
        // Limit undo history to avoid huge memory use (each step can hold full doc; default 100 is too high)
        history: { depth: 30 },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      CommentMark,
    ],
    content: activeChapter?.content || DEFAULT_TIPTAP_CONTENT,
    editable: true, // Will be updated by effect when viewing variation
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      // Don't save when viewing variation (read-only mode)
      // Use ref to get current value to avoid stale closure
      if (activeChapterId && !viewingVariationRef.current) {
        const raw = editor.getJSON() as TipTapContent;
        const content = normalizeContent(raw);
        const contentStr = JSON.stringify(content);
        const rawStr = JSON.stringify(raw);

        // If normalization stripped blockquote/styling, replace editor content and store immediately
        if (rawStr !== contentStr) {
          lastSetContentRef.current = contentStr;
          const { from, to } = editor.state.selection;
          editor.commands.setContent(content, false);
          const docLength = editor.state.doc.content.size;
          const safeFrom = Math.min(from, docLength);
          const safeTo = Math.min(to, docLength);
          // Avoid jumping to end: if cursor would be at end of doc, put at start instead
          const selFrom = safeFrom >= docLength ? 1 : safeFrom;
          const selTo = safeTo >= docLength ? 1 : safeTo;
          try {
            editor.commands.setTextSelection({ from: selFrom, to: selTo });
          } catch {
            editor.commands.focus('start');
          }
          updateChapterContent(activeChapterId, content);
          return;
        }

        // Skip if this update came from our own programmatic setContent
        if (lastSetContentRef.current && contentStr === lastSetContentRef.current) {
          lastSetContentRef.current = null; // Clear for next real user edit
          return;
        }

        // Only update store if content actually changed from what's stored
        const currentStoreContent = useBookStore.getState().book.chapters.find(c => c.id === activeChapterId)?.content;
        if (contentStr !== JSON.stringify(currentStoreContent)) {
          updateChapterContent(activeChapterId, content);
        }
      }
    },
    editorProps: {
      attributes: {
        class: 'prose-editor',
        'data-placeholder': 'Start writing your chapter here...',
      },
      // Handle Tab key to insert a tab character
      handleKeyDown: (view, event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          const { state, dispatch } = view;
          const { tr } = state;
          // Insert a tab character at the cursor
          tr.insertText('\t');
          dispatch(tr);
          return true;
        }
        return false;
      },
      // Paste: images first (renderer items or Electron system clipboard), then HTML/text.
      handlePaste: (view, event, slice) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const { schema } = view.state;
        const html = clipboardData.getData('text/html');
        const plain = clipboardData.getData('text/plain');

        // 1) Pasted image(s) from clipboardData.items (e.g. copy from browser, some apps)
        const items = clipboardData.items;
        if (items) {
          const imageFiles: File[] = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) imageFiles.push(file);
            }
          }
          if (imageFiles.length > 0 && schema.nodes.image) {
            event.preventDefault();
            const insertOne = (index: number) => {
              if (index >= imageFiles.length) return;
              const file = imageFiles[index];
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                const node = schema.nodes.image.create({ src: dataUrl });
                const { tr } = view.state;
                tr.replaceSelection(new Slice(Fragment.from(node), 0, 0));
                view.dispatch(tr);
                insertOne(index + 1);
              };
              reader.readAsDataURL(file);
            };
            insertOne(0);
            return true;
          }
        }

        // 2) Electron: system clipboard often has image when paste event has none – check main process
        const electronAPI = typeof window !== 'undefined' && (window as any).electronAPI;
        if (electronAPI?.clipboardReadImage && schema.nodes.image) {
          event.preventDefault();
          // Try reading image first; on success insert via current editor (not stale view)
          electronAPI.clipboardReadImage().then((dataUrl: string | null) => {
            if (dataUrl) {
              const editor = (window as any).__tiptapEditor;
              if (editor) {
                editor.chain().focus().setImage({ src: dataUrl }).run();
              } else {
                doHtmlOrPlainPaste(view, schema, html, plain);
              }
            } else {
              doHtmlOrPlainPaste(view, schema, html, plain);
            }
          }).catch(() => {
            doHtmlOrPlainPaste(view, schema, html, plain);
          });
          return true;
        }

        let nodes: any[] = [];

        if (html) {
          // Parse HTML and collect blocks with wrapper divs (and blockquote/ul/ol) unwrapped
          const blocks = parseHtmlToBlocks(html);
          for (const block of blocks) {
            const text = block.textContent.trim();
            if (block.tagName === 'p') {
              nodes.push(text ? schema.nodes.paragraph.create(null, schema.text(text)) : schema.nodes.paragraph.create());
            } else if (/^h[1-6]$/.test(block.tagName)) {
              const level = parseInt(block.tagName.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
              nodes.push(text ? schema.nodes.heading.create({ level }, schema.text(text)) : schema.nodes.heading.create({ level }));
            } else if (block.tagName === 'pre' && schema.nodes.codeBlock) {
              nodes.push(schema.nodes.codeBlock.create(null, schema.text(text || '')));
            } else {
              nodes.push(text ? schema.nodes.paragraph.create(null, schema.text(text)) : schema.nodes.paragraph.create());
            }
          }
        }

        if (nodes.length === 0 && plain) {
          // Fallback: plain text split into paragraphs
          const paragraphs = plain.split(/\r?\n/);
          for (let i = 0; i < paragraphs.length; i++) {
            const paragraphText = paragraphs[i];
            if (paragraphText.length > 0) {
              nodes.push(schema.nodes.paragraph.create(null, schema.text(paragraphText)));
            } else if (i > 0 && i < paragraphs.length - 1) {
              nodes.push(schema.nodes.paragraph.create());
            }
          }
        }

        if (nodes.length === 0) return false;
        
        const fragment = Fragment.from(nodes);
        const { tr } = view.state;
        tr.replaceSelection(new Slice(fragment, 0, 0));
        view.dispatch(tr);
        return true;
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

  // Update editor content when active chapter changes, content is updated externally, or view mode changes
  useEffect(() => {
    if (editor && activeChapter) {
      // Determine which content to display based on viewing mode
      const contentToDisplay = viewingVariation && pendingVariation 
        ? pendingVariation.content 
        : activeChapter.content;
      
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(contentToDisplay);
      
      console.log('[Editor] Checking for content change...');
      console.log('[Editor] Current hash:', currentContent.length, 'chars');
      console.log('[Editor] New hash:', newContent.length, 'chars');
      console.log('[Editor] Same?', currentContent === newContent);
      console.log('[Editor] Viewing variation:', viewingVariation);
      
      if (currentContent !== newContent) {
        console.log('[Editor] ✅ Content changed, updating editor!');
        
        // Store the content we're about to set so onUpdate can detect it's from us
        lastSetContentRef.current = newContent;
        
        // Normalize to strip blockquote/styled wrappers (grey block, indentation from paste)
        const normalized = normalizeContent(contentToDisplay);
        
        // Preserve cursor position when possible; avoid jumping to end
        const { from, to } = editor.state.selection;
        // Set content without adding to undo history to avoid holding full doc per chapter switch (memory bloat)
        const doc = editor.state.schema.nodeFromJSON(normalized);
        const tr = editor.state.tr.replace(0, editor.state.doc.content.size, new Slice(doc.content, 0, 0));
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
        try {
          const docLength = editor.state.doc.content.size;
          const safeFrom = Math.min(from, docLength);
          const safeTo = Math.min(to, docLength);
          const selFrom = safeFrom >= docLength ? 1 : safeFrom;
          const selTo = safeTo >= docLength ? 1 : safeTo;
          editor.commands.setTextSelection({ from: selFrom, to: selTo });
        } catch {
          editor.commands.focus('start');
        }
      }
      
      // Update editable state when view mode changes
      editor.setEditable(!viewingVariation);
    }
  }, [editor, activeChapterId, activeChapter?.content, pendingVariation, viewingVariation]);

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

  // Early return AFTER all hooks have been called
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

  const contentEditorTheme = ui.contentEditorTheme ?? 'light';

  return (
    <div className={`editor-wrapper ${showLineNumbers ? 'show-line-numbers' : ''} ${contentEditorTheme === 'dark' ? 'editor-dark' : ''}`}>
      {/* Dynamic heading styles */}
      <style>{headingStyles}</style>
      
      {/* Search Dialog */}
      <SearchDialog 
        isOpen={showSearch} 
        onClose={() => setShowSearch(false)} 
        editor={editor} 
      />

      {/* Variation Banner */}
      {hasVariation && (
        <div className={`variation-banner ${viewingVariation ? 'viewing-variation' : ''}`}>
          <div className="variation-banner-content">
            <div className="variation-banner-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
              </svg>
              <span>
                {viewingVariation 
                  ? 'Viewing variation preview (read-only)' 
                  : 'This chapter has a generated variation'}
              </span>
              {pendingVariation && (
                <span className="variation-meta">
                  • {pendingVariation.wordCount} words
                  • Generated {new Date(pendingVariation.generatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="variation-banner-actions">
              <button
                className={`variation-toggle-btn ${viewingVariation ? '' : 'active'}`}
                onClick={() => setViewingVariation(false)}
              >
                Original
              </button>
              <button
                className={`variation-toggle-btn ${viewingVariation ? 'active' : ''}`}
                onClick={() => setViewingVariation(true)}
              >
                Variation
              </button>
              <div className="variation-banner-divider" />
              <button
                className="variation-apply-btn"
                onClick={() => {
                  if (confirm('Apply this variation? Your original content will be saved and can be restored later.')) {
                    applyVariation(activeChapterId!);
                    setViewingVariation(false);
                  }
                }}
              >
                Apply
              </button>
              <button
                className="variation-discard-btn"
                onClick={() => {
                  if (confirm('Discard this variation?')) {
                    discardVariation(activeChapterId!);
                    setViewingVariation(false);
                  }
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Original Content Banner - shows when a variation has been applied but original is saved */}
      {hasStoredOriginal && !hasVariation && (
        <div className="original-content-banner">
          <div className="original-banner-content">
            <div className="original-banner-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              <span>Original content saved</span>
              <span className="original-meta">
                • {activeChapter?.originalWordCount || 0} words
                {activeChapter?.variationAppliedAt && (
                  <> • Variation applied {new Date(activeChapter.variationAppliedAt).toLocaleDateString()}</>
                )}
              </span>
            </div>
            <div className="original-banner-actions">
              <button
                className="original-restore-btn"
                onClick={() => {
                  if (confirm('Restore the original content? This will replace the current (variation) content.')) {
                    restoreOriginal(activeChapterId!);
                  }
                }}
              >
                Restore Original
              </button>
              <button
                className="original-keep-btn"
                onClick={() => {
                  if (confirm('Keep the current variation and discard the saved original? This cannot be undone.')) {
                    clearOriginal(activeChapterId!);
                  }
                }}
              >
                Keep Variation
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="editor-scroll-area">
        <div 
          className="page-container"
          style={{
            paddingTop: `${40 * (ui.zoom / 100)}px`,
            paddingBottom: `${80 * (ui.zoom / 100)}px`,
          }}
        >
          <div
            className={`page ${showLineNumbers ? 'with-line-numbers' : ''}`}
            style={
              showLineNumbers
                ? {
                    ...pageStyle,
                    paddingLeft: `${((book.settings.margins?.left ?? 1) * 96) + 60}px`,
                  }
                : pageStyle
            }
            onClick={handlePageClick}
            onContextMenu={(e) => {
              if (!(e.target as HTMLElement).closest?.('.ProseMirror')) return;
              if (!editor) return;
              // Store sentence + coords; do not preventDefault so main receives context-menu and sends spell data (editor-context-menu-show)
              const sentence = getSentenceAtCursor(editor) ?? '';
              contextMenuPendingRef.current = { sentence, x: e.clientX, y: e.clientY };
            }}
          >
            {/* Chapter Number Badge - shows current chapter number */}
            <div 
              className="chapter-number-badge" 
              onClick={(e) => e.stopPropagation()}
              style={{
                textAlign: 'center',
                marginBottom: '16px',
                fontFamily: book.settings.titleFont || 'Carlito',
                fontSize: '12pt',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '3px',
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              Chapter {chapterNumber}
            </div>
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

.page .ProseMirror,
.page .prose-editor {
  min-height: 100%;
  outline: none;
  max-width: 100%;
  overflow-wrap: break-word;
  word-break: break-word;
  box-sizing: border-box;
}

/* Constrain wrapper divs (e.g. from paste) so they don't cause horizontal scroll */
.page .ProseMirror > div,
.page .prose-editor > div {
  max-width: 100%;
  box-sizing: border-box;
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

.page .ProseMirror img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
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

/* Line numbers using CSS counters - purely cosmetic, no layout shift */
.page-container {
  display: flex;
  justify-content: center;
  min-height: 100%;
}

/* When line numbers are enabled - match both ProseMirror (TipTap default) and prose-editor (our class) */
.editor-wrapper.show-line-numbers .page .ProseMirror,
.editor-wrapper.show-line-numbers .page .prose-editor {
  counter-reset: line-number;
}

/* Any block at any depth under the editor gets a line number */
.editor-wrapper.show-line-numbers .page .ProseMirror p,
.editor-wrapper.show-line-numbers .page .ProseMirror h1,
.editor-wrapper.show-line-numbers .page .ProseMirror h2,
.editor-wrapper.show-line-numbers .page .ProseMirror h3,
.editor-wrapper.show-line-numbers .page .ProseMirror h4,
.editor-wrapper.show-line-numbers .page .ProseMirror h5,
.editor-wrapper.show-line-numbers .page .ProseMirror h6,
.editor-wrapper.show-line-numbers .page .ProseMirror blockquote,
.editor-wrapper.show-line-numbers .page .ProseMirror ul,
.editor-wrapper.show-line-numbers .page .ProseMirror ol,
.editor-wrapper.show-line-numbers .page .ProseMirror pre,
.editor-wrapper.show-line-numbers .page .prose-editor p,
.editor-wrapper.show-line-numbers .page .prose-editor h1,
.editor-wrapper.show-line-numbers .page .prose-editor h2,
.editor-wrapper.show-line-numbers .page .prose-editor h3,
.editor-wrapper.show-line-numbers .page .prose-editor h4,
.editor-wrapper.show-line-numbers .page .prose-editor h5,
.editor-wrapper.show-line-numbers .page .prose-editor h6,
.editor-wrapper.show-line-numbers .page .prose-editor blockquote,
.editor-wrapper.show-line-numbers .page .prose-editor ul,
.editor-wrapper.show-line-numbers .page .prose-editor ol,
.editor-wrapper.show-line-numbers .page .prose-editor pre {
  counter-increment: line-number;
  position: relative;
}

/* Line numbers in left gutter */
.editor-wrapper.show-line-numbers .page .ProseMirror p::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h1::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h2::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h3::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h4::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h5::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h6::before,
.editor-wrapper.show-line-numbers .page .ProseMirror blockquote::before,
.editor-wrapper.show-line-numbers .page .ProseMirror ul::before,
.editor-wrapper.show-line-numbers .page .ProseMirror ol::before,
.editor-wrapper.show-line-numbers .page .ProseMirror pre::before,
.editor-wrapper.show-line-numbers .page .prose-editor p::before,
.editor-wrapper.show-line-numbers .page .prose-editor h1::before,
.editor-wrapper.show-line-numbers .page .prose-editor h2::before,
.editor-wrapper.show-line-numbers .page .prose-editor h3::before,
.editor-wrapper.show-line-numbers .page .prose-editor h4::before,
.editor-wrapper.show-line-numbers .page .prose-editor h5::before,
.editor-wrapper.show-line-numbers .page .prose-editor h6::before,
.editor-wrapper.show-line-numbers .page .prose-editor blockquote::before,
.editor-wrapper.show-line-numbers .page .prose-editor ul::before,
.editor-wrapper.show-line-numbers .page .prose-editor ol::before,
.editor-wrapper.show-line-numbers .page .prose-editor pre::before {
  content: counter(line-number);
  position: absolute;
  left: -55px;
  width: 45px;
  text-align: right;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #6c7086;
  user-select: none;
  pointer-events: none;
  top: 0;
  text-indent: 0;
  display: block;
  white-space: nowrap;
}

.editor-wrapper.show-line-numbers .page .ProseMirror p:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h1:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h2:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h3:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h4:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h5:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror h6:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror blockquote:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror ul:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror ol:hover::before,
.editor-wrapper.show-line-numbers .page .ProseMirror pre:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor p:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor h1:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor h2:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor h3:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor h4:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor h5:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor h6:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor blockquote:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor ul:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor ol:hover::before,
.editor-wrapper.show-line-numbers .page .prose-editor pre:hover::before {
  color: #89b4fa;
}

/* Highlighted line (for AI edits) */
.editor-wrapper.show-line-numbers .page .ProseMirror .line-highlighted::before,
.editor-wrapper.show-line-numbers .page .prose-editor .line-highlighted::before {
  color: #89b4fa !important;
  font-weight: bold;
}

.editor-wrapper.show-line-numbers .page .ProseMirror .line-highlighted,
.editor-wrapper.show-line-numbers .page .prose-editor .line-highlighted {
  background: rgba(137, 180, 250, 0.1);
  border-radius: 2px;
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

/* Dark mode for content editor page */
.editor-wrapper.editor-dark .page {
  --bg-page: #252526;
  --text-on-page: #e4e4e7;
  --text-on-page-muted: #a1a1aa;
  background: var(--bg-page);
  color: var(--text-on-page);
}

.editor-wrapper.editor-dark .page .ProseMirror {
  caret-color: var(--text-on-page);
}

.editor-wrapper.editor-dark .page .ProseMirror h2,
.editor-wrapper.editor-dark .page .prose-editor h2 {
  color: var(--text-on-page-muted);
}

.editor-wrapper.editor-dark .page .ProseMirror h2[style*="text-align: center"],
.editor-wrapper.editor-dark .page .ProseMirror h2[style*="text-align:center"],
.editor-wrapper.editor-dark .page .prose-editor h2[style*="text-align: center"],
.editor-wrapper.editor-dark .page .prose-editor h2[style*="text-align:center"] {
  color: var(--text-on-page-muted);
}

.editor-wrapper.editor-dark .page .prose-editor.ProseMirror:empty::before,
.editor-wrapper.editor-dark .page .prose-editor.ProseMirror > p:only-child:empty::before {
  color: #6b7280;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = editorStyles;
  document.head.appendChild(styleEl);
}

