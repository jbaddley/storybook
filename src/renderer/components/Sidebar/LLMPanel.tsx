import React, { useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useChaptersStore } from '../../stores/chaptersStore';
import { useWritingStore } from '../../stores/writingStore';
import { checkGrammar } from '../../services/grammar/checker';
import { getWritingSuggestions, WritingSuggestion } from '../../services/writing/assistant';
import './Sidebar.css';

const LLMPanel: React.FC = () => {
  const { content, htmlContent, mode } = useEditorStore();
  const { getCurrentChapter } = useChaptersStore();
  const { grammarSuggestions, writingSuggestions, setGrammarSuggestions, setWritingSuggestions } = useWritingStore();
  const [activeSubTab, setActiveSubTab] = useState<'grammar' | 'writing'>('grammar');
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckingSelection, setIsCheckingSelection] = useState(false);

  const getSelectedText = (): string | null => {
    // Try to get selected text from the editor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const selectedText = selection.toString().trim();
      if (selectedText.length >= 10) {
        return selectedText;
      }
    }
    return null;
  };

  const getTextContent = (useSelection: boolean = false): { text: string; isSelection: boolean } => {
    // First, try to get selected text if requested
    if (useSelection) {
      const selectedText = getSelectedText();
      if (selectedText && selectedText.length >= 10) {
        return { text: selectedText, isSelection: true };
      }
    }

    // Otherwise, get full content
    const currentChapter = getCurrentChapter();
    let textContent = '';
    
    if (currentChapter) {
      // Use chapter content
      if (mode === 'wysiwyg') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentChapter.htmlContent || '';
        textContent = tempDiv.textContent || tempDiv.innerText || '';
      } else {
        textContent = currentChapter.content || '';
      }
    } else {
      // Use editor content
      if (mode === 'wysiwyg') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        textContent = tempDiv.textContent || tempDiv.innerText || '';
      } else {
        textContent = content;
      }
    }
    
    return { text: textContent, isSelection: false };
  };

  const handleGrammarCheck = async (checkSelection: boolean = false) => {
    const result = getTextContent(checkSelection);
    const textContent = result.text;
    const isSelection = result.isSelection;
    
    if (textContent.trim().length < 10) {
      if (checkSelection) {
        alert('Please select at least 10 characters of text to check grammar.');
      } else {
        alert('Please add some text to check grammar.');
      }
      return;
    }

    setIsChecking(true);
    setIsCheckingSelection(isSelection);
    try {
      const suggestions = await checkGrammar(textContent);
      setGrammarSuggestions(suggestions);
      setActiveSubTab('grammar');
    } catch (error) {
      console.error('Grammar check failed:', error);
      alert('Grammar check failed. Please check your LLM provider settings.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleWritingSuggestions = async () => {
    const result = getTextContent(false);
    const textContent = result.text;
    
    if (textContent.trim().length < 50) {
      alert('Please add more text (at least 50 characters) to get writing suggestions.');
      return;
    }

    setIsChecking(true);
    try {
      const suggestions = await getWritingSuggestions(textContent);
      setWritingSuggestions(suggestions);
      setActiveSubTab('writing');
    } catch (error) {
      console.error('Writing suggestions failed:', error);
      alert('Failed to get writing suggestions. Please check your LLM provider settings.');
    } finally {
      setIsChecking(false);
    }
  };

  const applyGrammarSuggestion = (suggestion: typeof grammarSuggestions[0]) => {
    const currentChapter = getCurrentChapter();
    if (!currentChapter) return;

    const { content: chapterContent, htmlContent: chapterHtmlContent } = currentChapter;
    const textToReplace = suggestion.original;
    const replacement = suggestion.suggestion;

    const { updateChapter } = useChaptersStore.getState();
    const { setContent, setHtmlContent } = useEditorStore.getState();
    
    if (mode === 'markdown') {
      const newContent = chapterContent.replace(textToReplace, replacement);
      updateChapter(currentChapter.id, { content: newContent });
      setContent(newContent);
    } else {
      // For WYSIWYG, we need to replace in HTML
      const newHtmlContent = chapterHtmlContent.replace(
        new RegExp(textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        replacement
      );
      updateChapter(currentChapter.id, { htmlContent: newHtmlContent });
      setHtmlContent(newHtmlContent);
    }

    // Remove the applied suggestion
    setGrammarSuggestions(grammarSuggestions.filter(s => s !== suggestion));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return '#cc0000';
      case 'warning':
        return '#ff9900';
      case 'suggestion':
        return '#0066cc';
      default:
        return '#666';
    }
  };

  return (
    <div className="llm-panel">
      <div className="panel-header">
        <h3>LLM Assistant</h3>
      </div>
      <div className="llm-actions">
        <button
          onClick={() => handleGrammarCheck(false)}
          disabled={isChecking}
          className="llm-action-button"
          title="Check grammar for the entire chapter"
        >
          {isChecking && !isCheckingSelection ? 'Checking...' : 'Check Grammar'}
        </button>
        <button
          onClick={() => handleGrammarCheck(true)}
          disabled={isChecking}
          className="llm-action-button llm-action-button-secondary"
          title="Check grammar for selected text only"
        >
          {isChecking && isCheckingSelection ? 'Checking...' : 'Check Selection'}
        </button>
        <button
          onClick={handleWritingSuggestions}
          disabled={isChecking}
          className="llm-action-button"
        >
          {isChecking ? 'Analyzing...' : 'Writing Tips'}
        </button>
      </div>
      <div className="llm-subtabs">
        <button
          className={activeSubTab === 'grammar' ? 'active' : ''}
          onClick={() => setActiveSubTab('grammar')}
        >
          Grammar ({grammarSuggestions.length})
        </button>
        <button
          className={activeSubTab === 'writing' ? 'active' : ''}
          onClick={() => setActiveSubTab('writing')}
        >
          Writing ({writingSuggestions.length})
        </button>
      </div>
      <div className="panel-content">
        {activeSubTab === 'grammar' && (
          <div className="grammar-suggestions">
            {grammarSuggestions.length === 0 ? (
              <div className="empty-state">
                {isChecking 
                  ? (isCheckingSelection ? 'Checking selected text...' : 'Checking grammar...')
                  : 'No grammar issues found. Click "Check Grammar" to analyze your text, or select text and click "Check Selection".'}
              </div>
            ) : (
              grammarSuggestions.map((suggestion, idx) => (
                <div key={idx} className="grammar-suggestion-item">
                  <div className="suggestion-header">
                    <span
                      className="suggestion-severity"
                      style={{ color: getSeverityColor(suggestion.severity) }}
                    >
                      {suggestion.severity.toUpperCase()}
                    </span>
                    <span className="suggestion-type">{suggestion.type}</span>
                  </div>
                  <div className="suggestion-content">
                    <div className="suggestion-original">
                      <strong>Original:</strong> {suggestion.original}
                    </div>
                    <div className="suggestion-corrected">
                      <strong>Suggested:</strong> {suggestion.suggestion}
                    </div>
                    {suggestion.explanation && (
                      <div className="suggestion-explanation">
                        {suggestion.explanation}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => applyGrammarSuggestion(suggestion)}
                    className="apply-suggestion-button"
                  >
                    Apply
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {activeSubTab === 'writing' && (
          <div className="writing-suggestions">
            {writingSuggestions.length === 0 ? (
              <div className="empty-state">
                {isChecking ? 'Analyzing...' : 'No writing suggestions yet. Click "Writing Tips" to get suggestions.'}
              </div>
            ) : (
              writingSuggestions.map((suggestion, idx) => (
                <div key={idx} className="writing-suggestion-item">
                  <div className="suggestion-header">
                    <span className="suggestion-type">{suggestion.type}</span>
                  </div>
                  <div className="suggestion-content">
                    <div className="suggestion-text">{suggestion.suggestion}</div>
                    {suggestion.context && (
                      <div className="suggestion-context">
                        <strong>Context:</strong> {suggestion.context}
                      </div>
                    )}
                    {suggestion.example && (
                      <div className="suggestion-example">
                        <strong>Example:</strong> {suggestion.example}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LLMPanel;

