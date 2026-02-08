import { AISuggestion, StoryCraftChecklistItem, VariationSettings, DEFAULT_VARIATION_SETTINGS, DraftLengthTarget, BookContextSettings } from '../../shared/types';

interface SummarizeResult {
  summary: string;
  keyPoints: string[];
}

interface ExtractedCharacter {
  name: string;
  aliases?: string[];
  description?: string;
}

interface ExtractedLocation {
  name: string;
  description?: string;
  type?: string;
}

interface ExtractedTimelineEvent {
  description: string;
  date?: string;
  sortDate?: string; // ISO date for sorting
  dateType: 'exact' | 'approximate' | 'relative' | 'unknown';
  eventType: 'current' | 'past' | 'future' | 'flashback';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChangeReportItem {
  category: 'pacing' | 'dialogue' | 'tension' | 'character' | 'theme' | 'hook' | 'clarity';
  description: string;
  scoreTargeted: string;
}

export interface ChangeReport {
  summary: string;
  changes: ChangeReportItem[];
  preservedElements: string[];
  wordCountChange: number;
}

export interface ChatCommand {
  type: 'edit_chapter' | 'edit_character' | 'edit_location' | 'edit_timeline' | 'edit_summary' | 'replace_text' | 'none';
  target?: string; // ID or name of the target
  field?: string; // Which field to edit
  value?: string; // New value
  explanation?: string; // Why this change
  chapterId?: string; // For replace_text command
  find?: string; // For replace_text command - text to find
  replace?: string; // For replace_text command - replacement text
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponseWithTools {
  content: string | null;
  toolCalls: ToolCall[] | null;
}

class OpenAIService {
  private apiKey: string | null = null;
  private model = 'gpt-5.2';
  private baseUrl = 'https://api.openai.com/v1';

  constructor() {
    // Load model from storage on init
    this.loadModel();
    
    // Listen for model changes
    if (typeof window !== 'undefined') {
      window.addEventListener('openai-model-changed', ((event: CustomEvent) => {
        this.model = event.detail.model;
        console.log('[OpenAI] Model changed to:', this.model);
      }) as EventListener);
    }
  }

  private async loadModel() {
    try {
      const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
      
      if (!isElectron) {
        const model = localStorage.getItem('openai-model');
        if (model) {
          this.model = model;
        }
        return;
      }
      
      const model = await window.electronAPI.storeGet('openai-model');
      if (model) {
        this.model = model as string;
      }
      console.log('[OpenAI] Loaded model:', this.model);
    } catch (error) {
      console.error('[OpenAI] Failed to load model:', error);
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setModel(model: string) {
    this.model = model;
    console.log('[OpenAI] Model set to:', model);
  }

  getModel(): string {
    return this.model;
  }

  private async chat(systemPrompt: string, userMessage: string, options?: { temperature?: number }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }

    const temperature = options?.temperature ?? 0.7;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Tool definitions for the chatbot
  private getTools() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'replace_text',
          description: 'Replace text in a chapter. Use this to make edits to the document when the user asks for changes, improvements, or fixes.',
          parameters: {
            type: 'object',
            properties: {
              chapter_id: {
                type: 'string',
                description: 'The ID of the chapter to edit (from the chapter list provided)'
              },
              find_text: {
                type: 'string',
                description: 'The exact text to find and replace. Must match exactly what is in the document. Keep this short (1-2 sentences) for reliable matching.'
              },
              replace_with: {
                type: 'string',
                description: 'The new text to replace the found text with'
              },
              explanation: {
                type: 'string',
                description: 'Brief explanation of why this change is being made'
              }
            },
            required: ['chapter_id', 'find_text', 'replace_with']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'edit_chapter_title',
          description: 'Change the title of a chapter',
          parameters: {
            type: 'object',
            properties: {
              chapter_id: {
                type: 'string',
                description: 'The ID of the chapter'
              },
              new_title: {
                type: 'string',
                description: 'The new title for the chapter'
              }
            },
            required: ['chapter_id', 'new_title']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'edit_character',
          description: 'Update character information',
          parameters: {
            type: 'object',
            properties: {
              character_id: {
                type: 'string',
                description: 'The ID of the character'
              },
              field: {
                type: 'string',
                enum: ['name', 'description', 'aliases'],
                description: 'Which field to update'
              },
              value: {
                type: 'string',
                description: 'The new value (for aliases, comma-separated)'
              }
            },
            required: ['character_id', 'field', 'value']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'edit_location',
          description: 'Update location information',
          parameters: {
            type: 'object',
            properties: {
              location_id: {
                type: 'string',
                description: 'The ID of the location'
              },
              field: {
                type: 'string',
                enum: ['name', 'description', 'type'],
                description: 'Which field to update'
              },
              value: {
                type: 'string',
                description: 'The new value'
              }
            },
            required: ['location_id', 'field', 'value']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'add_comment',
          description: 'Add an inline comment to specific text in the chapter. Use this to highlight text that needs attention, has issues, or is working well. Comments appear as colored highlights in the editor.',
          parameters: {
            type: 'object',
            properties: {
              chapter_id: {
                type: 'string',
                description: 'The ID of the chapter to add the comment to'
              },
              target_text: {
                type: 'string',
                description: 'The exact text to attach the comment to. This text will be highlighted in the editor. Keep it short (1-3 sentences) for precise targeting.'
              },
              comment_text: {
                type: 'string',
                description: 'The comment explaining the issue, suggestion, or praise'
              },
              comment_type: {
                type: 'string',
                enum: ['suggestion', 'issue', 'praise', 'question', 'note'],
                description: 'Type of comment: suggestion (for improvements), issue (for problems), praise (for what works well), question (for clarification needed), note (general observations)'
              },
              category: {
                type: 'string',
                enum: ['plot', 'character', 'dialogue', 'pacing', 'theme', 'style', 'grammar', 'general'],
                description: 'Category of the comment for organization'
              }
            },
            required: ['chapter_id', 'target_text', 'comment_text', 'comment_type']
          }
        }
      }
    ];
  }

  // Multi-turn conversation for chatbot (legacy - no tools)
  async chatConversation(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Multi-turn conversation with tool calling support
  async chatWithTools(messages: ChatMessage[]): Promise<ChatResponseWithTools> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: this.getTools(),
        tool_choice: 'auto', // Let the model decide when to use tools
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    
    return {
      content: message?.content || null,
      toolCalls: message?.tool_calls || null,
    };
  }

  // Parse commands from AI response for editing content
  async parseEditCommands(
    userRequest: string, 
    context: {
      chapters: { id: string; title: string }[];
      characters: { id: string; name: string }[];
      locations: { id: string; name: string }[];
      timeline: { id: string; description: string }[];
      summaries: { chapterId: string; }[];
    }
  ): Promise<ChatCommand[]> {
    const systemPrompt = `You are a helpful assistant that interprets edit requests for a book editing app.
The user wants to make changes to their book data. Parse their request into structured commands.

Available data:
- Chapters: ${context.chapters.map(c => `"${c.title}" (id: ${c.id})`).join(', ')}
- Characters: ${context.characters.map(c => `"${c.name}" (id: ${c.id})`).join(', ')}
- Locations: ${context.locations.map(l => `"${l.name}" (id: ${l.id})`).join(', ')}
- Timeline events: ${context.timeline.length} events
- Summaries: ${context.summaries.length} chapter summaries

Return a JSON array of commands:
[{
  "type": "edit_chapter" | "edit_character" | "edit_location" | "edit_timeline" | "edit_summary" | "none",
  "target": "id of the item to edit",
  "field": "the field to change (e.g., 'name', 'description', 'content')",
  "value": "the new value",
  "explanation": "why this change is being made"
}]

If the request is not about editing, return [{"type": "none"}].
If multiple edits are needed, return multiple commands.`;

    const response = await this.chat(systemPrompt, userRequest);
    
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [{ type: 'none' }];
    } catch {
      return [{ type: 'none' }];
    }
  }

  async summarize(text: string, chapterTitle: string): Promise<SummarizeResult> {
    const systemPrompt = `You are a literary assistant helping an author understand their manuscript. 
Provide a concise summary and key points for the given chapter text.
Respond in JSON format: { "summary": "string", "keyPoints": ["string", ...] }
Keep the summary under 200 words and provide 3-5 key points.`;

    const response = await this.chat(
      systemPrompt,
      `Chapter: "${chapterTitle}"\n\nText:\n${text}`
    );

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { summary: response, keyPoints: [] };
    } catch {
      return { summary: response, keyPoints: [] };
    }
  }

