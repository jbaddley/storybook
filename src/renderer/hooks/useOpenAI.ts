import { useState, useEffect, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import { openAIService } from '../services/openaiService';
import { Chapter, AISuggestion, ChapterSummary, generateId } from '../../shared/types';

// Check if running in Electron
const isElectron = () => typeof window !== 'undefined' && window.electronAPI !== undefined;

export function useOpenAI() {
  const [isConfigured, setIsConfigured] = useState(false);
  const { 
    book, 
    updateBookMetadata,
    addOrUpdateCharacter,
    addOrUpdateLocation,
    addTimelineEvent,
    reorganizeTimeline,
  } = useBookStore();

  // Check if API key is configured
  useEffect(() => {
    const checkConfig = async () => {
      // In browser mode, check localStorage
      if (!isElectron()) {
        const apiKey = localStorage.getItem('openai-api-key');
        const configured = !!(apiKey && apiKey.startsWith('sk-'));
        setIsConfigured(configured);
        if (configured) {
          openAIService.setApiKey(apiKey);
        }
        return;
      }
      
      try {
        const apiKey = await window.electronAPI.storeGet('openai-api-key');
        const configured = !!(apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-'));
        setIsConfigured(configured);
        
        if (configured) {
          openAIService.setApiKey(apiKey as string);
        }
      } catch (error) {
        console.error('Error checking OpenAI config:', error);
        setIsConfigured(false);
      }
    };
    
    checkConfig();
    
    // Re-check when settings might change
    const interval = setInterval(checkConfig, 5000);
    return () => clearInterval(interval);
  }, []);

  const getChapterText = (chapter: Chapter): string => {
    // Extract plain text from TipTap content
    const extractText = (node: any): string => {
      if (node.text) return node.text;
      if (node.content) {
        return node.content.map(extractText).join(' ');
      }
      return '';
    };
    
    return extractText(chapter.content).trim();
  };

  const summarizeChapter = useCallback(async (chapter: Chapter): Promise<ChapterSummary | null> => {
    if (!isConfigured) return null;
    
    const text = getChapterText(chapter);
    if (!text) return null;

    try {
      const result = await openAIService.summarize(text, chapter.title);
      return {
        chapterId: chapter.id,
        summary: result.summary,
        keyPoints: result.keyPoints,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error summarizing chapter:', error);
      return null;
    }
  }, [isConfigured]);

  const analyzeGrammar = useCallback(async (chapter: Chapter): Promise<AISuggestion[]> => {
    if (!isConfigured) return [];
    
    const text = getChapterText(chapter);
    if (!text) return [];

    try {
      const suggestions = await openAIService.checkGrammar(text);
      return suggestions.map((s, i) => ({
        id: `suggestion-${Date.now()}-${i}`,
        ...s,
      }));
    } catch (error) {
      console.error('Error analyzing grammar:', error);
      return [];
    }
  }, [isConfigured]);

  const extractCharacters = useCallback(async (chapter: Chapter): Promise<void> => {
    if (!isConfigured) return;
    
    const text = getChapterText(chapter);
    if (!text) return;

    try {
      const characters = await openAIService.extractCharacters(text, chapter.id);
      
      // Use addOrUpdateCharacter for each extracted character
      // This will automatically merge with existing characters and track chapter mentions
      for (const char of characters) {
        addOrUpdateCharacter(
          {
            name: char.name,
            aliases: char.aliases || [],
            description: char.description,
            firstAppearance: chapter.id,
            mentions: [{ chapterId: chapter.id, count: 1 }],
          },
          chapter.id,
          chapter.title
        );
      }
    } catch (error) {
      console.error('Error extracting characters:', error);
    }
  }, [isConfigured, addOrUpdateCharacter]);

  const extractLocations = useCallback(async (chapter: Chapter): Promise<void> => {
    if (!isConfigured) return;
    
    const text = getChapterText(chapter);
    if (!text) return;

    try {
      const locations = await openAIService.extractLocations(text, chapter.id);
      
      // Use addOrUpdateLocation for each extracted location
      // This will automatically merge with existing locations and track chapter mentions
      for (const loc of locations) {
        addOrUpdateLocation(
          {
            name: loc.name,
            description: loc.description,
            type: loc.type,
            mentions: [{ chapterId: chapter.id, count: 1 }],
          },
          chapter.id,
          chapter.title
        );
      }
    } catch (error) {
      console.error('Error extracting locations:', error);
    }
  }, [isConfigured, addOrUpdateLocation]);

  const extractTimeline = useCallback(async (chapter: Chapter): Promise<void> => {
    if (!isConfigured) return;
    
    const text = getChapterText(chapter);
    if (!text) return;

    try {
      const events = await openAIService.extractTimeline(text, chapter.id);
      const currentOrder = book.extracted.timeline.length;
      
      // Add each timeline event using the store method
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        addTimelineEvent({
          description: e.description,
          date: e.date,
          sortDate: e.sortDate,
          dateType: e.dateType || 'unknown',
          eventType: e.eventType || 'current',
          chapter: chapter.id,
          chapterTitle: chapter.title,
          order: currentOrder + i,
        });
      }
      
      // Reorganize timeline after adding events
      if (events.length > 0) {
        reorganizeTimeline();
      }
    } catch (error) {
      console.error('Error extracting timeline:', error);
    }
  }, [isConfigured, book.extracted.timeline.length, addTimelineEvent, reorganizeTimeline]);

  return {
    isConfigured,
    summarizeChapter,
    analyzeGrammar,
    extractCharacters,
    extractLocations,
    extractTimeline,
  };
}

