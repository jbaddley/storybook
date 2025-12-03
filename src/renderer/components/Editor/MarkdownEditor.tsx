import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import './Editor.css';

interface MarkdownEditorProps {
  content: string;
  onUpdate: (content: string) => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onUpdate }) => {
  return (
    <div className="editor-container">
      <div className="editor-content markdown-editor">
        <CodeMirror
          value={content}
          height="100%"
          extensions={[markdown(), EditorView.lineWrapping]}
          onChange={(value) => onUpdate(value)}
        />
      </div>
    </div>
  );
};

export default MarkdownEditor;