  /** Variation hints to force different titles on repeated clicks (random one appended when previousSuggestion is set). */
  private static readonly TITLE_VARIATION_HINTS = [
    'This time use a different angle: focus on a character emotion or inner state, not the same theme as before.',
    'This time use a different angle: focus on place, setting, or a key object in the scene.',
    'This time use a different angle: focus on an action or turning point, not a static image.',
    'This time try a more metaphorical or symbolic title; avoid repeating the same kind of phrasing.',
    'This time try a more direct or concrete title; avoid repeating the same kind of phrasing.',
    'This time try a title that could be a question or that hints at something unresolved.',
    'This time try a title that emphasizes tension, conflict, or surprise.',
    'This time try a title that emphasizes mood or atmosphere (e.g. quiet, ominous, hopeful).',
  ];

  /** Generate a short chapter title from full chapter content and optional Story Craft summary. Pass previousSuggestion to get a different title on repeated clicks. */
  async generateChapterTitle(chapterText: string, storyCraftSummary?: string, previousSuggestion?: string): Promise<string> {
    const context = storyCraftSummary
      ? `Story Craft summary for this chapter:\n${storyCraftSummary}\n\nFull chapter text:\n${chapterText}`
      : `Full chapter text:\n${chapterText}`;
    let systemPrompt = `You are a literary assistant. Suggest a single, short chapter title (2-8 words) that captures the chapter's content and narrative role.
Consider the full chapter—the main idea or payoff may be in the middle or end. Return only the title, no quotes or explanation. The title should be evocative and fit a novel (e.g. "The Letter", "Crossing the River", "What She Found").`;
    let userContent = context;
    if (previousSuggestion?.trim()) {
      systemPrompt += `\n\nThe user already saw this suggestion and wants a *different* title. You must suggest a new title that is not the same and not a minor rewording.`;
      const hint = OpenAIService.TITLE_VARIATION_HINTS[Math.floor(Math.random() * OpenAIService.TITLE_VARIATION_HINTS.length)];
      userContent = `Previous suggestion (do not repeat): "${previousSuggestion.trim()}"\n\n${hint}\n\n${context}`;
    }

    const response = await this.chat(systemPrompt, userContent, { temperature: 0.9 });
    const title = (response || '').trim().replace(/^["']|["']$/g, '').slice(0, 120);
    return title || 'Untitled';
  }

  async checkGrammar(text: string): Promise<Omit<AISuggestion, 'id'>[]> {
    const systemPrompt = `You are a professional editor. Analyze the text for grammar, spelling, and style issues.
Respond in JSON format as an array of suggestions:
[{
  "type": "grammar" | "spelling" | "style" | "content" | "flow",
  "severity": "info" | "warning" | "error",
  "message": "description of the issue",
  "suggestion": "how to fix it",
  "originalText": "the problematic text (if applicable)"
}]
Limit to the 10 most important issues. Focus on clarity and readability.`;

    const response = await this.chat(
      systemPrompt,
      `Please review this text:\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  }

  async extractCharacters(text: string, chapterId: string): Promise<ExtractedCharacter[]> {
    const systemPrompt = `You are a literary analyst. Extract all character names mentioned in the text.
For each character, provide their name, any aliases or nicknames, and a brief description if available from context.
Respond in JSON format:
[{
  "name": "Full Name",
  "aliases": ["Nickname", "Title", etc],
  "description": "Brief description from context"
}]
Only include actual characters (people), not places or objects.`;

    const response = await this.chat(
      systemPrompt,
      `Extract characters from this chapter:\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  }

  async extractLocations(text: string, chapterId: string): Promise<ExtractedLocation[]> {
    const systemPrompt = `You are a literary analyst. Extract all locations/places mentioned in the text.
For each location, provide its name, a brief description if available, and type (city, building, country, room, etc).
Respond in JSON format:
[{
  "name": "Location Name",
  "description": "Brief description from context",
  "type": "city" | "building" | "country" | "region" | "room" | "other"
}]
Include both real and fictional places mentioned.`;

    const response = await this.chat(
      systemPrompt,
      `Extract locations from this chapter:\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  }

  async extractTimeline(
    text: string, 
    chapterId: string,
    bookContext?: BookContextSettings
  ): Promise<ExtractedTimelineEvent[]> {
    // Build context string for timeline accuracy
    let contextInfo = '';
    if (bookContext) {
      const parts: string[] = [];
      if (bookContext.year) parts.push(`Year/Time Setting: ${bookContext.year}`);
      if (bookContext.timePeriod) parts.push(`Time Period: ${bookContext.timePeriod}`);
      if (bookContext.primaryLocation) parts.push(`Location: ${bookContext.primaryLocation}`);
      if (parts.length > 0) {
        contextInfo = `\n\n**BOOK CONTEXT FOR TIMELINE ACCURACY:**\n${parts.join('\n')}\n\nUse this context to ensure timeline events are accurate for the time period and location.`;
      }
    }

    const systemPrompt = `You are a literary analyst specializing in narrative timeline analysis. Extract any timeline events or temporal references from the text.

For each event, determine:
1. **description**: What happened
2. **date**: The date/time reference as mentioned in the text (e.g., "two weeks later", "June 15th", "the following morning")
3. **sortDate**: An estimated ISO date string for chronological sorting. Use relative dates if needed (e.g., if the story seems contemporary, estimate actual dates. If unclear, leave empty).
4. **dateType**: How precise is the date?
   - "exact": A specific date is mentioned (e.g., "March 15, 1985")
   - "approximate": A rough time period (e.g., "spring of that year", "around midnight")
   - "relative": Referenced relative to another event (e.g., "two days later", "before the war")
   - "unknown": No clear time reference
5. **eventType**: Is this event happening in the narrative present, or is it a reference to the past/future?
   - "current": Happening now in the story
   - "past": A past event being referenced or remembered
   - "flashback": An extended flashback scene
   - "future": A future event being referenced or foreshadowed

${contextInfo}

Respond in JSON format:
[{
  "description": "What happened",
  "date": "Date or time reference as written",
  "sortDate": "YYYY-MM-DD or empty string",
  "dateType": "exact" | "approximate" | "relative" | "unknown",
  "eventType": "current" | "past" | "future" | "flashback"
}]

This helps authors verify their timeline is consistent and plausible.`;

    const response = await this.chat(
      systemPrompt,
      `Extract timeline events from this chapter:\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const events = JSON.parse(jsonMatch[0]);
        // Ensure all required fields have defaults
        return events.map((e: any) => ({
          description: e.description || '',
          date: e.date,
          sortDate: e.sortDate || undefined,
          dateType: e.dateType || 'unknown',
          eventType: e.eventType || 'current',
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async analyzeContentFlow(text: string): Promise<string> {
    const systemPrompt = `You are a professional editor specializing in narrative flow and structure.
Analyze the text for pacing, transitions, and overall flow. Provide constructive feedback.
Keep your response under 300 words.`;

    return await this.chat(
      systemPrompt,
      `Analyze the flow of this text:\n\n${text}`
    );
  }

  // Story Craft Assessment with Summary and Promises Tracking
  async extractStoryCraftFeedback(
    text: string, 
    chapterId: string, 
    chapterTitle: string,
    bookContext?: { 
      themes?: string; 
      previousFeedback?: string;
      previousPromises?: Array<{
        id: string;
        type: string;
        description: string;
        chapterId: string;
        chapterTitle: string;
      }>;
      bookSettings?: BookContextSettings;
      /** Author-indicated chapter purpose (e.g. climax, setup) for assessing whether chapter fulfills it */
      chapterPurpose?: string;
    }
  ): Promise<{
    assessment: {
      plotProgression: { score: number; notes: string };
      characterDevelopment: { score: number; notes: string };
      themeReinforcement: { score: number; notes: string };
      pacing: { score: number; notes: string };
      conflictTension: { score: number; notes: string };
      hookEnding: { score: number; notes: string };
      overallNotes: string;
    };
    checklist: Array<{
      category: string;
      suggestion: string;
    }>;
    summary: string;
    promisesMade: Array<{
      type: 'foreshadowing' | 'question' | 'setup' | 'tension' | 'mystery';
      description: string;
      context: string;
    }>;
    promisesKept: Array<{
      promiseId: string;
      promiseDescription: string;
      howKept: string;
      chapterWherePromised: string;
      chapterTitleWherePromised: string;
    }>;
  } | null> {
    // Build book settings section for Story Craft context
    let bookSettingsInfo = '';
    if (bookContext?.bookSettings) {
      const bs = bookContext.bookSettings;
      const parts: string[] = [];
      if (bs.genre) parts.push(`Genre: ${bs.genre}${bs.subGenres?.length ? ` (${bs.subGenres.join(', ')})` : ''}`);
      if (bs.targetDemographic) parts.push(`Target Audience / Age Level: ${bs.targetDemographic}`);
      if (bs.timePeriod) parts.push(`Time Period: ${bs.timePeriod}`);
      if (bs.year) parts.push(`Year / Time Setting: ${bs.year}`);
      if (bs.primaryLocation) parts.push(`Setting: ${bs.primaryLocation}`);
      if (bs.additionalContext) parts.push(`Style Notes: ${bs.additionalContext}`);
      
      if (parts.length > 0) {
        bookSettingsInfo = `\n\n**BOOK CONTEXT (assess appropriateness for):**\n${parts.join('\n')}`;
      }
    }
    
    const contextInfo = bookContext?.themes 
      ? `\n\nKnown themes in this book: ${bookContext.themes}` 
      : '';
    const purposeInfo = bookContext?.chapterPurpose
      ? `\n\n**CHAPTER PURPOSE (author-indicated):** The author has indicated this chapter's purpose is: "${bookContext.chapterPurpose}". Assess whether the chapter fulfills this purpose and note any gaps.`
      : '';
    const previousInfo = bookContext?.previousFeedback
      ? `\n\nPrevious feedback items to check if addressed: ${bookContext.previousFeedback}`
      : '';
    
    // Build previous promises section for the prompt
    let previousPromisesInfo = '';
    if (bookContext?.previousPromises && bookContext.previousPromises.length > 0) {
      previousPromisesInfo = `\n\n**PREVIOUS NARRATIVE PROMISES TO CHECK:**
The following promises, questions, setups, or tensions were introduced in earlier chapters. Identify which ones (if any) are addressed, resolved, or paid off in THIS chapter:

${bookContext.previousPromises.map(p => `- [ID: ${p.id}] (${p.type} from "${p.chapterTitle}"): ${p.description}`).join('\n')}`;
    }

    const systemPrompt = `You are a professional story craft analyst and developmental editor. Assess this chapter comprehensively.
${bookSettingsInfo}

**SCORING (1-5 scale):**
1 = Poor/Missing, 2 = Needs significant work, 3 = Adequate but could improve, 4 = Good, 5 = Excellent

**Categories to assess:**
1. **Plot Progression**: Does the chapter advance the main plot? Does something meaningful happen?
2. **Character Development**: Do characters grow, change, or reveal new facets?
3. **Theme Reinforcement**: Are the story's themes present and developed?
4. **Pacing**: Is the chapter well-paced? Does it drag or rush?
5. **Conflict/Tension**: Does it build, maintain, or resolve tension appropriately?
6. **Hook/Ending**: Does it pull the reader to continue? Strong chapter ending?

**ALSO PROVIDE:**
1. **Summary**: A concise 2-3 sentence summary of what happens in this chapter.
2. **Promises Made**: Identify any narrative promises introduced in THIS chapter:
   - Foreshadowing (hints at future events)
   - Questions (mysteries or questions raised for the reader)
   - Setups (elements that will likely pay off later)
   - Tension (unresolved conflicts or suspense)
   - Mystery (unexplained elements that create intrigue)
3. **Promises Kept**: If previous promises are provided, identify which are addressed/resolved here.
4. **Improvement Checklist**: Specific, actionable improvements.${contextInfo}${purposeInfo}${previousInfo}${previousPromisesInfo}

Respond in JSON format:
{
  "summary": "2-3 sentence summary of what happens in this chapter",
  "assessment": {
    "plotProgression": { "score": 1-5, "notes": "specific feedback" },
    "characterDevelopment": { "score": 1-5, "notes": "specific feedback" },
    "themeReinforcement": { "score": 1-5, "notes": "specific feedback" },
    "pacing": { "score": 1-5, "notes": "specific feedback" },
    "conflictTension": { "score": 1-5, "notes": "specific feedback" },
    "hookEnding": { "score": 1-5, "notes": "specific feedback" },
    "overallNotes": "general observations and strengths"
  },
  "checklist": [
    { "category": "plot|character|theme|pacing|conflict|hook|general", "suggestion": "specific actionable improvement" }
  ],
  "promisesMade": [
    { "type": "foreshadowing|question|setup|tension|mystery", "description": "what is promised/set up", "context": "brief quote or reference from the chapter" }
  ],
  "promisesKept": [
    { "promiseId": "ID from previous promises list", "promiseDescription": "the original promise", "howKept": "how it was resolved in this chapter", "chapterWherePromised": "chapter ID", "chapterTitleWherePromised": "chapter title" }
  ]
}

Note: promisesMade and promisesKept can be empty arrays if none apply to this chapter.`;

    const response = await this.chat(
      systemPrompt,
      `Analyze this chapter for story craft:\n\nChapter: ${chapterTitle}\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Log if summary is missing for debugging
        if (!parsed.summary) {
          console.warn(`[StoryCraft] No summary returned for chapter "${chapterTitle}". Response keys:`, Object.keys(parsed));
        }
        
        // Ensure arrays and required fields exist even if AI doesn't return them
        return {
          ...parsed,
          summary: parsed.summary || '',
          promisesMade: parsed.promisesMade || [],
          promisesKept: parsed.promisesKept || [],
        };
      }
      console.warn(`[StoryCraft] Could not parse JSON from response for chapter "${chapterTitle}"`);
      return null;
    } catch (err) {
      console.error(`[StoryCraft] JSON parse error for chapter "${chapterTitle}":`, err);
      return null;
    }
  }

  // Story Craft Assessment
  async assessStoryCraft(
    text: string,
    chapterId: string,
    chapterTitle: string
  ): Promise<{
    assessment: {
      plotProgression: { score: number; notes: string };
      characterDevelopment: { score: number; notes: string };
      themeReinforcement: { score: number; notes: string };
      pacing: { score: number; notes: string };
      conflictTension: { score: number; notes: string };
      hookEnding: { score: number; notes: string };
      overallNotes: string;
    };
    checklist: Array<{
      suggestion: string;
      category: 'plot' | 'character' | 'theme' | 'pacing' | 'conflict' | 'hook' | 'general';
    }>;
  } | null> {
    const systemPrompt = `You are an experienced book editor providing constructive feedback on a chapter.

Assess the chapter on these criteria (1-5 scale, where 5 is excellent):
1. **Plot Progression**: Does the chapter advance the story meaningfully?
2. **Character Development**: Do characters grow, reveal depth, or change?
3. **Theme Reinforcement**: Are the story's themes present and developed?
4. **Pacing**: Is the chapter well-paced? Does it flow well?
5. **Conflict/Tension**: Is there appropriate tension or conflict?
6. **Hook/Ending**: Does the chapter end in a way that makes readers want to continue?

For each criterion, provide a score AND specific notes about that aspect.
Then provide a checklist of specific, actionable improvements.

Respond in JSON format:
{
  "assessment": {
    "plotProgression": { "score": 4, "notes": "Good forward momentum with the discovery scene" },
    "characterDevelopment": { "score": 3, "notes": "Sarah shows growth but Tom remains static" },
    "themeReinforcement": { "score": 4, "notes": "Theme of sacrifice is well-developed" },
    "pacing": { "score": 3, "notes": "Middle section drags slightly" },
    "conflictTension": { "score": 4, "notes": "Strong internal conflict established" },
    "hookEnding": { "score": 5, "notes": "Excellent cliffhanger" },
    "overallNotes": "This chapter effectively advances the plot with strong tension. Consider adding more sensory details and deepening character introspection."
  },
  "checklist": [
    { "suggestion": "Add sensory details to the market scene", "category": "pacing" },
    { "suggestion": "Clarify protagonist's motivation for entering the forest", "category": "character" },
    { "suggestion": "Strengthen the connection to the theme of redemption", "category": "theme" }
  ]
}`;

    const response = await this.chat(
      systemPrompt,
      `Assess this chapter for story craft:\n\nChapter: ${chapterTitle}\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch {
      return null;
    }
  }

  // Generate inline comments for StoryCraft feedback
  async generateStoryCraftComments(
    text: string,
    chapterId: string,
    chapterTitle: string
  ): Promise<Array<{
    targetText: string;
    comment: string;
    type: 'suggestion' | 'issue' | 'praise';
    category: 'plot' | 'character' | 'dialogue' | 'pacing' | 'theme' | 'style' | 'general';
  }>> {
    const systemPrompt = `You are an experienced book editor providing inline feedback on a chapter.

Your task is to identify SPECIFIC passages in the text and provide targeted feedback.

For each comment, you MUST:
1. Quote a SHORT passage from the text (1-2 sentences max) - this must be EXACT text from the chapter
2. Provide constructive feedback about that specific passage
3. Categorize as: suggestion (improvement ideas), issue (problems), or praise (what works well)
4. Assign a category: plot, character, dialogue, pacing, theme, style, or general

Aim for 8-12 comments covering different aspects:
- 2-3 praise comments (highlight what's working well)
- 3-4 suggestion comments (improvement opportunities)  
- 2-3 issue comments (problems to fix)

Respond in JSON format:
{
  "comments": [
    {
      "targetText": "exact quoted text from the chapter",
      "comment": "Your feedback about this specific passage",
      "type": "praise",
      "category": "dialogue"
    },
    {
      "targetText": "another exact quoted text",
      "comment": "Suggestion for improvement",
      "type": "suggestion", 
      "category": "pacing"
    }
  ]
}

IMPORTANT: The targetText MUST be exact quotes from the chapter that can be found in the text.`;

    const response = await this.chat(
      systemPrompt,
      `Provide inline story craft feedback for this chapter:\n\nChapter: ${chapterTitle}\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.comments || [];
      }
      return [];
    } catch {
      console.error('Failed to parse StoryCraft comments');
      return [];
    }
  }

  // Themes and Motifs Extraction
  async extractThemesAndMotifs(
    text: string,
    chapterId: string,
    chapterTitle: string,
    existingThemes?: { themes: any[]; motifs: any[]; symbols: any[] }
  ): Promise<{
    themes: Array<{
      name: string;
      type: 'major' | 'minor';
      description: string;
      manifestation: string;
    }>;
    motifs: Array<{
      name: string;
      description: string;
      context: string;
    }>;
    symbols: Array<{
      name: string;
      meaning: string;
      context: string;
    }>;
    evolutionNotes?: string;
  } | null> {
    const existingContext = existingThemes 
      ? `\n\nExisting themes already identified in the book:
Themes: ${existingThemes.themes.map(t => t.name).join(', ') || 'None yet'}
Motifs: ${existingThemes.motifs.map(m => m.name).join(', ') || 'None yet'}
Symbols: ${existingThemes.symbols.map(s => s.name).join(', ') || 'None yet'}

Look for these existing elements AND identify any new ones. Note how themes evolve or deepen.`
      : '';

    const systemPrompt = `You are a literary analyst specializing in thematic analysis. Extract themes, motifs, and symbols from this chapter.

**Themes**: Abstract ideas or concepts explored (e.g., "coming of age", "redemption", "loss of innocence")
- Major themes: Central to the story's meaning
- Minor themes: Supporting or secondary ideas

**Motifs**: Recurring elements, images, or ideas (e.g., "water imagery", "the color red", "locked doors")

**Symbols**: Specific objects or elements with deeper meaning (e.g., "the mockingbird = innocence", "the green light = hope")
${existingContext}

Respond in JSON format:
{
  "themes": [
    { "name": "Theme Name", "type": "major" or "minor", "description": "What this theme explores", "manifestation": "How it appears in this chapter" }
  ],
  "motifs": [
    { "name": "Motif Name", "description": "What this motif represents", "context": "How it appears in this chapter" }
  ],
  "symbols": [
    { "name": "Symbol Name", "meaning": "What it symbolizes", "context": "How it's used in this chapter" }
  ],
  "evolutionNotes": "How themes/motifs develop or change in this chapter compared to earlier (if applicable)"
}`;

    const response = await this.chat(
      systemPrompt,
      `Extract themes, motifs, and symbols from this chapter:\n\nChapter: ${chapterTitle}\n\n${text}`
    );

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch {
      return null;
    }
  }

  // Result type for chapter variation
  // Generate a chapter variation based on Story Craft feedback, chat suggestions, custom prompt, and settings
  async generateChapterVariation(
    originalContent: string,
    chapterTitle: string,
    storyCraftSuggestions: StoryCraftChecklistItem[],
    customPrompt: string,
    bookContext?: {
      characters?: string;
      locations?: string;
      previousChaptersSummary?: string;
      nextChaptersSummary?: string;
      themes?: string;
      chatContext?: string;
      originalWordCount?: number;
      currentScores?: {
        plotProgression?: number;
        characterDevelopment?: number;
        pacing?: number;
        conflictTension?: number;
        hookEnding?: number;
        themeReinforcement?: number;
      };
      bookSettings?: BookContextSettings;
      previousChapterContent?: string;
      previousChapterTitle?: string;
      nextChapterContent?: string;
      nextChapterTitle?: string;
      chapterComments?: Array<{ type: string; category?: string; text: string; targetText?: string }>;
      /** Timeline events relevant to current chapter (canon) */
      timelineEvents?: string;
      /** Story so far from plot analysis or all previous summaries */
      plotArc?: string;
      /** Known plot/timeline/character errors affecting this chapter – do not reinforce */
      knownErrorsToAvoid?: string;
      /** Previous chapters’ Story Craft summary + promises (optional) */
      storyCraftArc?: string;
      chapterPurpose?: string;
    },
    settings: VariationSettings = DEFAULT_VARIATION_SETTINGS
  ): Promise<{ text: string; changeReport: ChangeReport }> {
    // Build book settings section for AI context
    let bookSettingsSection = '';
    if (bookContext?.bookSettings) {
      const bs = bookContext.bookSettings;
      const parts: string[] = [];
      if (bs.genre) parts.push(`Genre: ${bs.genre}${bs.subGenres?.length ? ` (${bs.subGenres.join(', ')})` : ''}`);
      if (bs.targetDemographic) parts.push(`Target Audience: ${bs.targetDemographic}`);
      if (bs.timePeriod) parts.push(`Time Period: ${bs.timePeriod}`);
      if (bs.primaryLocation) parts.push(`Setting: ${bs.primaryLocation}`);
      if (bs.additionalContext) parts.push(`Style Notes: ${bs.additionalContext}`);
      
      if (parts.length > 0) {
        bookSettingsSection = `\n\n=== BOOK CONTEXT ===\n${parts.join('\n')}\n\nEnsure all writing matches this genre, audience, time period, and setting.`;
      }
    }

    // Canon rule: only use what is in the reference sections; do not invent facts
    const canonRule = '\n\n**Canon rule:** Only use characters, locations, timeline events, and plot events that appear in the reference sections below. Do not invent new facts, names, or events; if something is not in the context, do not add it. Do not add references to events, characters, or places that are not listed in the reference sections or in the chapter text itself.';

    // Build context information - this is for REFERENCE ONLY, not for adding content
    let contextInfo = '';
    if (bookContext) {
      if (bookContext.timelineEvents) {
        contextInfo += `\n\n**[REFERENCE] Timeline (use only these dates/events):**\n${bookContext.timelineEvents}`;
      }
      if (bookContext.plotArc) {
        contextInfo += `\n\n**[REFERENCE] Story so far (canon):**\n${bookContext.plotArc}`;
      }
      if (bookContext.knownErrorsToAvoid) {
        contextInfo += `\n\n**[CRITICAL] Known issues (do NOT introduce or reinforce):**\nThe following issues have been identified in or near this chapter. Your revision must not introduce or worsen them.\n${bookContext.knownErrorsToAvoid}`;
      }
      if (bookContext.storyCraftArc) {
        contextInfo += `\n\n**[REFERENCE] Previous chapters (Story Craft – promises and payoffs):**\n${bookContext.storyCraftArc}`;
      }
      if (bookContext.chapterPurpose) {
        contextInfo += `\n\n**[REFERENCE] This chapter's purpose (align your revision with this):** ${bookContext.chapterPurpose}`;
      }
      if (bookContext.characters) {
        contextInfo += `\n\n**[REFERENCE] Characters (for consistency):**\n${bookContext.characters}`;
      }
      if (bookContext.locations) {
        contextInfo += `\n\n**[REFERENCE] Locations (for consistency):**\n${bookContext.locations}`;
      }
      if (bookContext.themes) {
        contextInfo += `\n\n**[REFERENCE] Themes (reinforce these where they already appear):**\n${bookContext.themes}`;
      }
      if (bookContext.previousChaptersSummary) {
        contextInfo += `\n\n**[REFERENCE] Previous chapters (do NOT add references to events not in original):**\n${bookContext.previousChaptersSummary}`;
      }
      if (bookContext.nextChaptersSummary) {
        contextInfo += `\n\n**[REFERENCE] Future chapters (for continuity awareness):**\n${bookContext.nextChaptersSummary}`;
      }
      if (bookContext.chatContext) {
        contextInfo += `\n\n**Additional context:**\n${bookContext.chatContext}`;
      }
      // Include adjacent chapter content for better prose continuity
      if (bookContext.previousChapterContent) {
        contextInfo += `\n\n=== PREVIOUS CHAPTER ENDING (${bookContext.previousChapterTitle || 'Previous'}) ===\nMatch your opening to flow naturally from this:\n\n${bookContext.previousChapterContent}`;
      }
      if (bookContext.nextChapterContent) {
        contextInfo += `\n\n=== NEXT CHAPTER BEGINNING (${bookContext.nextChapterTitle || 'Next'}) ===\nYour ending should lead into this:\n\n${bookContext.nextChapterContent}`;
      }
      if (bookContext.chapterComments && bookContext.chapterComments.length > 0) {
        contextInfo += `\n\n=== CHAPTER COMMENTS (address these in your revision) ===\nThe author/editor left these comments on the chapter. Incorporate the feedback where relevant:\n${bookContext.chapterComments.map(c => {
          const loc = c.targetText ? ` (on: "${c.targetText.length > 60 ? c.targetText.slice(0, 57) + '...' : c.targetText}")` : '';
          return `• [${c.type}]${c.category ? ` (${c.category})` : ''}${loc}: ${c.text}`;
        }).join('\n')}`;
      }
    }

    // Build suggestions section with emphasis on addressing them (only for story_craft type)
    let suggestionsSection = '';
    if (settings.variationType === 'story_craft' && storyCraftSuggestions.length > 0) {
      const uncompleted = storyCraftSuggestions.filter(s => !s.isCompleted);
      if (uncompleted.length > 0) {
        suggestionsSection = `\n\n**STORY CRAFT ISSUES TO ADDRESS (these are why scores are low):**\n${uncompleted.map(s => `- [${s.category.toUpperCase()}] ${s.suggestion}`).join('\n')}`;
      }
    }

    // Build current scores section (only for story_craft type)
    let scoresSection = '';
    if (settings.variationType === 'story_craft' && bookContext?.currentScores) {
      const scores = bookContext.currentScores;
      scoresSection = `\n\n**CURRENT STORY CRAFT SCORES (your goal is to improve these):**
- Plot Progression: ${scores.plotProgression || '?'}/5
- Character Development: ${scores.characterDevelopment || '?'}/5
- Pacing: ${scores.pacing || '?'}/5
- Conflict/Tension: ${scores.conflictTension || '?'}/5
- Hook/Ending: ${scores.hookEnding || '?'}/5
- Theme Reinforcement: ${scores.themeReinforcement || '?'}/5`;
    }

    // Word count guidance based on length target
    const originalWordCount = bookContext?.originalWordCount || 0;
    const lengthMultiplier = settings.lengthTarget / 100;
    const targetWords = Math.round(originalWordCount * lengthMultiplier);
    const minWords = Math.round(targetWords * 0.95);
    const maxWords = Math.round(targetWords * 1.05);

    // Build length instruction based on target
    let lengthInstruction = '';
    if (settings.lengthTarget < 100) {
      lengthInstruction = `CONDENSE the text to approximately ${settings.lengthTarget}% of original length (~${targetWords} words).
Focus on: removing redundancy, tightening prose, combining sentences, cutting unnecessary words.`;
    } else if (settings.lengthTarget > 100) {
      lengthInstruction = `EXPAND the text to approximately ${settings.lengthTarget}% of original length (~${targetWords} words).
Focus on: enriching existing scenes, deepening descriptions, expanding emotional moments (no new plot).`;
    } else {
      lengthInstruction = `MAINTAIN approximately the same length (~${targetWords} words, ±5%).`;
    }

    // Determine temperature based on creativity setting
    let temperature: number;
    let creativityInstruction: string;
    switch (settings.creativity) {
      case 'strict':
        temperature = 0.3;
        creativityInstruction = `STRICT MODE: Make minimal, surgical changes. Preserve the author's voice exactly. Only fix clear issues.`;
        break;
      case 'loose':
        temperature = 0.8;
        creativityInstruction = `CREATIVE MODE: Feel free to rephrase, restructure sentences, and try different approaches while keeping the same plot.`;
        break;
      default: // moderate
        temperature = 0.5;
        creativityInstruction = `BALANCED MODE: Make thoughtful improvements while respecting the author's style.`;
    }

    // Build system prompt based on variation type
    let missionSection: string;
    let allowedSection: string;
    let forbiddenSection: string;

    switch (settings.variationType) {
      case 'fix_errors':
        missionSection = `=== YOUR MISSION: FIX ERRORS ===
You are a meticulous COPY EDITOR. Your job is to fix errors while preserving the author's voice.

Focus on:
- Grammar and spelling mistakes
- Punctuation errors
- Awkward sentence construction
- Continuity errors (character names, pronouns, etc.)
- Tense consistency
- Subject-verb agreement`;
        allowedSection = `✅ ALLOWED:
- Fix grammar, spelling, and punctuation
- Correct awkward phrasing
- Fix continuity errors
- Improve clarity of confusing sentences
- Fix tense inconsistencies`;
        forbiddenSection = `🚫 FORBIDDEN:
- Changing the style or voice
- Adding new content
- Removing content that isn't clearly erroneous
- Changing word choices that aren't errors`;
        break;

      case 'add_color':
        missionSection = `=== YOUR MISSION: ADD COLOR ===
You are a DESCRIPTIVE EDITOR. Your job is to enrich the prose with sensory details and atmosphere.

Focus on:
- Sensory details (sight, sound, smell, touch, taste)
- Atmospheric descriptions
- Emotional depth in existing moments
- Vivid imagery for existing scenes
- Character physical reactions and body language`;
        allowedSection = `✅ ALLOWED:
- Add sensory details to existing descriptions
- Deepen the atmosphere of existing scenes
- Expand character emotional reactions
- Add vivid imagery to existing moments
- Enrich dialogue tags with action beats`;
        forbiddenSection = `🚫 FORBIDDEN:
- Adding new scenes or events
- Adding new dialogue content
- Introducing new characters or plot elements
- Changing what happens in the story
- Adding backstory or flashbacks`;
        break;

      case 'refine_prose':
        missionSection = `=== YOUR MISSION: REFINE PROSE ===
You are a PROSE STYLIST. Your job is to elevate the writing quality without changing the content.

Focus on:
- Word choice and vocabulary
- Sentence rhythm and flow
- Paragraph structure
- Eliminating clichés
- Strengthening verbs (show don't tell)
- Varying sentence length for better pacing`;
        allowedSection = `✅ ALLOWED:
- Improve word choices
- Vary sentence structure
- Eliminate clichés and weak verbs
- Improve prose rhythm
- Tighten or expand sentences for flow
- Make descriptions more vivid`;
        forbiddenSection = `🚫 FORBIDDEN:
- Adding new content or scenes
- Changing dialogue meaning
- Altering plot events
- Adding new information
- Changing character actions or decisions`;
        break;

      case 'generate_draft':
        // Special case - generating new content, not refining
        // This will be handled separately below
        missionSection = '';
        allowedSection = '';
        forbiddenSection = '';
        break;

      default: // story_craft
        missionSection = `=== YOUR MISSION: MAXIMIZE STORY CRAFT SCORES ===
You are an expert DEVELOPMENTAL EDITOR. Your goal is to IMPROVE STORY CRAFT SCORES while preserving the plot.

Focus on improving:
- Plot Progression (clearer story advancement)
- Character Development (deeper character moments)  
- Pacing (better rhythm and flow)
- Conflict/Tension (heightened stakes in existing conflicts)
- Hook/Ending (stronger chapter ending)
- Theme Reinforcement (themes resonate more clearly)`;
        allowedSection = `✅ ALLOWED (improves scores without changing plot):
- Strengthen existing emotional beats
- Sharpen dialogue that's already there
- Enhance sensory details in existing descriptions
- Improve pacing by tightening or expanding existing scenes
- Make existing tension more palpable
- Clarify character motivations that are already implied
- Make the ending line more impactful
- Reinforce themes where they already appear`;
        forbiddenSection = `🚫 FORBIDDEN (changes plot):
- Adding new scenes, events, or actions
- Adding new dialogue or conversations
- Introducing new characters or conflicts
- Adding backstory or flashbacks
- Creating new subplots or story threads
- Changing what happens or how scenes resolve`;
    }

    // Special handling for generate_draft - completely different prompt
    if (settings.variationType === 'generate_draft') {
      return this.generateDraftChapter(
        chapterTitle,
        customPrompt,
        bookContext,
        settings,
        temperature
      );
    }

    const systemPrompt = `${missionSection}
${bookSettingsSection}
${creativityInstruction}

=== CRITICAL CONSTRAINT: NO PLOT CHANGES ===
You must improve HOW the story is told, not WHAT happens.

${allowedSection}

${forbiddenSection}

=== LENGTH TARGET ===
Original: ${originalWordCount} words.
Target: ${targetWords} words (${settings.lengthTarget}% of original).
Acceptable range: ${minWords}-${maxWords} words.
${lengthInstruction}
${canonRule}
${contextInfo}${scoresSection}

=== OUTPUT FORMAT ===
Return a JSON object with two fields:
1. "refinedText": The improved chapter prose (no titles/headers)
2. "changeReport": An object documenting your changes:
   {
     "summary": "2-3 sentence overview of refinements made",
     "changes": [
       {
         "category": "pacing|dialogue|tension|character|theme|hook|clarity",
         "description": "What you changed and why",
         "scoreTargeted": "Which score this aims to improve"
       }
     ],
     "preservedElements": ["List of plot elements kept exactly as-is"],
     "wordCountChange": number (positive or negative)
   }`;

    // Build user message based on type
    const typeLabels: Record<string, string> = {
      story_craft: 'Improve Story Craft scores',
      fix_errors: 'Fix errors',
      add_color: 'Add color and sensory detail',
      refine_prose: 'Refine prose quality',
    };

    const userMessage = `${typeLabels[settings.variationType] || 'Refine'} in this chapter (target: ${settings.lengthTarget}% length, ${settings.creativity} creativity).
${suggestionsSection}
${customPrompt ? `\n**Author's request:** ${customPrompt}` : ''}

[ORIGINAL CHAPTER: "${chapterTitle}" - ${originalWordCount} words]
${originalContent}
[END ORIGINAL]

Return JSON with "refinedText" and "changeReport":`;

    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          text: parsed.refinedText || content,
          changeReport: parsed.changeReport || {
            summary: 'Changes were made but no detailed report was generated.',
            changes: [],
            preservedElements: [],
            wordCountChange: 0
          }
        };
      }
    } catch (e) {
      console.warn('[Variation] Could not parse JSON response, using raw text');
    }
    
    // Fallback if JSON parsing fails - return raw content
    return {
      text: content,
      changeReport: {
        summary: 'Refinements were made.',
        changes: [],
        preservedElements: [],
        wordCountChange: 0
      }
    };
  }

  // Generate a draft chapter from scratch based on surrounding chapter context
  private async generateDraftChapter(
    chapterTitle: string,
    customPrompt: string,
    bookContext?: {
      characters?: string;
      locations?: string;
      previousChaptersSummary?: string;
      nextChaptersSummary?: string;
      themes?: string;
      chatContext?: string;
      originalWordCount?: number;
      bookSettings?: BookContextSettings;
      previousChapterContent?: string;
      previousChapterTitle?: string;
      nextChapterContent?: string;
      nextChapterTitle?: string;
    },
    settings?: VariationSettings,
    temperature: number = 0.7
  ): Promise<{ text: string; changeReport: ChangeReport }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }

    const targetWordCount = settings?.draftWordCount || 2000;
    const minWords = Math.round(targetWordCount * 0.85);
    const maxWords = Math.round(targetWordCount * 1.15);

    // Build book settings section for AI context
    let bookSettingsSection = '';
    if (bookContext?.bookSettings) {
      const bs = bookContext.bookSettings;
      const parts: string[] = [];
      if (bs.genre) parts.push(`Genre: ${bs.genre}${bs.subGenres?.length ? ` (${bs.subGenres.join(', ')})` : ''}`);
      if (bs.targetDemographic) parts.push(`Target Audience: ${bs.targetDemographic}`);
      if (bs.timePeriod) parts.push(`Time Period: ${bs.timePeriod}`);
      if (bs.primaryLocation) parts.push(`Setting: ${bs.primaryLocation}`);
      if (bs.additionalContext) parts.push(`Style Notes: ${bs.additionalContext}`);
      
      if (parts.length > 0) {
        bookSettingsSection = `\n=== BOOK CONTEXT ===\n${parts.join('\n')}\n\nEnsure the chapter matches this genre, audience, time period, and setting.\n`;
      }
    }

    // Build rich context for the draft
    let contextInfo = '';
    if (bookContext) {
      if (bookContext.characters) {
        contextInfo += `\n\n**CHARACTERS (use these, maintain their voices and personalities):**\n${bookContext.characters}`;
      }
      if (bookContext.locations) {
        contextInfo += `\n\n**LOCATIONS (use these where appropriate):**\n${bookContext.locations}`;
      }
      if (bookContext.themes) {
        contextInfo += `\n\n**THEMES (weave these throughout):**\n${bookContext.themes}`;
      }
      if (bookContext.previousChaptersSummary) {
        contextInfo += `\n\n**PREVIOUS CHAPTERS (what happened before - continue from here):**\n${bookContext.previousChaptersSummary}`;
      }
      if (bookContext.nextChaptersSummary) {
        contextInfo += `\n\n**FUTURE CHAPTERS (what needs to happen later - set up these events):**\n${bookContext.nextChaptersSummary}`;
      }
      if (bookContext.chatContext) {
        contextInfo += `\n\n**ADDITIONAL CONTEXT:**\n${bookContext.chatContext}`;
      }
      // Include adjacent chapter FULL CONTENT for seamless continuity in drafts
      if (bookContext.previousChapterContent) {
        contextInfo += `\n\n=== PREVIOUS CHAPTER ENDING (${bookContext.previousChapterTitle || 'Previous'}) ===
**CRITICAL: Your chapter must continue seamlessly from where this ends. Match the tone, pacing, and any unresolved moments.**

${bookContext.previousChapterContent}`;
      }
      if (bookContext.nextChapterContent) {
        contextInfo += `\n\n=== NEXT CHAPTER BEGINNING (${bookContext.nextChapterTitle || 'Next'}) ===
**CRITICAL: Your chapter must set up and lead naturally into this. Don't duplicate content but ensure a smooth handoff.**

${bookContext.nextChapterContent}`;
      }
    }

    const systemPrompt = `You are an expert FICTION WRITER creating a draft chapter for a novel.
${bookSettingsSection}

=== YOUR MISSION ===
Write a complete chapter that fits seamlessly into the existing story. You are creating NEW CONTENT based on the surrounding chapters and author's instructions.

=== WHAT YOU MUST DO ===
✅ Write engaging, well-paced prose
✅ Use the existing characters with consistent voices
✅ Continue naturally from where previous chapters left off
✅ Set up events that will happen in future chapters (if provided)
✅ Include dialogue, action, and internal character moments
✅ Match the tone and style of the surrounding story
✅ Create a chapter with a clear beginning, middle, and end
✅ End with a hook or moment that makes the reader want to continue

=== STYLE GUIDELINES ===
- Write in the same POV and tense as the surrounding chapters
- Show don't tell - use concrete sensory details
- Vary sentence length for good pacing
- Include both action/dialogue and reflection/emotion
- Create natural scene transitions if multiple scenes

=== LENGTH TARGET ===
Target: ${targetWordCount} words
Acceptable range: ${minWords}-${maxWords} words
${contextInfo}

=== OUTPUT FORMAT ===
Return a JSON object with two fields:
1. "refinedText": The complete chapter prose (no chapter title/header, just the content)
2. "changeReport": An object documenting what you created:
   {
     "summary": "2-3 sentence overview of what happens in this chapter",
     "changes": [
       {
         "category": "pacing|dialogue|tension|character|theme|hook|clarity",
         "description": "Key element you included",
         "scoreTargeted": "What story craft aspect this serves"
       }
     ],
     "preservedElements": ["Continuity elements from surrounding chapters you honored"],
     "wordCountChange": ${targetWordCount} (the word count since starting from 0)
   }`;

    const userMessage = `Write a draft chapter titled "${chapterTitle}".

**AUTHOR'S INSTRUCTIONS:**
${customPrompt || 'No specific instructions provided. Use the context from surrounding chapters to determine what should happen in this chapter.'}

Create a complete, engaging chapter of approximately ${targetWordCount} words that advances the story naturally.

Return JSON with "refinedText" (the chapter content) and "changeReport":`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: temperature,
        max_completion_tokens: 8000, // Enough for a longer chapter
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const draftText = parsed.refinedText || '';
        const wordCount = draftText.trim().split(/\s+/).filter(Boolean).length;
        
        return {
          text: draftText,
          changeReport: parsed.changeReport || {
            summary: `Generated a draft chapter of approximately ${wordCount} words.`,
            changes: [
              {
                category: 'clarity' as const,
                description: 'Created new chapter content based on surrounding context',
                scoreTargeted: 'Story continuity and flow'
              }
            ],
            preservedElements: ['Character voices', 'Story continuity', 'Thematic elements'],
            wordCountChange: wordCount
          }
        };
      }
    } catch (e) {
      console.warn('[Draft] Could not parse JSON response, using raw text');
    }
    
    // Fallback - try to extract just the prose if JSON parsing fails
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    return {
      text: content,
      changeReport: {
        summary: `Generated a draft chapter of approximately ${wordCount} words.`,
        changes: [],
        preservedElements: [],
        wordCountChange: wordCount
      }
    };
  }

  // Text-to-Speech generation using OpenAI TTS API
  async generateSpeech(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
    onProgress?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for speech generation.');
    }

    // OpenAI TTS has a 4096 character limit per request
    const MAX_CHUNK_SIZE = 4000; // Leave some buffer
    const chunks = this.splitTextIntoChunks(text, MAX_CHUNK_SIZE);
    
    console.log(`[OpenAI TTS] Generating speech for ${text.length} characters in ${chunks.length} chunk(s)`);
    
    const audioChunks: ArrayBuffer[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[OpenAI TTS] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      try {
        const response = await fetch(`${this.baseUrl}/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: chunk,
            voice: voice,
            response_format: 'mp3',
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error?.message || `OpenAI TTS API error: ${response.status}`);
        }

        const audioBuffer = await response.arrayBuffer();
        audioChunks.push(audioBuffer);
        
        // Report progress
        if (onProgress) {
          onProgress(Math.round(((i + 1) / chunks.length) * 100));
        }
        
        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`[OpenAI TTS] Error processing chunk ${i + 1}:`, error);
        throw error;
      }
    }

    // Concatenate all audio chunks
    return this.concatenateAudioBuffers(audioChunks);
  }

  // Split text into chunks at sentence boundaries
  private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split by sentences (period, exclamation, question mark followed by space or end)
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      // If a single sentence is too long, split it by commas or spaces
      if (sentence.length > maxChunkSize) {
        // First, save current chunk if not empty
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Split long sentence by clauses (commas)
        const clauses = sentence.split(/(?<=,)\s*/);
        for (const clause of clauses) {
          if (clause.length > maxChunkSize) {
            // Last resort: split by spaces at maxChunkSize boundary
            let remaining = clause;
            while (remaining.length > maxChunkSize) {
              const splitIndex = remaining.lastIndexOf(' ', maxChunkSize);
              const index = splitIndex > 0 ? splitIndex : maxChunkSize;
              chunks.push(remaining.substring(0, index).trim());
              remaining = remaining.substring(index).trim();
            }
            if (remaining) {
              currentChunk = remaining + ' ';
            }
          } else if ((currentChunk + clause).length > maxChunkSize) {
            chunks.push(currentChunk.trim());
            currentChunk = clause + ' ';
          } else {
            currentChunk += clause + ' ';
          }
        }
      } else if ((currentChunk + sentence).length > maxChunkSize) {
        // Current chunk would exceed limit, save it and start new one
        chunks.push(currentChunk.trim());
        currentChunk = sentence + ' ';
      } else {
        currentChunk += sentence + ' ';
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  // Concatenate multiple audio ArrayBuffers into one
  private concatenateAudioBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    if (buffers.length === 0) {
      return new ArrayBuffer(0);
    }
    
    if (buffers.length === 1) {
      return buffers[0];
    }

    // Calculate total length
    const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    
    // Create new buffer and copy all data
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
      result.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    
    return result.buffer;
  }

  // Plot Error Analysis using reasoning models with thinking mode
  async analyzePlotErrors(
    windowChapters: Array<{
      chapterId: string;
      chapterTitle: string;
      order: number;
      summary?: string;
      storyCraftSummary?: string;
      storyCraftAssessment?: {
        plotProgression?: { score: number; notes: string };
        characterDevelopment?: { score: number; notes: string };
        themeReinforcement?: { score: number; notes: string };
      };
    }>,
    bookContext: {
      genre?: string;
      subGenres?: string[];
      targetDemographic?: string;
      timePeriod?: string;
      year?: string;
      primaryLocation?: string;
      characters?: Array<{ name: string; aliases?: string[] }>;
      locations?: Array<{ name: string; type?: string }>;
    },
    previousErrors?: Array<{
      type: string;
      description: string;
      affectedChapters: string[];
    }>,
    maxTokensPerPass: number = 100000 // o1 model max is 100000 completion tokens
  ): Promise<{
    chapterAnalyses: Array<{
      chapterId: string;
      chapterTitle: string;
      proposedTitle?: string;
      roles: string[];
      plotSummary?: string;
      chapterTheme?: string;
    }>;
    errors: Array<{
      type: string;
      severity: string;
      description: string;
      context?: string;
      affectedChapters: string[];
    }>;
  }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }

    // Use reasoning model (o1 or o3-mini)
    // Note: o1-preview was deprecated, use o1 instead
    const reasoningModel = 'o1'; // Can be made configurable

    // Build book context string
    let bookContextStr = '';
    if (bookContext.genre) {
      bookContextStr += `Genre: ${bookContext.genre}`;
      if (bookContext.subGenres && bookContext.subGenres.length > 0) {
        bookContextStr += ` (${bookContext.subGenres.join(', ')})`;
      }
      bookContextStr += '\n';
    }
    if (bookContext.targetDemographic) {
      bookContextStr += `Target Audience / Age Level: ${bookContext.targetDemographic}\n`;
    }
    if (bookContext.timePeriod) {
      bookContextStr += `Time Period: ${bookContext.timePeriod}\n`;
    }
    if (bookContext.year) {
      bookContextStr += `Year / Time Setting: ${bookContext.year}\n`;
    }
    if (bookContext.primaryLocation) {
      bookContextStr += `Primary Location: ${bookContext.primaryLocation}\n`;
    }
    if (bookContext.characters && bookContext.characters.length > 0) {
      bookContextStr += `\nCharacters:\n${bookContext.characters.map(c => {
        const aliases = c.aliases && c.aliases.length > 0 ? ` (also known as: ${c.aliases.join(', ')})` : '';
        return `- ${c.name}${aliases}`;
      }).join('\n')}\n`;
    }
    if (bookContext.locations && bookContext.locations.length > 0) {
      bookContextStr += `\nLocations:\n${bookContext.locations.map(l => {
        const type = l.type ? ` (${l.type})` : '';
        return `- ${l.name}${type}`;
      }).join('\n')}\n`;
    }

    // Build chapter summaries for the window
    const chapterSummaries = windowChapters.map(ch => {
      const summary = ch.storyCraftSummary || ch.summary || 'No summary available';
      const assessment = ch.storyCraftAssessment;
      let assessmentStr = '';
      if (assessment) {
        assessmentStr = `\nStory Craft Scores:\n`;
        if (assessment.plotProgression) {
          assessmentStr += `- Plot Progression: ${assessment.plotProgression.score}/5 - ${assessment.plotProgression.notes}\n`;
        }
        if (assessment.characterDevelopment) {
          assessmentStr += `- Character Development: ${assessment.characterDevelopment.score}/5 - ${assessment.characterDevelopment.notes}\n`;
        }
        if (assessment.themeReinforcement) {
          assessmentStr += `- Theme Reinforcement: ${assessment.themeReinforcement.score}/5 - ${assessment.themeReinforcement.notes}\n`;
        }
      }
      return `Chapter ${ch.order}: "${ch.chapterTitle}"\n${summary}${assessmentStr}`;
    }).join('\n\n---\n\n');

    // Build previous errors context
    let previousErrorsStr = '';
    if (previousErrors && previousErrors.length > 0) {
      previousErrorsStr = `\n\nPREVIOUS ERRORS FOUND (for continuity checking):\n${previousErrors.map(e => 
        `- [${e.type}] ${e.description} (affects chapters: ${e.affectedChapters.join(', ')})`
      ).join('\n')}`;
    }

    const systemPrompt = `You are an expert story analyst and developmental editor specializing in identifying plot errors, inconsistencies, and narrative problems in fiction.

Your task is to analyze a window of chapters (${windowChapters.length} chapters) and identify:
1. **Plot Errors**: Name mismatches, plot holes, timeline mistakes, character inconsistencies, location mistakes, genre problems, feasibility issues, and clarity issues
2. **Chapter Analysis**: For each chapter, propose a better title (if needed), identify its role(s) in the story, and provide a brief plot summary

**ERROR TYPES TO IDENTIFY:**
- name_mismatch: Character or location names that are inconsistent (e.g., "John" vs "Jon", "New York" vs "NYC" without explanation)
- plot_hole: Missing explanations, unresolved threads, logical gaps
- timeline_mistake: Temporal inconsistencies, impossible time sequences
- character_inconsistency: Behavior, personality, or physical description contradictions
- location_mistake: Geographic or logical location errors
- genre_problem: Elements inconsistent with the stated genre
- feasibility_issue: Unrealistic elements for the time period/location
- clarity_issue: Insufficient detail for readers to suspend disbelief

**CHAPTER ROLES:**
Identify what role each chapter plays: setup, introduction, development, exploration, rising_action, climax, falling_action, resolution, transition, bridge, character_development, world_building

**SEVERITY LEVELS:**
- critical: Breaks the story or makes it impossible to follow
- major: Significant issue that damages reader experience
- minor: Noticeable but doesn't break the story
- suggestion: Improvement opportunity

Respond in JSON format:
{
  "chapterAnalyses": [
    {
      "chapterId": "chapter-id",
      "chapterTitle": "Current Title",
      "proposedTitle": "Better Title (if current is generic/weak)",
      "roles": ["role1", "role2"],
      "plotSummary": "Brief summary of what happens in this chapter",
      "chapterTheme": "One sentence theme of the chapter"
    }
  ],
  "errors": [
    {
      "type": "plot_hole",
      "severity": "major",
      "description": "Clear description of the error",
      "context": "Additional context or quote from text",
      "affectedChapters": ["chapter-id-1", "chapter-id-2"]
    }
  ]
}`;

    const userMessage = `Analyze these chapters for plot errors and provide chapter analysis:

${bookContextStr ? `BOOK CONTEXT:\n${bookContextStr}\n` : ''}

CHAPTERS TO ANALYZE:
${chapterSummaries}${previousErrorsStr}

Provide comprehensive analysis focusing on plot continuity, character consistency, timeline accuracy, and narrative coherence.`;

    try {
      console.log('[PlotAnalysis] Starting analysis with model:', reasoningModel);
      console.log('[PlotAnalysis] Analyzing', windowChapters.length, 'chapters');
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: reasoningModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_completion_tokens: Math.min(maxTokensPerPass, 100000), // Enforce o1 model limit
        }),
      });
      
