import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useStoryElementsStore } from '../stores/storyElementsStore';
import { useAnalysisStore } from '../stores/analysisStore';
import { checkConsistency } from '../services/consistency/checker';
import { analyzePlotHoles } from '../services/plot/analyzer';

export const useAnalysis = () => {
  const { content, htmlContent, mode } = useEditorStore();
  const { characters, locations, dates, themes } = useStoryElementsStore();
  const { setConsistencyIssues, setPlotHoles } = useAnalysisStore();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const runAnalysis = useCallback(async () => {
    // Convert content to plain text
    let textContent = '';
    
    if (mode === 'wysiwyg') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      textContent = tempDiv.textContent || tempDiv.innerText || '';
    } else {
      textContent = content.replace(/#{1,6}\s+/g, '').replace(/\*\*/g, '').replace(/\*/g, '');
    }

    if (textContent.trim().length < 200) {
      return;
    }

    try {
      // Run consistency check
      const issues = await checkConsistency(textContent, {
        characters,
        locations,
        dates,
        themes,
      });
      setConsistencyIssues(issues);

      // Run plot hole analysis
      const holes = await analyzePlotHoles(textContent);
      setPlotHoles(holes);
    } catch (error) {
      console.error('Failed to run analysis:', error);
    }
  }, [content, htmlContent, mode, characters, locations, dates, themes, setConsistencyIssues, setPlotHoles]);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      runAnalysis();
    }, 3000); // Wait 3 seconds after user stops typing

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [runAnalysis]);

  return { runAnalysis };
};

