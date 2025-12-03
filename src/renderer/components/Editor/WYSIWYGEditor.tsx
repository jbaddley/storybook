import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import './Editor.css';

interface WYSIWYGEditorProps {
  content: string;
  onUpdate: (html: string) => void;
}

const WYSIWYGEditor: React.FC<WYSIWYGEditorProps> = ({ content, onUpdate }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleHeading = useCallback((level: 1 | 2 | 3) => {
    editor?.chain().focus().toggleHeading({ level }).run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        <button
          onClick={toggleBold}
          className={editor.isActive('bold') ? 'active' : ''}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={toggleItalic}
          className={editor.isActive('italic') ? 'active' : ''}
          title="Italic"
        >
          <em>I</em>
        </button>
        <div className="toolbar-divider" />
        <button
          onClick={() => toggleHeading(1)}
          className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => toggleHeading(2)}
          className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => toggleHeading(3)}
          className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
          title="Heading 3"
        >
          H3
        </button>
        <div className="toolbar-divider" />
        <button
          onClick={toggleBulletList}
          className={editor.isActive('bulletList') ? 'active' : ''}
          title="Bullet List"
        >
          •
        </button>
        <button
          onClick={toggleOrderedList}
          className={editor.isActive('orderedList') ? 'active' : ''}
          title="Numbered List"
        >
          1.
        </button>
      </div>
      <div className="editor-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default WYSIWYGEditor;

