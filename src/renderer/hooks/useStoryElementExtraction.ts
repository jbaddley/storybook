import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useStoryElementsStore } from '../stores/storyElementsStore';
import { extractStoryElements } from '../services/storyElements/extractor';

export const useStoryElementExtraction = () => {
  const { content, htmlContent, mode } = useEditorStore();
  const { setElements } = useStoryElementsStore();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const extract = useCallback(async () => {
    // Convert content to plain text for extraction
    let textContent = '';
    
    if (mode === 'wysiwyg') {
      // Convert HTML to plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      textContent = tempDiv.textContent || tempDiv.innerText || '';
    } else {
      // For markdown, convert to plain text (remove markdown syntax)
      textContent = content.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '').replace(/\*/g, '');
    }

    if (textContent.trim().length < 100) {
      // Too short to extract meaningful elements
      return;
    }

    try {
      const extracted = await extractStoryElements(textContent);
      setElements(extracted);
    } catch (error) {
      console.error('Failed to extract story elements:', error);
    }
  }, [content, htmlContent, mode, setElements]);

  useEffect(() => {
    // Debounce extraction to avoid too many API calls
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      extract();
    }, 2000); // Wait 2 seconds after user stops typing

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [extract]);

  return { extract };
};