      console.log('[PlotAnalysis] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
        console.error('[PlotAnalysis] API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log('[PlotAnalysis] Received response, content length:', content.length);
      
      if (!content) {
        console.error('[PlotAnalysis] Empty response from API');
        throw new Error('Empty response from OpenAI API. The model may not have generated any content.');
      }

      // Parse JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          console.log('[PlotAnalysis] Parsed successfully:', {
            chapterAnalyses: parsed.chapterAnalyses?.length || 0,
            errors: parsed.errors?.length || 0,
          });
          
          // Ensure arrays exist and include chapterTheme
          return {
            chapterAnalyses: (parsed.chapterAnalyses || []).map((ca: any) => ({
              ...ca,
              chapterTheme: ca.chapterTheme || undefined,
            })),
            errors: parsed.errors || [],
          };
        }
        throw new Error('No JSON found in response');
      } catch (parseError) {
        console.error('[PlotAnalysis] JSON parse error:', parseError);
        console.error('[PlotAnalysis] Response content (first 500 chars):', content.substring(0, 500));
        throw new Error(`Failed to parse plot analysis response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[PlotAnalysis] Error analyzing plot errors:', error);
      throw error;
    }
  }

  /**
   * Create a short DALL-E prompt from chapter text. Prioritizes scenes that are drawn/described
   * or key visual moments. Used for consistent pen-on-paper illustrations.
   */
  async createIllustrationPromptFromChapter(
    chapterText: string,
    contextAroundCursor?: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }
    const textToUse = (contextAroundCursor && contextAroundCursor.trim().length > 0)
      ? contextAroundCursor
      : chapterText;
    const truncated = textToUse.slice(0, 4000);
    const systemPrompt = `You are an expert at turning prose into a single, concrete image description for illustration.
Your task: given a passage from a story, output ONE short image prompt (2-5 sentences) that describes exactly what to draw.

CRITICAL - Character appearance must be honored:
- If the text describes what characters are WEARING (costumes, outfits, clothing, uniforms, accessories, hats, etc.), you MUST include those details in the image prompt. Every specified costume or attire must appear in your description.
- Include any stated physical details (hair, build, distinctive features) so the illustration matches the text.
- If it says "both wearing costumes" or "in costume" or names specific attire, the image prompt must explicitly describe those costumes/outfits.

Scene choice:
- If the passage explicitly describes something being drawn, sketched, or illustrated, use that as the main subject.
- Otherwise pick the most vivid, visual moment or scene (characters in a specific place, a key action, or a striking detail).
- Include setting and one clear focal point.

Output ONLY the image description, no preamble or "Illustration:" label.`;
    const userMessage = `Passage:\n\n${truncated}\n\nGive a single image prompt for this passage. You must include exactly what each character is wearing (costumes, clothing, outfits) as described in the text—do not omit or generalize their attire.`;
    const raw = await this.chat(systemPrompt, userMessage, { temperature: 0.5 });
    const cleaned = raw.replace(/^Illustration:\s*/i, '').trim();
    return cleaned;
  }

  /**
   * Generate an image with DALL-E 3. Style: pen on paper, detailed, consistent.
   * Returns base64 data URL so it can be embedded in the document (URLs expire in 60 min).
   */
  async generateIllustration(imagePrompt: string): Promise<{ url?: string; b64_json?: string }> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not set. Please configure in Settings.');
    }
    const styleSuffix = ' Pen and ink on paper, detailed, consistent black and white illustration style.';
    const fullPrompt = imagePrompt.trim().replace(/\.+$/, '') + styleSuffix;

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: fullPrompt.slice(0, 4000),
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural',
        response_format: 'b64_json',
      }),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = responseBody?.error?.message || responseBody?.error?.code || `OpenAI Images API error: ${response.status}`;
      throw new Error(typeof msg === 'string' ? msg : `OpenAI Images API error: ${response.status}`);
    }

    const data = responseBody as { data?: Array<{ url?: string; b64_json?: string }> };
    const first = data.data?.[0];
    if (!first) {
      throw new Error('No image in response. The API may have changed.');
    }
    return { b64_json: first.b64_json, url: first.url };
  }

  /**
   * Full flow: create illustration prompt from chapter (optionally focused on cursor context),
   * then generate image. Returns data URL for embedding.
   */
  async generateChapterIllustration(
    chapterText: string,
    contextAroundCursor?: string
  ): Promise<string> {
    const prompt = await this.createIllustrationPromptFromChapter(chapterText, contextAroundCursor);
    const result = await this.generateIllustration(prompt);
    if (result.b64_json) {
      return `data:image/png;base64,${result.b64_json}`;
    }
    // Fallback: if API returned URL only (e.g. some accounts), fetch and convert to data URL
    if (result.url) {
      try {
        const imageResponse = await fetch(result.url);
        if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        const blob = await imageResponse.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return dataUrl;
      } catch (e) {
        throw new Error(
          'Image was returned as a URL that could not be loaded. Try again or use an account that supports base64 image response.'
        );
      }
    }
    throw new Error('No image data returned from OpenAI.');
  }
}

export const openAIService = new OpenAIService();
