'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import type { JSONContent } from '@tiptap/core';
import { DocContent } from './tiptap-types';
import { FontSize } from './font-size-extension';

function countWords(json: { content?: Array<{ content?: Array<{ text?: string }> }> }): number {
  let count = 0;
  const walk = (node: unknown) => {
    if (node && typeof node === 'object') {
      if ('text' in node && typeof (node as { text?: string }).text === 'string') {
        const t = (node as { text: string }).text;
        count += t.trim() ? t.trim().split(/\s+/).length : 0;
      }
      if ('content' in node && Array.isArray((node as { content: unknown[] }).content)) {
        (node as { content: unknown[] }).content.forEach(walk);
      }
    }
  };
  walk(json);
  return count;
}

function isEmptyDoc(doc: DocContent): boolean {
  const content = doc?.content;
  if (!Array.isArray(content) || content.length === 0) return true;
  if (content.length === 1) {
    const node = content[0];
    if (node && typeof node === 'object' && (node as { type?: string }).type === 'paragraph') {
      const inner = (node as { content?: unknown[] }).content;
      return !Array.isArray(inner) || inner.length === 0;
    }
  }
  return false;
}

// Marks supported by this editor (desktop may store "comment" and other marks we don't have)
const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline', 'textStyle', 'fontFamily', 'fontSize', 'color', 'link', 'code', 'strike', 'highlight', 'subscript', 'superscript', 'textAlign']);

function sanitizeContent(doc: DocContent): DocContent {
  if (!doc?.content) return doc;
  function sanitizeNode(node: unknown): unknown {
    if (!node || typeof node !== 'object') return node;
    const n = node as { type?: string; content?: unknown[]; marks?: Array<{ type: string }> };
    const out: Record<string, unknown> = { ...n };
    if (Array.isArray(n.marks) && n.marks.length > 0) {
      const allowed = n.marks.filter((m) => m && typeof m === 'object' && ALLOWED_MARKS.has((m as { type?: string }).type));
      out.marks = allowed.length ? allowed : undefined;
    }
    if (Array.isArray(n.content)) {
      out.content = n.content.map(sanitizeNode);
    }
    return out;
  }
  return {
    type: 'doc',
    content: (doc.content as unknown[]).map(sanitizeNode),
  };
}

export function ChapterEditor({
  chapterId,
  bookId,
  initialContent,
  initialTitle,
}: {
  chapterId: string;
  bookId: string;
  initialContent: DocContent;
  initialTitle: string;
}) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        orderedList: false,
        history: { depth: 30 },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: sanitizeContent(initialContent) as JSONContent,
    editorProps: {
      attributes: {
        class: 'chapter-editor-prose',
        style: 'outline: none; flex: 1; min-height: 0;',
      },
      handleKeyDown(view, event) {
        if (event.key === 'Tab') {
          event.preventDefault();
          const { from, to } = view.state.selection;
          view.dispatch(view.state.tr.insertText('\t', from, to));
          return true;
        }
        return false;
      },
    },
  });

  const save = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    setSaveStatus('idle');
    setSaveError(null);
    try {
      const content = editor.getJSON();
      const wordCount = countWords(content);
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title, wordCount }),
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = (err as { error?: string }).error || `Save failed (${res.status})`;
        setSaveError(message);
        throw new Error(message);
      }
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError((prev) => prev ?? (e instanceof Error ? e.message : 'Save failed'));
      console.error('[ChapterEditor] Save failed:', e);
    } finally {
      setSaving(false);
    }
  }, [editor, bookId, chapterId, title]);

  // Sync content when navigating to another chapter or when editor mounts after hydration
  useEffect(() => {
    if (!editor || initialContent == null) return;
    editor.commands.setContent(sanitizeContent(initialContent) as JSONContent, false);
  }, [chapterId, initialContent, editor]);

  // Re-render when selection changes so Bold/Italic toolbar buttons show active state
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick((t) => t + 1);
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  const showEmptyHint = isEmptyDoc(initialContent);

  return (
    <div className="chapter-editor-root">
      <div className="chapter-editor-toolbar">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>Title:</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: '0.25rem 0.5rem', flex: 1, minWidth: 200 }}
          />
        </label>
      </div>
      {showEmptyHint && (
        <p className="chapter-editor-hint">
          No content yet. Type below or edit this chapter in the desktop app and use &quot;Sync to DB&quot; to bring the content here.
        </p>
      )}
      <div className="chapter-editor-scroll">
        <div className="chapter-editor-wrapper">
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="chapter-editor-bottom-toolbar">
        <button
          type="button"
          className="chapter-format-btn"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
          title="Bold"
          aria-pressed={editor?.isActive('bold') ?? false}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          className="chapter-format-btn"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
          title="Italic"
          aria-pressed={editor?.isActive('italic') ?? false}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          className="chapter-format-btn"
          onClick={() => editor?.chain().focus().insertContent('\t').run()}
          disabled={!editor}
          title="Insert tab"
        >
          Tab
        </button>
        <span className="chapter-editor-footer-spacer" />
        <button
          type="button"
          className="chapter-format-btn chapter-save-btn"
          onClick={save}
          disabled={saving}
          title="Save chapter"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveStatus === 'saved' && <span className="chapter-save-status chapter-save-status-ok">Saved</span>}
        {saveStatus === 'error' && (
          <span className="chapter-save-status chapter-save-status-err" title={saveError ?? undefined}>
            {saveError ?? 'Save failed'}
          </span>
        )}
      </div>
    </div>
  );
}
