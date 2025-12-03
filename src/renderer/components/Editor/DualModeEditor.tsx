import React, { useEffect } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useChaptersStore } from '../../stores/chaptersStore';
import WYSIWYGEditor from './WYSIWYGEditor';
import MarkdownEditor from './MarkdownEditor';
import TurndownService from 'turndown';
import { marked } from 'marked';
import './Editor.css';

const turndownService = new TurndownService();

const DualModeEditor: React.FC = () => {
  const { mode, content, htmlContent, setMode, setContent, setHtmlContent } = useEditorStore();
  const { currentChapterId } = useChaptersStore();

  // Sync editor with current chapter when it changes
  useEffect(() => {
    const currentChapter = useChaptersStore.getState().getCurrentChapter();
    
    // Set loading flag to prevent auto-save during sync
    useEditorStore.getState().setLoadingChapter(true);
    
    if (currentChapter) {
      // Update editor content from chapter
      const chapterContent = currentChapter.content || '';
      const chapterHtmlContent = currentChapter.htmlContent || '';
      
      // Update content directly using setState to avoid triggering saves
      useEditorStore.setState({
        content: chapterContent,
        htmlContent: chapterHtmlContent,
      });
    } else {
      // No chapter selected, clear editor
      useEditorStore.setState({
        content: '',
        htmlContent: '',
      });
    }
    
    // Clear loading flag after update
    setTimeout(() => {
      useEditorStore.getState().setLoadingChapter(false);
    }, 50);
  }, [currentChapterId]); // Only depend on currentChapterId

  // Convert HTML to Markdown
  const htmlToMarkdown = (html: string): string => {
    return turndownService.turndown(html);
  };

  // Convert Markdown to HTML
  const markdownToHtml = (markdown: string): string => {
    const result = marked(markdown);
    // marked can return string or Promise<string>, handle both
    if (typeof result === 'string') {
      return result;
    }
    // If it's a promise, return empty string (shouldn't happen in sync mode)
    return '';
  };

  // Handle mode switch
  const handleModeSwitch = (newMode: 'wysiwyg' | 'markdown') => {
    if (newMode === mode) return;

    if (mode === 'wysiwyg' && newMode === 'markdown') {
      // Convert HTML to Markdown
      const markdown = htmlToMarkdown(htmlContent || '');
      setContent(markdown);
    } else if (mode === 'markdown' && newMode === 'wysiwyg') {
      // Convert Markdown to HTML
      const html = markdownToHtml(content);
      setHtmlContent(html);
    }

    setMode(newMode);
  };

  const handleWYSIWYGUpdate = (html: string) => {
    setHtmlContent(html);
  };

  const handleMarkdownUpdate = (markdown: string) => {
    setContent(markdown);
  };

  return (
    <div className="dual-mode-editor">
      <div className="editor-mode-toggle">
        <button
          onClick={() => handleModeSwitch('wysiwyg')}
          className={mode === 'wysiwyg' ? 'active' : ''}
        >
          WYSIWYG
        </button>
        <button
          onClick={() => handleModeSwitch('markdown')}
          className={mode === 'markdown' ? 'active' : ''}
        >
          Markdown
        </button>
      </div>
      {mode === 'wysiwyg' ? (
        <WYSIWYGEditor
          content={htmlContent}
          onUpdate={handleWYSIWYGUpdate}
        />
      ) : (
        <MarkdownEditor
          content={content}
          onUpdate={handleMarkdownUpdate}
        />
      )}
    </div>
  );
};

export default DualModeEditor;

