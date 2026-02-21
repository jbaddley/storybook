import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useBookStore } from '../stores/bookStore';
import { parseOutlineContent } from '../utils/outlineContent';

/**
 * Outliner: WYSIWYG editor for the book outline.
 * Content is stored as TipTap JSON string in book.outline (DB) and persisted via updateBookOutline.
 */
export const OutlinerView: React.FC = () => {
  const { book, updateBookOutline } = useBookStore();
  const initialContent = parseOutlineContent(book.outline?.content);
  const lastSavedRef = useRef<string>(JSON.stringify(initialContent));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        orderedList: false,
        history: { depth: 50 },
      }),
    ],
    content: initialContent,
    editable: true,
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const str = JSON.stringify(json);
      if (str === lastSavedRef.current) return;
      lastSavedRef.current = str;
      updateBookOutline(str);
    },
    editorProps: {
      attributes: {
        class: 'outliner-wysiwyg-editor',
        'data-placeholder': 'Part One — Chapter 1 — Opening scene, introduce protagonist — Chapter 2 — …',
      },
    },
  });

  // When outline loads from DB or book changes, set editor content
  useEffect(() => {
    if (!editor) return;
    const next = parseOutlineContent(book.outline?.content);
    const nextStr = JSON.stringify(next);
    if (nextStr !== lastSavedRef.current) {
      lastSavedRef.current = nextStr;
      editor.commands.setContent(next, false);
    }
  }, [book.id, book.outline?.content, editor]);

  if (!editor) return null;

  return (
    <div className="tab-viewer outliner-view">
      <div className="tab-viewer-header outliner-header">
        <h2>Outliner</h2>
        <p className="text-muted">Outline your book with headings and lists. What you see is what you get.</p>
        <div className="outliner-toolbar">
          <button
            type="button"
            className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            H3
          </button>
          <span className="outliner-toolbar-sep" />
          <button
            type="button"
            className={editor.isActive('bulletList') ? 'active' : ''}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            • List
          </button>
          <button
            type="button"
            className={editor.isActive('bold') ? 'active' : ''}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <strong>B</strong>
          </button>
        </div>
      </div>
      <div className="outliner-content outliner-wysiwyg">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
