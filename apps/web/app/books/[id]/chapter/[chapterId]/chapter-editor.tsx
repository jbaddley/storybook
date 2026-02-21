'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import type { JSONContent } from '@tiptap/core';
import { DocContent } from './tiptap-types';

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
  const [title, setTitle] = useState(initialTitle);

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle],
    content: initialContent as JSONContent,
    editorProps: {
      attributes: {
        class: 'chapter-editor-prose',
        style: 'min-height: 200px; outline: none;',
      },
    },
  });

  const save = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const content = editor.getJSON();
      const wordCount = countWords(content);
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title, wordCount }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [editor, bookId, chapterId, title]);

  useEffect(() => {
    if (!editor || initialContent === undefined) return;
    editor.commands.setContent(initialContent as JSONContent);
  }, [chapterId, initialContent, editor]);

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>Title:</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: '0.25rem 0.5rem', flex: 1, minWidth: 200 }}
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ padding: '0.35rem 0.75rem', cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveStatus === 'saved' && <span style={{ color: 'green', fontSize: '0.875rem' }}>Saved</span>}
        {saveStatus === 'error' && <span style={{ color: 'red', fontSize: '0.875rem' }}>Save failed</span>}
      </div>
      <div
        className="chapter-editor-wrapper"
        style={{
          border: '1px solid #ccc',
          borderRadius: 4,
          padding: '0.75rem 1rem',
          minHeight: 220,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
