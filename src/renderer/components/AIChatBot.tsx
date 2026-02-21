import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import { openAIService, ChatMessage, ChatCommand, ToolCall } from '../services/openaiService';
import { generateId, ChapterComment } from '../../shared/types';
import { ChapterVariationDialog } from './ChapterVariationDialog';
import { outlineContentToPlainText, markdownLikeToTipTapContent } from '../utils/outlineContent';

// IndexedDB for chat persistence
const CHAT_DB_NAME = 'storybook-chat';
const CHAT_STORE_NAME = 'messages';
const CHAT_DB_VERSION = 1;

interface StoredChat {
  id: string;
  messages: DisplayMessage[];
  // Note: We no longer store conversationHistory to IndexedDB to prevent memory bloat
  // The system prompt with chapter text was causing 60GB+ memory usage
  updatedAt: string;
}

// Maximum number of display messages to keep in history
const MAX_DISPLAY_MESSAGES = 100;
// Maximum number of conversation turns to send to API (excluding system prompt)
const MAX_CONVERSATION_TURNS = 20;

// Open IndexedDB
const openChatDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
        db.createObjectStore(CHAT_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save chat to IndexedDB - only saves display messages, NOT conversation history
// This prevents memory bloat from storing full chapter text in every system prompt
const saveChatToDB = async (bookId: string, messages: DisplayMessage[]): Promise<void> => {
  try {
    const db = await openChatDB();
    const transaction = db.transaction(CHAT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE_NAME);
    
    // Trim to max messages to prevent unbounded growth
    const trimmedMessages = messages.slice(-MAX_DISPLAY_MESSAGES);
    
    const data: StoredChat = {
      id: bookId,
      messages: trimmedMessages,
      updatedAt: new Date().toISOString(),
    };
    
    store.put(data);
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save chat to IndexedDB:', error);
  }
};

// Load chat from IndexedDB
const loadChatFromDB = async (bookId: string): Promise<StoredChat | null> => {
  try {
    const db = await openChatDB();
    const transaction = db.transaction(CHAT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CHAT_STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(bookId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load chat from IndexedDB:', error);
    return null;
  }
};

// Simple markdown parser for chat messages
const parseMarkdown = (text: string): string => {
  return text
    // Code blocks (must be before inline code)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Lists
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Numbered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
};

// Icons
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
    <circle cx="12" cy="5" r="2"></circle>
    <path d="M12 7v4"></path>
    <line x1="8" y1="16" x2="8" y2="16"></line>
    <line x1="16" y1="16" x2="16" y2="16"></line>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const LoadingDots = () => (
  <div className="loading-dots">
    <span></span>
    <span></span>
    <span></span>
  </div>
);

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  commands?: ChatCommand[];
  editCount?: number;
}

interface AIChatBotProps {
  /** When set, this message is appended as a user message and sent to LLM (e.g. from Comments "Send to Chat"). */
  pendingChatMessage?: string | null;
  /** Called after pendingChatMessage has been added to the chat. */
  onConsumedPendingMessage?: () => void;
  /** When set, this text is put in the input only – user can edit before sending (e.g. from Editor "Add to chat"). */
  chatInputPreFill?: string | null;
  /** Called after chatInputPreFill has been applied to the input. */
  onConsumedChatInputPreFill?: () => void;
}

export const AIChatBot: React.FC<AIChatBotProps> = ({ pendingChatMessage, onConsumedPendingMessage, chatInputPreFill, onConsumedChatInputPreFill }) => {
  const {
    book,
    ui,
    getActiveChapter,
    ai,
    updateChapter,
    updateChapterContent,
    updateCharacter,
    updateLocation,
    updateTimelineEvent,
    updateSummary,
    setActiveChapter,
    addComment,
    updateBookOutline,
    createChaptersFromOutline,
  } = useBookStore();

  const isOutlinerActive = ui.activeDocumentTabId === 'outliner-tab';

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendUserMessageToApiRef = useRef<((userMessage: string) => Promise<void>) | null>(null);
  const [currentModel, setCurrentModel] = useState('gpt-5.2');
  
  // Variation dialog state
  const [variationDialogOpen, setVariationDialogOpen] = useState(false);
  const [variationChatContext, setVariationChatContext] = useState('');
  const [variationInitialPrompt, setVariationInitialPrompt] = useState('');

  const AI_MODELS = [
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5' },
    { value: 'o1-preview', label: 'o1-preview' },
    { value: 'o1-mini', label: 'o1-mini' },
  ];

  const activeChapter = getActiveChapter();
  const chatLoadedRef = useRef(false);

  // Load chat from IndexedDB on mount
  useEffect(() => {
    if (chatLoadedRef.current) return;
    chatLoadedRef.current = true;
    
    const loadChat = async () => {
      const storedChat = await loadChatFromDB(book.id);
      if (storedChat && storedChat.messages.length > 0) {
        console.log('[ChatBot] Loaded chat from IndexedDB:', storedChat.messages.length, 'messages');
        setMessages(storedChat.messages);
        // Don't restore conversationHistory - it will be rebuilt fresh each message
        // This prevents memory bloat from stored chapter text
      }
    };
    
    loadChat();
  }, [book.id]);

  // Save chat to IndexedDB when messages change - only saves display messages
  const saveChat = useCallback(async (msgs: DisplayMessage[]) => {
    if (msgs.length > 0) {
      await saveChatToDB(book.id, msgs);
    }
  }, [book.id]);

  // When Comments panel sends a comment to chat, add it as a user message, clear pending, and send to LLM
  const lastConsumedPendingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingChatMessage) {
      lastConsumedPendingRef.current = null;
      return;
    }
    if (!pendingChatMessage.trim()) return;
    if (pendingChatMessage === lastConsumedPendingRef.current) return;
    lastConsumedPendingRef.current = pendingChatMessage;
    const content = pendingChatMessage.trim();
    const userDisplayMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => {
      const newMsgs = [...prev, userDisplayMsg];
      setTimeout(() => saveChat(newMsgs), 0);
      return newMsgs;
    });
    onConsumedPendingMessage?.();
    // Send to LLM (same path as user hitting Send) – will update conversationHistory when response arrives
    sendUserMessageToApiRef.current?.(content);
  }, [pendingChatMessage, onConsumedPendingMessage, saveChat]);

  // When Editor "Add to chat" provides prefill: put text in input only (no send) so user can add context
  const lastConsumedPreFillRef = useRef<string | null>(null);
  useEffect(() => {
    if (!chatInputPreFill) {
      lastConsumedPreFillRef.current = null;
      return;
    }
    if (!chatInputPreFill.trim()) return;
    if (chatInputPreFill === lastConsumedPreFillRef.current) return;
    lastConsumedPreFillRef.current = chatInputPreFill;
    setInput(chatInputPreFill.trim());
    onConsumedChatInputPreFill?.();
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [chatInputPreFill, onConsumedChatInputPreFill]);

  // Load and sync model
  useEffect(() => {
    const loadModel = async () => {
      const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
      if (!isElectron) {
        const model = localStorage.getItem('openai-model');
        if (model) setCurrentModel(model);
        return;
      }
      try {
        const model = await window.electronAPI.storeGet('openai-model');
        if (model) setCurrentModel(model as string);
      } catch (e) {
        console.error('Failed to load model:', e);
      }
    };
    loadModel();
  }, []);

  const handleModelChange = async (model: string) => {
    setCurrentModel(model);
    openAIService.setModel(model);
    
    const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
    if (!isElectron) {
      localStorage.setItem('openai-model', model);
    } else {
      try {
        await window.electronAPI.storeSet('openai-model', model);
      } catch (e) {
        console.error('Failed to save model:', e);
      }
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Find chapters mentioned in user message
  const findMentionedChapters = (message: string): typeof book.chapters => {
    const mentionedChapters: typeof book.chapters = [];
    const lowerMessage = message.toLowerCase();
    
    // Helper to add chapter by number (1-indexed)
    const addChapterByNumber = (num: number) => {
      if (num < 1 || num > book.chapters.length) {
        console.log(`[ChatBot] Chapter ${num} out of range (1-${book.chapters.length})`);
        return;
      }
      const chapter = book.chapters[num - 1]; // Direct index lookup
      if (chapter && !mentionedChapters.some(mc => mc.id === chapter.id)) {
        mentionedChapters.push(chapter);
        console.log(`[ChatBot] Added chapter ${num}: "${chapter.title}"`);
      }
    };
    
    // Check for chapter ranges like "chapters 26 through 29", "chapters 26-29", "26 through 28"
    // Make "chapters?" optional to catch patterns like "and 26 through 28"
    const rangeRegex = /\b(?:chapters?\s+)?(\d+)\s*(?:through|thru|to|-|–)\s*(\d+)\b/gi;
    let rangeMatch;
    while ((rangeMatch = rangeRegex.exec(message)) !== null) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      console.log(`[ChatBot] Found chapter range: ${start} to ${end}`);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        addChapterByNumber(i);
      }
    }
    
    // Check for "chapter X & Y" or "chapters X & Y" or "chapter X and Y" patterns
    const andRegex = /\b(?:chapters?)\s*(\d+)\s*(?:&|and)\s*(\d+)\b/gi;
    let andMatch;
    while ((andMatch = andRegex.exec(message)) !== null) {
      const num1 = parseInt(andMatch[1], 10);
      const num2 = parseInt(andMatch[2], 10);
      console.log(`[ChatBot] Found chapter pair: ${num1} & ${num2}`);
      addChapterByNumber(num1);
      addChapterByNumber(num2);
    }
    
    // Check for complex patterns like "chapters 1 and 2 and 26 through 28"
    // This handles "and X" patterns after initial chapter mentions
    const andFollowupRegex = /\band\s+(\d+)\b(?!\s*(?:through|thru|to|-|–))/gi;
    let andFollowup;
    while ((andFollowup = andFollowupRegex.exec(message)) !== null) {
      const num = parseInt(andFollowup[1], 10);
      console.log(`[ChatBot] Found 'and X' pattern: ${num}`);
      addChapterByNumber(num);
    }
    
    // Check for comma-separated lists like "chapters 1, 2, 27, 28"
    const listRegex = /\b(?:chapters?)\s*([\d,\s&and]+)/gi;
    let listMatch;
    while ((listMatch = listRegex.exec(message)) !== null) {
      const numbersStr = listMatch[1];
      // Extract all numbers from the matched string
      const numbers = numbersStr.match(/\d+/g);
      if (numbers) {
        console.log(`[ChatBot] Found chapter list: ${numbers.join(', ')}`);
        for (const numStr of numbers) {
          addChapterByNumber(parseInt(numStr, 10));
        }
      }
    }
    
    // Check for individual chapter numbers like "chapter 1", "chapter 3", "ch. 5", "ch5"
    const chapterNumRegex = /\b(?:chapter|ch\.?)\s*(\d+)\b/gi;
    let match;
    while ((match = chapterNumRegex.exec(message)) !== null) {
      const num = parseInt(match[1], 10);
      addChapterByNumber(num);
    }
    
    // Also look for standalone numbers after "read" or "load" commands
    const readRegex = /\b(?:read|load|get|show|include)\b[^.]*?(\d+(?:\s*(?:,|&|and)\s*\d+)*)/gi;
    let readMatch;
    while ((readMatch = readRegex.exec(message)) !== null) {
      const numbers = readMatch[1].match(/\d+/g);
      if (numbers) {
        console.log(`[ChatBot] Found read command numbers: ${numbers.join(', ')}`);
        for (const numStr of numbers) {
          addChapterByNumber(parseInt(numStr, 10));
        }
      }
    }
    
    // Check for chapter titles mentioned directly
    for (const chapter of book.chapters) {
      if (lowerMessage.includes(chapter.title.toLowerCase()) && 
          !mentionedChapters.some(mc => mc.id === chapter.id)) {
        mentionedChapters.push(chapter);
      }
    }
    
    // Sort by chapter order for logical presentation
    mentionedChapters.sort((a, b) => a.order - b.order);
    
    console.log(`[ChatBot] Total chapters to load: ${mentionedChapters.length}`);
    
    return mentionedChapters;
  };

  // Build context for the AI
  const buildContext = (additionalChapters: typeof book.chapters = []): string => {
    const parts: string[] = [];

    // Book info
    parts.push(`## Book: "${book.title}"
Total Chapters: ${book.chapters.length}
Chapter List: ${book.chapters.map((c, i) => `${i + 1}. "${c.title}"`).join(', ')}`);
    
    // Note which chapters are loaded in context
    if (additionalChapters.length > 0) {
      const loadedChapterNums = additionalChapters.map(c => book.chapters.findIndex(ch => ch.id === c.id) + 1);
      parts.push(`\n⚠️ **CHAPTERS LOADED FOR THIS REQUEST:** ${loadedChapterNums.join(', ')}
The COMPLETE TEXT of these chapters appears below. READ THEM and use them in your analysis.
Do NOT say you don't have access - the text is included in this message.`);
    }

    // Book settings (fonts)
    const settings = book.settings;
    parts.push(`## Book Settings:
- Title Font: ${settings.titleFont || 'Carlito'} at ${settings.titleFontSize || 24}pt
- Body Font: ${settings.bodyFont || settings.defaultFont || 'Carlito'} at ${settings.bodyFontSize || settings.defaultFontSize || 12}pt
- Line Spacing: ${settings.lineSpacing}
When making formatting changes, use these fonts and sizes.`);

    // When Outliner tab is active: current document is the book outline
    if (isOutlinerActive) {
      const outlineContent = outlineContentToPlainText(book.outline?.content);
      parts.push(`## CURRENT DOCUMENT: Book Outline
The user is working on their **book outline**. The full outline is below. Help them craft, expand, or generate outline content. Suggest structure, headings, bullet points, or full outline sections.

--- OUTLINE CONTENT BELOW ---
${outlineContent || '(Outline is empty. Help the user create one.)'}
--- END OF OUTLINE ---`);
    }

    // Current chapter context (the chapter user is viewing) – when not on Outliner
    if (!isOutlinerActive && activeChapter) {
      const chapterText = extractText(activeChapter.content);
      const chapterIndex = book.chapters.findIndex(c => c.id === activeChapter.id);
      parts.push(`## CURRENT CHAPTER (Chapter ${chapterIndex + 1}): "${activeChapter.title}"
--- FULL TEXT BELOW ---
${chapterText}
--- END OF CHAPTER ${chapterIndex + 1} ---`);
    }
    
    // Additional chapters that were specifically requested - give FULL text
    for (const chapter of additionalChapters) {
      if (chapter.id !== activeChapter?.id) { // Don't duplicate current chapter
        const chapterText = extractText(chapter.content);
        const chapterIndex = book.chapters.findIndex(c => c.id === chapter.id);
        parts.push(`## REQUESTED CHAPTER (Chapter ${chapterIndex + 1}): "${chapter.title}"
--- FULL TEXT BELOW ---
${chapterText}
--- END OF CHAPTER ${chapterIndex + 1} ---`);
      }
    }

    // Characters reference
    if (book.extracted.characters.length > 0) {
      parts.push(`## Characters:\n${book.extracted.characters.map(c => 
        `- **${c.name}**${c.aliases.length > 0 ? ` (aka ${c.aliases.join(', ')})` : ''}: ${c.description || 'No description'}`
      ).join('\n')}`);
    }

    // Locations reference
    if (book.extracted.locations.length > 0) {
      parts.push(`## Locations:\n${book.extracted.locations.map(l => 
        `- **${l.name}** (${l.type || 'place'}): ${l.description || 'No description'}`
      ).join('\n')}`);
    }

    // Timeline reference
    if (book.extracted.timeline.length > 0) {
      parts.push(`## Timeline Events:\n${book.extracted.timeline.slice(0, 10).map(t => 
        `- ${t.date ? `[${t.date}] ` : ''}${t.description}`
      ).join('\n')}${book.extracted.timeline.length > 10 ? `\n...and ${book.extracted.timeline.length - 10} more events` : ''}`);
    }

    // Songs reference
    const songs = book.songs ?? [];
    if (songs.length > 0) {
      parts.push(`## Songs:\n${songs.map(s => {
        const chars = s.characters?.length ? ` Characters: ${s.characters.join(', ')}` : '';
        const inst = s.instruments?.length ? ` Instruments: ${s.instruments.join(', ')}` : '';
        const style = s.style ? ` Style: ${s.style}` : '';
        const genre = s.genre ? ` Genre: ${s.genre}` : '';
        const tempo = s.tempo ? ` Tempo: ${s.tempo}` : '';
        const key = s.key ? ` Key: ${s.key}` : '';
        const desc = s.description ? ` ${s.description}` : '';
        const lyricsBlock = s.lyrics ? `\n  Lyrics:\n${s.lyrics.split('\n').map(l => `  ${l}`).join('\n')}` : '';
        return `- **${s.title}**:${desc}${style}${genre}${chars}${tempo}${key}${inst}${lyricsBlock}`;
      }).join('\n')}`);
    }

    // Summaries reference
    const summaries = Array.from(ai.summaries.values());
    if (summaries.length > 0) {
      parts.push(`## Chapter Summaries:\n${summaries.slice(0, 5).map(s => {
        const chapter = book.chapters.find(c => c.id === s.chapterId);
        return `- **${chapter?.title || 'Unknown'}**: ${s.summary.substring(0, 200)}${s.summary.length > 200 ? '...' : ''}`;
      }).join('\n')}`);
    }

    // Story Craft Feedback reference (for current chapter if available)
    const storyCraftFeedback = book.extracted.storyCraftFeedback || [];
    if (storyCraftFeedback.length > 0 && activeChapter) {
      const chapterFeedback = storyCraftFeedback.find(f => f.chapterId === activeChapter.id);
      if (chapterFeedback) {
        const a = chapterFeedback.assessment;
        const scoreLines = [
          `Plot progression: ${a.plotProgression.score}/5 — ${a.plotProgression.notes || '—'}`,
          `Character development: ${a.characterDevelopment.score}/5 — ${a.characterDevelopment.notes || '—'}`,
          `Theme reinforcement: ${a.themeReinforcement.score}/5 — ${a.themeReinforcement.notes || '—'}`,
          `Pacing: ${a.pacing.score}/5 — ${a.pacing.notes || '—'}`,
          `Conflict/tension: ${a.conflictTension.score}/5 — ${a.conflictTension.notes || '—'}`,
          `Hook/ending: ${a.hookEnding.score}/5 — ${a.hookEnding.notes || '—'}`,
        ];
        const pendingItems = chapterFeedback.checklist.filter(c => !c.isCompleted);
        const storyCraftParts: string[] = [
          '## Story Craft Feedback for Current Chapter (use this when the user asks for story craft recommendations or improvements)',
          '### Assessment scores and notes',
          scoreLines.join('\n'),
          a.overallNotes ? `Overall: ${a.overallNotes}` : '',
        ].filter(Boolean);
        if (chapterFeedback.summary) {
          storyCraftParts.push('### Chapter summary (from Story Craft)', chapterFeedback.summary);
        }
        if (chapterFeedback.promisesMade?.length) {
          storyCraftParts.push('### Promises made in this chapter', chapterFeedback.promisesMade.map(p => `- ${p.type}: ${p.description}`).join('\n'));
        }
        if (chapterFeedback.promisesKept?.length) {
          storyCraftParts.push('### Promises kept (from earlier chapters)', chapterFeedback.promisesKept.map(p => `- ${p.promiseDescription} → ${p.howKept}`).join('\n'));
        }
        if (pendingItems.length > 0) {
          storyCraftParts.push('### Pending improvements (prioritize these in recommendations)', pendingItems.map(i => `- [${i.category}] ${i.suggestion}`).join('\n'));
        } else {
          storyCraftParts.push('### Pending improvements: None.');
        }
        parts.push(storyCraftParts.join('\n\n'));
      }
    }

    // Themes and Motifs reference
    const themesData = book.extracted.themesAndMotifs;
    if (themesData && (themesData.themes.length > 0 || themesData.motifs.length > 0 || themesData.symbols.length > 0)) {
      const themesList = themesData.themes.map(t => `- **${t.name}** (${t.type}): ${t.description}`).join('\n');
      const motifsList = themesData.motifs.map(m => `- **${m.name}**: ${m.description}`).join('\n');
      const symbolsList = themesData.symbols.map(s => `- **${s.name}**: ${s.meaning}`).join('\n');
      
      parts.push(`## Themes & Motifs:
${themesData.themes.length > 0 ? `**Themes:**\n${themesList}` : ''}
${themesData.motifs.length > 0 ? `\n**Motifs:**\n${motifsList}` : ''}
${themesData.symbols.length > 0 ? `\n**Symbols:**\n${symbolsList}` : ''}`);
    }

    return parts.join('\n\n');
  };

  // Extract plain text from TipTap content
  const extractText = (node: any): string => {
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map(extractText).join(' ');
    }
    return '';
  };

  // Get system prompt
  const getSystemPrompt = (additionalChapters: typeof book.chapters = []): string => {
    const context = buildContext(additionalChapters);
    
    // Build chapter ID reference for the AI
    const chapterIdRef = book.chapters.map((c, i) => 
      `- Chapter ${i + 1} "${c.title}": ID = "${c.id}"`
    ).join('\n');
    
    const outlinerIntro = isOutlinerActive
      ? `## CURRENT FOCUS: Book Outline
The user is working on their **book outline** (see "## CURRENT DOCUMENT: Book Outline" below). Help them craft, structure, expand, or generate the outline. When they ask you to apply changes, update the outline, or replace it, use the **update_outline** tool with the full new outline content (use # for H1, ## for H2, ### for H3, - for bullets). You can also suggest outline text in your response for them to add manually.

When the user asks to **create chapters from the outline** (e.g. "create chapters based on the current outline", "scaffold the book from the outline", or "write a short description for each chapter that summarizes main focus, themes, character development and plot points"), use the **create_chapters_from_outline** tool. Parse the outline into one chapter per major section (or as appropriate), and for each chapter provide a **title** and a **description**: a short summary covering that chapter's main focus, themes, character development, and plot points. Chapters are appended to the book and each description is stored as the chapter summary.

`
      : '';

    const chapterCritical = isOutlinerActive
      ? ''
      : `## CRITICAL - READ THIS FIRST:
The FULL TEXT of any chapters the user mentioned is ALREADY INCLUDED in this conversation below. 
DO NOT say "I don't have access to" or "please provide" - the chapter text is RIGHT HERE.
Look for sections marked "## REQUESTED CHAPTER" or "## CURRENT CHAPTER" below - those contain the complete chapter text.
`;
    
    return `You are a writing assistant helping with a book manuscript.
${outlinerIntro}${chapterCritical}

## IMPORTANT: Know When to Analyze vs When to Edit

**ANALYZE (just respond with text, do NOT use tools) when user asks:**
- "read", "re-read", "review", "assess", "analyze", "evaluate"
- "what do you think", "give feedback", "critique"
- "is this working", "does this make sense"
- "compare chapters", "how is the pacing"
- "look at the story craft", "story craft recommendations", "improvements based on story craft", "recommendations for improvements" (use the **Story Craft Feedback for Current Chapter** section below and give concrete recommendations tied to the scores, notes, and pending improvements)

**EDIT (use replace_text tool) ONLY when user explicitly asks:**
- "fix this", "change this", "update this", "improve this" + specific text
- "implement the suggestion", "make the edit", "apply the change"
- "rewrite this paragraph", "revise this sentence"

If unsure, ANALYZE first and ask if they want you to make the changes.

## Your Capabilities:
- Give writing advice based on the chapter text provided
- Review chapters for grammar, style, and flow
- Analyze plot, characters, pacing, dialogue
- Compare chapters to assess narrative progression
- **Use Story Craft feedback when asked:** If the user asks for "story craft recommendations", "improvements based on story craft", or similar, use the "Story Craft Feedback for Current Chapter" section below. Reference the assessment scores and notes, the pending improvements list, and the chapter summary/promises. Give specific, actionable recommendations (and say you can implement changes with the replace_text tool if they want).
- Make DIRECT EDITS using replace_text tool (only when explicitly asked)

## When Analyzing Chapters:
1. Read the FULL TEXT provided below for each chapter
2. Quote specific passages to support your analysis
3. Give concrete, actionable suggestions
4. Reference specific lines, dialogue, or scenes
5. If the user asks about **story craft** or **recommendations for improvements**, base your answer on the "Story Craft Feedback for Current Chapter" section: cite the scores and notes, prioritize the pending improvements list, and suggest specific edits or additions. Then offer to apply changes if they want.
6. RESPOND with your full analysis - do NOT just make edits

## Book Context:
${context}

## Chapter IDs (for edits when explicitly requested):
${chapterIdRef}

## Making Edits (only when user explicitly requests changes)

When the user EXPLICITLY asks you to fix, change, or implement something:
1. Use the **replace_text** tool to make the actual changes
2. The "find_text" must match EXACTLY what's in the document
3. Keep find_text SHORT (1-2 sentences) for reliable matching
4. ALSO provide explanation of what you changed

## Book Settings:
- Title Font: ${book.settings.titleFont || 'Carlito'} at ${book.settings.titleFontSize || 24}pt
- Body Font: ${book.settings.bodyFont || 'Carlito'} at ${book.settings.bodyFontSize || 12}pt

Use markdown formatting for readability in your responses.`;
  };

  // Normalize text for comparison (handle whitespace variations)
  const normalizeText = (text: string): string => {
    return text
      .replace(/\s+/g, ' ')  // Collapse multiple spaces
      .replace(/[\u2018\u2019'`]/g, "'")  // Smart quotes to regular
      .replace(/[\u201C\u201D""]/g, '"')  // Smart double quotes
      .replace(/[\u2013\u2014—–]/g, '-')  // En/em dashes to hyphen
      .replace(/…/g, '...')  // Ellipsis
      .trim()
      .toLowerCase();
  };

  // Extract key words from text (for fuzzy matching)
  const extractKeyWords = (text: string): string[] => {
    return normalizeText(text)
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10); // First 10 significant words
  };

  // Helper to replace text in TipTap content - handles text spanning multiple nodes
  const replaceTextInContent = (node: any, find: string, replace: string): { node: any; replaced: boolean } => {
    if (!node) return { node, replaced: false };
    
    console.log('[ChatBot] === Starting text replacement ===');
    console.log('[ChatBot] Find:', find.substring(0, 100));
    console.log('[ChatBot] Replace:', replace.substring(0, 100));
    
    // Strategy 1: Direct text match in text nodes
    const directResult = replaceTextDirect(node, find, replace);
    if (directResult.replaced) {
      console.log('[ChatBot] ✅ Direct text replacement succeeded');
      return directResult;
    }
    
    // Strategy 2: Normalized text match
    const normalizedFind = normalizeText(find);
    const normalizedResult = replaceInParagraphs(node, normalizedFind, replace);
    if (normalizedResult.replaced) {
      console.log('[ChatBot] ✅ Normalized paragraph replacement succeeded');
      return normalizedResult;
    }
    
    // Strategy 3: Fuzzy match - find paragraph containing key words
    const fuzzyResult = fuzzyReplaceParagraph(node, find, replace);
    if (fuzzyResult.replaced) {
      console.log('[ChatBot] ✅ Fuzzy paragraph replacement succeeded');
      return fuzzyResult;
    }
    
    // Log failure details
    const docText = extractText(node);
    console.log('[ChatBot] ❌ Could not find text to replace.');
    console.log('[ChatBot] Looking for (normalized):', normalizedFind);
    console.log('[ChatBot] Document text sample:', normalizeText(docText).substring(0, 500));
    
    return { node, replaced: false };
  };

  // Replace text within paragraphs using normalized comparison
  const replaceInParagraphs = (node: any, normalizedFind: string, replace: string): { node: any; replaced: boolean } => {
    if (!node) return { node, replaced: false };
    
    if ((node.type === 'paragraph' || node.type === 'heading') && node.content) {
      // Get full text of this paragraph
      const paragraphText = extractText(node);
      const normalizedPara = normalizeText(paragraphText);
      
      // Check if this paragraph contains the search text
      if (normalizedPara.includes(normalizedFind)) {
        console.log('[ChatBot] Found match in paragraph:', paragraphText.substring(0, 80));
        
        // Find where in the original text the match occurs
        const idx = normalizedPara.indexOf(normalizedFind);
        
        // We need to replace in the actual text nodes
        // Build a new paragraph with replaced content
        const newContent = replaceInTextNodes(node.content, normalizedFind, replace, paragraphText);
        if (newContent.replaced) {
          return { node: { ...node, content: newContent.nodes }, replaced: true };
        }
      }
    }
    
    // Recurse into children
    if (node.content && Array.isArray(node.content)) {
      let replaced = false;
      const newContent = node.content.map((child: any) => {
        if (replaced) return child; // Only replace first occurrence
        const result = replaceInParagraphs(child, normalizedFind, replace);
        if (result.replaced) replaced = true;
        return result.node;
      });
      if (replaced) {
        return { node: { ...node, content: newContent }, replaced: true };
      }
    }
    
    return { node, replaced: false };
  };

  // Replace text within text nodes of a paragraph
  const replaceInTextNodes = (content: any[], normalizedFind: string, replace: string, originalParagraphText: string): { nodes: any[]; replaced: boolean } => {
    // Get all text and their positions
    let fullText = '';
    const textNodeInfo: { node: any; start: number; end: number; index: number }[] = [];
    
    content.forEach((child, index) => {
      if (child.type === 'text' && child.text) {
        const start = fullText.length;
        fullText += child.text;
        textNodeInfo.push({ node: child, start, end: fullText.length, index });
      }
    });
    
    // Find where the normalized text appears
    const normalizedFull = normalizeText(fullText);
    const findIdx = normalizedFull.indexOf(normalizedFind);
    
    if (findIdx === -1) {
      return { nodes: content, replaced: false };
    }
    
    // Find the actual character positions in original text
    // We need to map normalized positions back to original positions
    let origIdx = 0;
    let normIdx = 0;
    const normalizedFull2 = normalizeText(fullText);
    
    // Map normalized index to original index
    const normToOrigMap: number[] = [];
    for (let i = 0; i < fullText.length; i++) {
      const normalizedChar = normalizeText(fullText.substring(0, i + 1));
      while (normToOrigMap.length < normalizedChar.length) {
        normToOrigMap.push(i);
      }
    }
    
    const origStart = normToOrigMap[findIdx] || 0;
    const origEnd = normToOrigMap[findIdx + normalizedFind.length] || fullText.length;
    
    console.log('[ChatBot] Replacing from position', origStart, 'to', origEnd);
    console.log('[ChatBot] Original text to replace:', fullText.substring(origStart, origEnd));
    
    // Reconstruct text with replacement
    const newFullText = fullText.substring(0, origStart) + replace + fullText.substring(origEnd);
    
    // Create a single text node with the new content (simplest approach)
    const newNodes = content.map((child, idx) => {
      if (idx === 0 && child.type === 'text') {
        return { ...child, text: newFullText };
      } else if (child.type === 'text') {
        return { ...child, text: '' }; // Empty out other text nodes
      }
      return child;
    }).filter(n => n.type !== 'text' || n.text !== ''); // Remove empty text nodes
    
    // If we removed all text nodes, add one back
    if (newNodes.every((n: any) => n.type !== 'text')) {
      newNodes.push({ type: 'text', text: newFullText });
    }
    
    return { nodes: newNodes, replaced: true };
  };

  // Fuzzy match - find paragraph with most matching words
  const fuzzyReplaceParagraph = (node: any, find: string, replace: string): { node: any; replaced: boolean } => {
    if (!node) return { node, replaced: false };
    
    const findWords = extractKeyWords(find);
    if (findWords.length < 2) {
      return { node, replaced: false };
    }
    
    console.log('[ChatBot] Fuzzy search using keywords:', findWords.slice(0, 5).join(', '));
    
    // Find paragraph with highest word match
    interface MatchResult { node: any; parent: any; index: number; score: number }
    let bestMatch: MatchResult | null = null;
    
    const searchParagraphs = (n: any, parent: any = null, idx: number = 0) => {
      if ((n.type === 'paragraph' || n.type === 'heading') && n.content) {
        const paraText = extractText(n);
        const paraWords = normalizeText(paraText).split(/\s+/);
        
        // Count matching words
        let matchCount = 0;
        for (const findWord of findWords) {
          if (paraWords.some(pw => pw.includes(findWord) || findWord.includes(pw))) {
            matchCount++;
          }
        }
        
        const score = matchCount / findWords.length;
        if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { node: n, parent, index: idx, score };
          console.log(`[ChatBot] Found candidate paragraph (score: ${score.toFixed(2)}):`, paraText.substring(0, 80));
        }
      }
      
      if (n.content && Array.isArray(n.content)) {
        n.content.forEach((child: any, i: number) => searchParagraphs(child, n, i));
      }
    };
    
    searchParagraphs(node);
    
    const match = bestMatch as MatchResult | null;
    if (match && match.score >= 0.6) {
      console.log('[ChatBot] Using fuzzy match with score:', match.score);
      
      // Replace the entire paragraph content
      const newParagraph = {
        ...match.node,
        content: [{ type: 'text', text: replace }]
      };
      
      // Rebuild the tree with the new paragraph
      const targetNode = match.node;
      const replaceInTree = (n: any): any => {
        if (n === targetNode) {
          return newParagraph;
        }
        if (n.content && Array.isArray(n.content)) {
          return { ...n, content: n.content.map((c: any) => replaceInTree(c)) };
        }
        return n;
      };
      
      return { node: replaceInTree(node), replaced: true };
    }
    
    return { node, replaced: false };
  };
  
  // Direct text replacement in nodes
  const replaceTextDirect = (node: any, find: string, replace: string): { node: any; replaced: boolean } => {
    if (!node) return { node, replaced: false };
    
    let replaced = false;
    
    if (node.type === 'text' && node.text) {
      if (node.text.includes(find)) {
        return {
          node: { ...node, text: node.text.replace(find, replace) },
          replaced: true
        };
      }
      // Also try normalized comparison
      const normalizedNodeText = normalizeText(node.text);
      const normalizedFind = normalizeText(find);
      if (normalizedNodeText.includes(normalizedFind)) {
        // Find the actual position and replace
        const idx = normalizedNodeText.indexOf(normalizedFind);
        if (idx !== -1) {
          // Reconstruct with replacement
          const newText = node.text.substring(0, idx) + replace + 
            node.text.substring(idx + find.length);
          return {
            node: { ...node, text: newText },
            replaced: true
          };
        }
      }
      return { node, replaced: false };
    }
    
    if (node.content && Array.isArray(node.content)) {
      const newContent = [];
      for (const child of node.content) {
        const result = replaceTextDirect(child, find, replace);
        newContent.push(result.node);
        if (result.replaced) replaced = true;
      }
      return { node: { ...node, content: newContent }, replaced };
    }
    
    return { node, replaced };
  };
  
  // Fuzzy text replacement - tries to find partial matches
  const replaceTextFuzzy = (node: any, find: string, replace: string): { node: any; replaced: boolean } => {
    if (!node) return { node, replaced: false };
    
    // Try matching just the first 50 chars if the find text is long
    if (find.length > 50) {
      const shortFind = find.substring(0, 50);
      const result = replaceTextDirect(node, shortFind, replace);
      if (result.replaced) return result;
    }
    
    // Try matching without leading/trailing punctuation
    const trimmedFind = find.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '');
    if (trimmedFind !== find && trimmedFind.length > 10) {
      const result = replaceTextDirect(node, trimmedFind, replace);
      if (result.replaced) return result;
    }
    
    return { node, replaced: false };
  };

  // Execute edit commands
  const executeCommands = (commands: ChatCommand[]): number => {
    let successCount = 0;
    
    for (const cmd of commands) {
      if (cmd.type === 'none') continue;

      try {
        switch (cmd.type) {
          case 'replace_text':
            // Handle text replacement in chapter content
            if (cmd.chapterId && cmd.find && cmd.replace !== undefined) {
              console.log('[ChatBot] Attempting replace_text command:');
              console.log('[ChatBot] - Chapter ID:', cmd.chapterId);
              console.log('[ChatBot] - Find text:', cmd.find.substring(0, 80) + (cmd.find.length > 80 ? '...' : ''));
              console.log('[ChatBot] - Replace with:', cmd.replace.substring(0, 80) + (cmd.replace.length > 80 ? '...' : ''));
              
              const chapter = book.chapters.find(c => c.id === cmd.chapterId);
              if (chapter) {
                console.log('[ChatBot] Found chapter:', chapter.title);
                const result = replaceTextInContent(chapter.content, cmd.find, cmd.replace);
                if (result.replaced) {
                  updateChapterContent(cmd.chapterId, result.node);
                  console.log('[ChatBot] ✓ Successfully replaced text in chapter:', chapter.title);
                  successCount++;
                } else {
                  console.warn('[ChatBot] ✗ Text not found in chapter. The "find" text must match exactly.');
                }
              } else {
                // Try to find chapter by number or title
                const chapterNum = parseInt(cmd.chapterId.replace(/\D/g, ''), 10);
                const chapterByNum = book.chapters[chapterNum - 1];
                const chapterByTitle = book.chapters.find(c => 
                  c.title.toLowerCase().includes((cmd.chapterId || '').toLowerCase())
                );
                const fallbackChapter = chapterByNum || chapterByTitle;
                
                if (fallbackChapter) {
                  console.log('[ChatBot] Found chapter by fallback:', fallbackChapter.title);
                  const result = replaceTextInContent(fallbackChapter.content, cmd.find, cmd.replace);
                  if (result.replaced) {
                    updateChapterContent(fallbackChapter.id, result.node);
                    console.log('[ChatBot] ✓ Successfully replaced text in chapter:', fallbackChapter.title);
                    successCount++;
                  } else {
                    console.warn('[ChatBot] ✗ Text not found in fallback chapter either.');
                  }
                } else {
                  console.warn('[ChatBot] ✗ Chapter not found with ID:', cmd.chapterId);
                  console.log('[ChatBot] Available chapters:', book.chapters.map(c => `${c.id}: ${c.title}`).join(', '));
                }
              }
            }
            break;
            
          case 'edit_character':
            if (cmd.target && cmd.field && cmd.value !== undefined) {
              const updates: any = {};
              if (cmd.field === 'name') updates.name = cmd.value;
              if (cmd.field === 'description') updates.description = cmd.value;
              if (cmd.field === 'aliases') updates.aliases = cmd.value.split(',').map(a => a.trim());
              updateCharacter(cmd.target, updates);
              successCount++;
            }
            break;

          case 'edit_location':
            if (cmd.target && cmd.field && cmd.value !== undefined) {
              const updates: any = {};
              if (cmd.field === 'name') updates.name = cmd.value;
              if (cmd.field === 'description') updates.description = cmd.value;
              if (cmd.field === 'type') updates.type = cmd.value;
              updateLocation(cmd.target, updates);
              successCount++;
            }
            break;

          case 'edit_timeline':
            if (cmd.target && cmd.field && cmd.value !== undefined) {
              const updates: any = {};
              if (cmd.field === 'description') updates.description = cmd.value;
              if (cmd.field === 'date') updates.date = cmd.value;
              if (cmd.field === 'eventType') updates.eventType = cmd.value;
              updateTimelineEvent(cmd.target, updates);
              successCount++;
            }
            break;

          case 'edit_summary':
            if (cmd.target && cmd.field && cmd.value !== undefined) {
              const updates: any = {};
              if (cmd.field === 'summary') updates.summary = cmd.value;
              if (cmd.field === 'keyPoints') updates.keyPoints = cmd.value.split('|').map(p => p.trim());
              updateSummary(cmd.target, updates);
              successCount++;
            }
            break;

          case 'edit_chapter':
            if (cmd.target && cmd.field && cmd.value !== undefined) {
              if (cmd.field === 'title') {
                updateChapter(cmd.target, { title: cmd.value });
                successCount++;
              }
            }
            break;
        }
      } catch (err) {
        console.error('Failed to execute command:', cmd, err);
      }
    }
    
    return successCount;
  };

  // Sanitize JSON string to handle control characters that AI might include
  const sanitizeJsonString = (jsonStr: string): string => {
    // Replace unescaped control characters with their escaped versions
    // This handles newlines, tabs, carriage returns, etc. inside string values
    return jsonStr.replace(/[\x00-\x1F\x7F]/g, (char) => {
      switch (char) {
        case '\n': return '\\n';
        case '\r': return '\\r';
        case '\t': return '\\t';
        case '\b': return '\\b';
        case '\f': return '\\f';
        default: return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
      }
    });
  };

  // Execute tool calls from OpenAI
  const executeToolCalls = (toolCalls: ToolCall[]): { successCount: number; editedLines: number[]; changes: string[]; attemptedChanges: Array<{find: string; replace: string; chapterId: string; error?: string}> } => {
    let successCount = 0;
    const editedLines: number[] = [];
    const changes: string[] = []; // Track actual changes made
    const attemptedChanges: Array<{find: string; replace: string; chapterId: string; error?: string}> = []; // Track ALL attempted changes
    
    for (const toolCall of toolCalls) {
      try {
        // Sanitize JSON to handle control characters the AI might include
        const sanitizedArgs = sanitizeJsonString(toolCall.function.arguments);
        let args;
        try {
          args = JSON.parse(sanitizedArgs);
        } catch (parseError) {
          console.error('[ChatBot] Failed to parse tool arguments even after sanitization:', parseError);
          console.error('[ChatBot] Raw arguments:', toolCall.function.arguments.substring(0, 500));
          changes.push(`✗ Failed to parse AI response: invalid JSON`);
          continue;
        }
        console.log(`[ChatBot] 🔧 Executing tool: ${toolCall.function.name}`);
        console.log(`[ChatBot] Arguments:`, JSON.stringify(args, null, 2));
        
        switch (toolCall.function.name) {
          case 'update_outline':
            if (args.content != null && typeof args.content === 'string') {
              try {
                const doc = markdownLikeToTipTapContent(args.content.trim());
                updateBookOutline(JSON.stringify(doc));
                successCount++;
                changes.push(`✓ Updated book outline${args.explanation ? `: ${args.explanation}` : ''}`);
                console.log('[ChatBot] ✓ Updated outline via update_outline tool');
              } catch (err) {
                console.error('[ChatBot] update_outline failed:', err);
                changes.push('✗ Failed to update outline');
              }
            }
            break;
          case 'create_chapters_from_outline':
            if (args.chapters && Array.isArray(args.chapters) && args.chapters.length > 0) {
              try {
                const items = args.chapters
                  .filter((c: any) => c && typeof c.title === 'string' && typeof c.description === 'string')
                  .map((c: any) => ({ title: String(c.title).trim(), description: String(c.description).trim() }))
                  .filter((c: { title: string; description: string }) => c.title.length > 0);
                if (items.length > 0) {
                  createChaptersFromOutline(items);
                  successCount++;
                  changes.push(`✓ Created ${items.length} chapter${items.length !== 1 ? 's' : ''} from outline${args.explanation ? `: ${args.explanation}` : ''}`);
                  console.log('[ChatBot] ✓ Created chapters from outline:', items.length);
                } else {
                  changes.push('✗ create_chapters_from_outline: no valid chapters (need title and description per item)');
                }
              } catch (err) {
                console.error('[ChatBot] create_chapters_from_outline failed:', err);
                changes.push('✗ Failed to create chapters from outline');
              }
            } else {
              changes.push('✗ create_chapters_from_outline: chapters array required and must not be empty');
            }
            break;
          case 'replace_text':
            if (args.chapter_id && args.find_text && args.replace_with !== undefined) {
              // Track this attempt
              const attempt = { find: args.find_text, replace: args.replace_with, chapterId: args.chapter_id, error: undefined as string | undefined };
              attemptedChanges.push(attempt);
              
              // Try to find chapter by ID
              let chapter = book.chapters.find(c => c.id === args.chapter_id);
              
              // Fallback: Try by chapter number if ID looks like a number
              if (!chapter) {
                const chapterNum = parseInt(args.chapter_id.replace(/\D/g, ''), 10);
                if (!isNaN(chapterNum) && chapterNum > 0) {
                  chapter = book.chapters[chapterNum - 1];
                  console.log(`[ChatBot] Trying chapter by number: ${chapterNum}`);
                }
              }
              
              // Fallback: Try to find the text in any chapter
              if (!chapter) {
                console.log(`[ChatBot] Chapter ID "${args.chapter_id}" not found, searching all chapters...`);
                for (const ch of book.chapters) {
                  const chapterText = extractText(ch.content);
                  if (chapterText.includes(args.find_text) || normalizeText(chapterText).includes(normalizeText(args.find_text))) {
                    chapter = ch;
                    console.log(`[ChatBot] Found text in chapter: "${ch.title}"`);
                    break;
                  }
                }
              }
              
              if (chapter) {
                console.log(`[ChatBot] Found chapter: "${chapter.title}" (ID: ${chapter.id})`);
                console.log(`[ChatBot] Looking for: "${args.find_text}"`);
                console.log(`[ChatBot] Replace with: "${args.replace_with}"`);
                
                // Get the TipTap editor if available and this is the active chapter
                const editor = (window as any).__tiptapEditor;
                const isActiveChapter = chapter.id === getActiveChapter()?.id;
                
                if (editor && isActiveChapter) {
                  // USE TIPTAP EDITOR DIRECTLY - most reliable method
                  console.log(`[ChatBot] Using TipTap editor directly for active chapter`);
                  
                  const docText = editor.getText();
                  const findText = args.find_text;
                  const replaceWith = args.replace_with;
                  
                  // Try exact match first
                  let found = docText.includes(findText);
                  
                  // Try normalized match
                  if (!found) {
                    const normalizedDoc = normalizeText(docText);
                    const normalizedFind = normalizeText(findText);
                    found = normalizedDoc.includes(normalizedFind);
                  }
                  
                  if (found) {
                    // Get text before change
                    const beforeText = editor.getText();
                    
                    // SIMPLE APPROACH: Do direct string replacement in the JSON
                    const json = editor.getJSON();
                    const jsonStr = JSON.stringify(json);
                    
                    // Escape special regex characters in find text
                    const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const newJsonStr = jsonStr.replace(new RegExp(escapedFind), replaceWith);
                    
                    if (jsonStr !== newJsonStr) {
                      // Apply the change
                      const newJson = JSON.parse(newJsonStr);
                      editor.commands.setContent(newJson);
                      
                      // Verify the change
                      const afterText = editor.getText();
                      if (beforeText !== afterText) {
                        successCount++;
                        editedLines.push(1);
                        changes.push(`✓ "${findText.substring(0, 40)}..." → "${replaceWith.substring(0, 40)}..."`);
                        console.log(`[ChatBot] ✅ VERIFIED: Text changed!`);
                        console.log(`[ChatBot] Before: "${beforeText.substring(0, 100)}..."`);
                        console.log(`[ChatBot] After: "${afterText.substring(0, 100)}..."`);
                      } else {
                        console.warn(`[ChatBot] ⚠️ JSON changed but editor text didn't!`);
                        changes.push(`✗ Failed: "${findText.substring(0, 30)}..." (no change detected)`);
                      }
                    } else {
                      // Try normalized replacement
                      const normalizedFind = normalizeText(findText);
                      let foundInDoc = false;
                      
                      // Search each text node and do in-place replacement
                      const processNode = (node: any): any => {
                        if (!node) return node;
                        if (node.type === 'text' && node.text) {
                          const normalizedNodeText = normalizeText(node.text);
                          if (normalizedNodeText.includes(normalizedFind)) {
                            // Find the actual position
                            const idx = normalizedNodeText.indexOf(normalizedFind);
                            if (idx !== -1) {
                              // Replace in the original text
                              const newText = node.text.substring(0, idx) + replaceWith + 
                                node.text.substring(idx + findText.length);
                              foundInDoc = true;
                              return { ...node, text: newText };
                            }
                          }
                        }
                        if (node.content && Array.isArray(node.content)) {
                          return { ...node, content: node.content.map(processNode) };
                        }
                        return node;
                      };
                      
                      const processedJson = processNode(json);
                      if (foundInDoc) {
                        editor.commands.setContent(processedJson);
                        const afterText = editor.getText();
                        if (beforeText !== afterText) {
                          successCount++;
                          editedLines.push(1);
                          changes.push(`✓ "${findText.substring(0, 40)}..." → "${replaceWith.substring(0, 40)}..."`);
                          console.log(`[ChatBot] ✅ VERIFIED via normalized match`);
                        }
                      } else {
                        console.warn(`[ChatBot] ❌ Could not find text to replace`);
                        changes.push(`✗ Not found: "${findText.substring(0, 40)}..."`);
                        attempt.error = 'Text not found in document';
                      }
                    }
                  } else {
                    console.warn(`[ChatBot] ❌ Text not found in editor`);
                    console.warn(`[ChatBot] Editor text preview:`, docText.substring(0, 300));
                    changes.push(`✗ Not found: "${findText.substring(0, 40)}..."`);
                    attempt.error = 'Text not found in editor';
                  }
                } else {
                  // Fallback: Update chapter content in store (for non-active chapters)
                  console.log(`[ChatBot] Chapter not active, using store update`);
                  
                  const beforeText = extractText(chapter.content);
                  let lineNumber = 1;
                  
                  // Find line number
                  if (chapter.content.content) {
                    const searchText = args.find_text.substring(0, 30).toLowerCase();
                    for (let i = 0; i < chapter.content.content.length; i++) {
                      const paragraphText = extractText(chapter.content.content[i]).toLowerCase();
                      if (paragraphText.includes(searchText)) {
                        lineNumber = i + 1;
                        break;
                      }
                    }
                  }
                  
                  // Simple string replacement in JSON
                  const contentStr = JSON.stringify(chapter.content);
                  const escapedFind = args.find_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const newContentStr = contentStr.replace(new RegExp(escapedFind, 'g'), args.replace_with);
                  
                  if (contentStr !== newContentStr) {
                    const newContent = JSON.parse(newContentStr);
                    updateChapterContent(chapter.id, newContent);
                    editedLines.push(lineNumber);
                    successCount++;
                    console.log(`[ChatBot] ✅ Replaced via store update`);
                  } else {
                    // Try normalized replacement
                    const result = replaceTextInContent(
                      JSON.parse(JSON.stringify(chapter.content)),
                      args.find_text,
                      args.replace_with
                    );
                    
                    if (result.replaced) {
                      updateChapterContent(chapter.id, result.node);
                      editedLines.push(lineNumber);
                      successCount++;
                      changes.push(`✓ "${args.find_text.substring(0, 40)}..." → "${args.replace_with.substring(0, 40)}..."`);
                      console.log(`[ChatBot] ✅ Replaced via normalized match`);
                    } else {
                      console.warn(`[ChatBot] ❌ Could not find text to replace`);
                      console.warn(`[ChatBot] Looking for: "${args.find_text}"`);
                      changes.push(`✗ Not found: "${args.find_text.substring(0, 40)}..."`);
                      attempt.error = 'Text not found in chapter content';
                    }
                  }
                }
              } else {
                console.warn(`[ChatBot] ❌ Could not find chapter "${args.chapter_id}"`);
                console.warn(`[ChatBot] Available chapters:`, book.chapters.map(c => `"${c.title}" (${c.id})`).join(', '));
                changes.push(`✗ Chapter not found: "${args.chapter_id}"`);
                attempt.error = `Chapter not found: ${args.chapter_id}`;
              }
            }
            break;
            
          case 'edit_chapter_title':
            if (args.chapter_id && args.new_title) {
              updateChapter(args.chapter_id, { title: args.new_title });
              console.log('[ChatBot] ✅ Updated chapter title');
              successCount++;
            }
            break;
            
          case 'edit_character':
            if (args.character_id && args.field && args.value !== undefined) {
              const updates: any = {};
              if (args.field === 'name') updates.name = args.value;
              if (args.field === 'description') updates.description = args.value;
              if (args.field === 'aliases') updates.aliases = args.value.split(',').map((a: string) => a.trim());
              updateCharacter(args.character_id, updates);
              console.log('[ChatBot] ✅ Updated character');
              successCount++;
            }
            break;
            
          case 'edit_location':
            if (args.location_id && args.field && args.value !== undefined) {
              const updates: any = {};
              if (args.field === 'name') updates.name = args.value;
              if (args.field === 'description') updates.description = args.value;
              if (args.field === 'type') updates.type = args.value;
              updateLocation(args.location_id, updates);
              console.log('[ChatBot] ✅ Updated location');
              successCount++;
            }
            break;
            
          case 'add_comment':
            if (args.chapter_id && args.target_text && args.comment_text && args.comment_type) {
              // Find chapter
              let chapter = book.chapters.find(c => c.id === args.chapter_id);
              
              // Fallback: try by chapter number
              if (!chapter) {
                const chapterNum = parseInt(args.chapter_id.replace(/\D/g, ''), 10);
                if (!isNaN(chapterNum) && chapterNum > 0) {
                  chapter = book.chapters[chapterNum - 1];
                }
              }
              
              // Fallback: find text in any chapter
              if (!chapter) {
                for (const ch of book.chapters) {
                  const chapterText = extractText(ch.content);
                  if (chapterText.includes(args.target_text) || normalizeText(chapterText).includes(normalizeText(args.target_text))) {
                    chapter = ch;
                    break;
                  }
                }
              }
              
              if (chapter) {
                // Create the comment with targetText for later reference
                const comment: ChapterComment = {
                  id: generateId(),
                  text: args.comment_text,
                  type: args.comment_type as ChapterComment['type'],
                  category: args.category as ChapterComment['category'],
                  resolved: false,
                  createdAt: new Date().toISOString(),
                  createdBy: 'ai',
                  targetText: args.target_text, // Store for scrolling to comment later
                };
                
                // Add comment to chapter
                addComment(chapter.id, comment);
                
                // Add comment mark to editor content
                const editor = (window as any).__tiptapEditor;
                const isActiveChapter = chapter.id === getActiveChapter()?.id;
                
                if (editor && isActiveChapter) {
                  const docText = editor.getText();
                  const targetText = args.target_text;
                  
                  // Find position in editor
                  let pos = docText.indexOf(targetText);
                  if (pos === -1) {
                    // Try normalized match
                    const normalizedDoc = normalizeText(docText);
                    const normalizedTarget = normalizeText(targetText);
                    pos = normalizedDoc.indexOf(normalizedTarget);
                  }
                  
                  if (pos !== -1) {
                    // Apply comment mark to the text
                    const from = pos + 1; // ProseMirror positions are 1-indexed
                    const to = from + targetText.length;
                    
                    editor.chain()
                      .setTextSelection({ from, to })
                      .setMark('comment', { commentId: comment.id, commentType: comment.type })
                      .run();
                    
                    console.log(`[ChatBot] ✅ Added comment mark at position ${from}-${to}`);
                  }
                }
                
                successCount++;
                changes.push(`💬 Added ${args.comment_type}: "${args.comment_text.substring(0, 40)}..."`);
                console.log(`[ChatBot] ✅ Added comment to chapter "${chapter.title}"`);
              } else {
                console.warn(`[ChatBot] ⚠️ Could not find chapter for comment`);
                changes.push(`✗ Failed to add comment: chapter not found`);
              }
            }
            break;
        }
      } catch (err) {
        console.error('[ChatBot] ❌ Failed to execute tool call:', toolCall, err);
      }
    }
    
    // Dispatch event to highlight edited lines
    if (editedLines.length > 0) {
      window.dispatchEvent(new CustomEvent('editor-edit-made', { 
        detail: { lineNumbers: editedLines } 
      }));
    }
    
    return { successCount, editedLines, changes, attemptedChanges };
  };

  // Parse commands from AI response (legacy fallback)
  const parseCommands = (response: string): { cleanResponse: string; commands: ChatCommand[] } => {
    const commandMatch = response.match(/```command\n([\s\S]*?)\n```/);
    let commands: ChatCommand[] = [];
    let cleanResponse = response;

    if (commandMatch) {
      try {
        commands = JSON.parse(commandMatch[1]);
        cleanResponse = response.replace(/```command\n[\s\S]*?\n```/g, '').trim();
      } catch (e) {
        console.error('Failed to parse commands:', e);
      }
    }

    return { cleanResponse, commands };
  };

  // Collect recent chat suggestions from conversation
  const collectChatSuggestions = (): string => {
    // Get the last few assistant messages that likely contain suggestions
    const recentAssistantMessages = messages
      .filter(m => m.role === 'assistant')
      .slice(-5) // Last 5 assistant messages
      .map(m => m.content)
      .join('\n\n---\n\n');
    
    return recentAssistantMessages;
  };
  
  // Check if message is requesting a chapter variation
  const isVariationRequest = (message: string): { isVariation: boolean; prompt?: string } => {
    const lowerMessage = message.toLowerCase();
    
    // Patterns that indicate variation generation request
    const variationPatterns = [
      /generate\s+(?:a\s+)?variation/i,
      /create\s+(?:a\s+)?variation/i,
      /make\s+(?:a\s+)?variation/i,
      /rewrite\s+(?:the\s+)?(?:this\s+)?chapter/i,
      /generate\s+(?:a\s+)?rewrite/i,
      /create\s+(?:an?\s+)?alternative\s+version/i,
      /apply\s+(?:these\s+)?(?:your\s+)?suggestions\s+(?:to\s+)?(?:the\s+)?(?:whole\s+)?chapter/i,
      /implement\s+(?:these\s+)?(?:your\s+)?suggestions\s+(?:in\s+)?(?:a\s+)?variation/i,
      /use\s+(?:these\s+)?(?:your\s+)?(?:chat\s+)?suggestions\s+to\s+(?:generate|create|make)/i,
    ];
    
    for (const pattern of variationPatterns) {
      if (pattern.test(message)) {
        // Extract any additional prompt/instructions from the message
        const prompt = message
          .replace(pattern, '')
          .replace(/^[\s,.:]+/, '')
          .trim();
        return { isVariation: true, prompt: prompt || undefined };
      }
    }
    
    return { isVariation: false };
  };
  
  // Open variation dialog with chat context
  const openVariationFromChat = (additionalPrompt?: string) => {
    if (!activeChapter) {
      const errorMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `❌ No chapter is currently selected. Please select a chapter first to generate a variation.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }
    
    const chatSuggestions = collectChatSuggestions();
    setVariationChatContext(chatSuggestions);
    setVariationInitialPrompt(additionalPrompt || '');
    setVariationDialogOpen(true);
    
    // Add a message indicating the dialog is opening
    const assistantMsg: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: `✨ Opening the Chapter Variation dialog for "${activeChapter.title}"...\n\nI've included our recent conversation as context for generating the variation. You can review the suggestions and customize the prompt before generating.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMsg]);
  };

  // Handle local commands that don't need AI (like clipboard operations)
  const handleLocalCommand = (message: string): boolean => {
    const lowerMessage = message.toLowerCase();
    
    // Check for variation generation request
    const variationCheck = isVariationRequest(message);
    if (variationCheck.isVariation) {
      openVariationFromChat(variationCheck.prompt);
      return true;
    }
    
    // Check for clipboard copy commands
    const copyMatch = lowerMessage.match(/copy\s+(?:chapters?\s+)?(\d+)(?:\s*(?:to|through|thru|-|–)\s*(\d+))?\s+(?:to\s+)?(?:my\s+)?clipboard/i) ||
                      lowerMessage.match(/(?:put|send|get)\s+(?:chapters?\s+)?(\d+)(?:\s*(?:to|through|thru|-|–)\s*(\d+))?\s+(?:to|in|on)\s+(?:my\s+)?clipboard/i);
    
    if (copyMatch) {
      const startChapter = parseInt(copyMatch[1], 10);
      const endChapter = copyMatch[2] ? parseInt(copyMatch[2], 10) : startChapter;
      
      // Validate chapter numbers
      if (startChapter < 1 || endChapter > book.chapters.length) {
        const errorMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `❌ Invalid chapter range. Your book has ${book.chapters.length} chapters (1-${book.chapters.length}).`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }
      
      // Extract chapter content
      const chaptersToExport: string[] = [];
      for (let i = Math.min(startChapter, endChapter); i <= Math.max(startChapter, endChapter); i++) {
        const chapter = book.chapters[i - 1];
        if (chapter) {
          const chapterText = extractText(chapter.content);
          chaptersToExport.push(`${chapter.title}\n\n${chapterText}`);
        }
      }
      
      const combinedText = chaptersToExport.join('\n\n---\n\n');
      
      // Copy to clipboard
      navigator.clipboard.writeText(combinedText).then(() => {
        const chapterRange = startChapter === endChapter 
          ? `Chapter ${startChapter}` 
          : `Chapters ${Math.min(startChapter, endChapter)}-${Math.max(startChapter, endChapter)}`;
        
        const successMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Copied ${chapterRange} to clipboard!**\n\n${chaptersToExport.length} chapter${chaptersToExport.length > 1 ? 's' : ''} copied (${combinedText.length.toLocaleString()} characters).`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, successMsg]);
      }).catch(err => {
        const errorMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `❌ Failed to copy to clipboard: ${err.message}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
      });
      
      return true; // Command was handled
    }
    
    // Check for "copy current chapter" command
    if (lowerMessage.includes('copy') && (lowerMessage.includes('current chapter') || lowerMessage.includes('this chapter')) && lowerMessage.includes('clipboard')) {
      if (!activeChapter) {
        const errorMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `❌ No chapter is currently selected.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
        return true;
      }
      
      const chapterText = extractText(activeChapter.content);
      const combinedText = `${activeChapter.title}\n\n${chapterText}`;
      
      navigator.clipboard.writeText(combinedText).then(() => {
        const successMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Copied "${activeChapter.title}" to clipboard!**\n\n${combinedText.length.toLocaleString()} characters copied.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, successMsg]);
      });
      
      return true;
    }
    
    return false; // Command was not handled locally
  };

  const sendUserMessageToApi = async (userMessage: string) => {
    const mentionedChapters = findMentionedChapters(userMessage);
    if (mentionedChapters.length > 0) {
      const chapterNums = mentionedChapters.map(c => book.chapters.findIndex(ch => ch.id === c.id) + 1);
      console.log('[ChatBot] Loaded chapters into context:', chapterNums.join(', '));
      console.log('[ChatBot] Chapter titles:', mentionedChapters.map(c => c.title).join(', '));
    } else {
      console.log('[ChatBot] No additional chapters mentioned in message');
    }

    // Build conversation for API with mentioned chapters included
    // IMPORTANT: System prompt is generated fresh each time to include current chapter context
    // We do NOT store it in conversationHistory to prevent memory bloat
    const systemPrompt = getSystemPrompt(mentionedChapters);
    
    // Only keep recent conversation turns (without system prompt) to limit memory
    // The system prompt with chapter text is generated fresh each time
    const recentHistory = conversationHistory
      .filter(m => m.role !== 'system')
      .slice(-MAX_CONVERSATION_TURNS * 2); // Keep last N user+assistant pairs
    
    const newHistory: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: userMessage },
    ];

    setIsLoading(true);

    try {
      // Use tool calling API
      const response = await openAIService.chatWithTools(newHistory);
      
      let editCount = 0;
      let responseContent = response.content || '';
      
      // Execute any tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('[ChatBot] Received tool calls:', response.toolCalls.length);
        console.log('[ChatBot] Tool calls:', JSON.stringify(response.toolCalls, null, 2));
        const toolResult = executeToolCalls(response.toolCalls);
        editCount = toolResult.successCount;
        
        // Generate detailed summary with actual changes
        if (toolResult.changes.length > 0) {
          const changeList = toolResult.changes.map(c => `- ${c}`).join('\n');
          const failedCount = response.toolCalls.length - editCount;
          const failedChanges = toolResult.attemptedChanges.filter(a => a.error);
          
          if (!responseContent) {
            responseContent = `**Edit Results:**\n\n${changeList}`;
            if (editCount > 0) {
              responseContent += `\n\n✅ Successfully applied ${editCount} change${editCount > 1 ? 's' : ''}.`;
            }
            if (failedCount > 0 && failedChanges.length > 0) {
              responseContent += `\n\n---\n**${failedCount} change${failedCount > 1 ? 's' : ''} not applied automatically** — use the suggested edits below to apply manually:\n\n`;
              responseContent += failedChanges.map((a, i) => {
                return `**Change ${i + 1} — copy & apply:**\n• **Replace this:**\n\`\`\`\n${a.find}\n\`\`\`\n• **With this:**\n\`\`\`\n${a.replace}\n\`\`\``;
              }).join('\n\n');
            }
          } else {
            // Append change summary to existing content
            responseContent += `\n\n---\n**Changes Made:**\n${changeList}`;
            if (failedCount > 0 && failedChanges.length > 0) {
              responseContent += `\n\n---\n**${failedCount} change${failedCount > 1 ? 's' : ''} not applied** — apply manually:\n\n`;
              responseContent += failedChanges.map((a, i) => {
                return `**Change ${i + 1}:**\n• **Replace this:**\n\`\`\`\n${a.find}\n\`\`\`\n• **With this:**\n\`\`\`\n${a.replace}\n\`\`\``;
              }).join('\n\n');
            }
          }
        } else if (!responseContent && response.toolCalls.length > 0) {
          // Text not found — always give suggested changes in chat so user can apply manually
          if (toolResult.attemptedChanges.length > 0) {
            const failedChanges = toolResult.attemptedChanges.filter(a => a.error);
            const anyWithDetails = failedChanges.length > 0 ? failedChanges : toolResult.attemptedChanges;
            responseContent = `I couldn't apply these changes automatically (the text didn't match exactly in the document). **Here are the suggested edits — you can copy and apply them manually:**\n\n`;
            responseContent += anyWithDetails.map((a, i) => {
              return `**Change ${i + 1}:**\n• **Replace this:**\n\`\`\`\n${a.find}\n\`\`\`\n• **With this:**\n\`\`\`\n${a.replace}\n\`\`\``;
            }).join('\n\n');
          } else {
            responseContent = `I couldn't apply the requested changes automatically. The text in your document may differ slightly (e.g. smart quotes, whitespace). Try copying the exact passage from your chapter and asking me to change that specific text — I'll then give you the replacement to paste in.`;
          }
        }
      }
      
      // Fallback: check for legacy command format in content
      if (editCount === 0 && responseContent) {
        const { cleanResponse, commands } = parseCommands(responseContent);
        if (commands.length > 0 && commands[0].type !== 'none') {
          editCount = executeCommands(commands);
          responseContent = cleanResponse;
        }
      }

      // Add assistant message to display
      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        editCount: editCount,
      };
      
      // Update conversation history - only keep user/assistant messages (no system prompt)
      // This prevents storing full chapter text in memory
      const updatedHistory = [
        ...recentHistory,
        { role: 'user' as const, content: userMessage },
        { role: 'assistant' as const, content: responseContent },
      ].slice(-MAX_CONVERSATION_TURNS * 2); // Limit total history size
      
      setMessages(prev => {
        const newMsgs = [...prev, assistantMsg];
        // Save after state update - only display messages
        setTimeout(() => saveChat(newMsgs), 0);
        return newMsgs;
      });
      setConversationHistory(updatedHistory);

    } catch (error) {
      const errorMsg: DisplayMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => {
        const newMsgs = [...prev, errorMsg];
        setTimeout(() => saveChat(newMsgs), 0);
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  sendUserMessageToApiRef.current = sendUserMessageToApi;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    const userDisplayMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => {
      const newMsgs = [...prev, userDisplayMsg];
      setTimeout(() => saveChat(newMsgs), 0);
      return newMsgs;
    });
    
    if (handleLocalCommand(userMessage)) return;
    await sendUserMessageToApi(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    setMessages([]);
    setConversationHistory([]);
    // Also clear from IndexedDB
    await saveChatToDB(book.id, []);
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <BotIcon />
        <span>AI Chat</span>
        <select 
          className="chatbot-model-select"
          value={currentModel}
          onChange={(e) => handleModelChange(e.target.value)}
          title="Select AI model"
        >
          {AI_MODELS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {messages.length > 0 && (
          <button className="chatbot-clear" onClick={clearChat} title="Clear chat">
            Clear
          </button>
        )}
      </div>

      <div className="chatbot-messages">
        {messages.length === 0 ? (
          <div className="chatbot-empty">
            <BotIcon />
            <p>Ask me anything about your book!</p>
            <div className="chatbot-suggestions">
              {isOutlinerActive ? (
                <button onClick={() => setInput('Please create chapters based on the current outline and write a short description in each chapter that summarizes the chapter\'s main focus, themes, character development and plot points.')}>
                  Create chapters from outline
                </button>
              ) : null}
              <button onClick={() => setInput('Review my current chapter and suggest improvements')}>
                Review & improve chapter
              </button>
              <button onClick={() => setInput('Fix any grammar or spelling issues in this chapter')}>
                Fix grammar/spelling
              </button>
              <button onClick={() => setInput('Make the dialogue more natural in this chapter')}>
                Improve dialogue
              </button>
              <button onClick={() => setInput('Generate a variation of this chapter')}>
                ✨ Generate variation
              </button>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`chatbot-message ${msg.role}`}>
              <div className="chatbot-message-icon">
                {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
              </div>
              <div className="chatbot-message-content">
                <div 
                  className="chatbot-message-text"
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                />
                {msg.editCount && msg.editCount > 0 && (
                  <div className="chatbot-message-actions">
                    <span className="action-badge">✓ Made {msg.editCount} edit{msg.editCount > 1 ? 's' : ''} to the document</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="chatbot-message assistant">
            <div className="chatbot-message-icon">
              <BotIcon />
            </div>
            <div className="chatbot-message-content">
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatbot-input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or request an edit..."
          rows={2}
          disabled={isLoading}
        />
        <button 
          className="chatbot-send" 
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <SendIcon />
        </button>
      </div>
      
      {/* Chapter Variation Dialog */}
      <ChapterVariationDialog
        isOpen={variationDialogOpen}
        onClose={() => {
          setVariationDialogOpen(false);
          setVariationChatContext('');
          setVariationInitialPrompt('');
        }}
        chapterId={activeChapter?.id || ''}
        chatSuggestions={variationChatContext}
        initialPrompt={variationInitialPrompt}
      />
    </div>
  );
};

