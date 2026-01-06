import { AISuggestion } from '../../shared/types';

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

  private async chat(systemPrompt: string, userMessage: string): Promise<string> {
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
      `Chapter: "${chapterTitle}"\n\nText:\n${text.substring(0, 8000)}`
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
      `Please review this text:\n\n${text.substring(0, 8000)}`
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
      `Extract characters from this chapter:\n\n${text.substring(0, 8000)}`
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
      `Extract locations from this chapter:\n\n${text.substring(0, 8000)}`
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

  async extractTimeline(text: string, chapterId: string): Promise<ExtractedTimelineEvent[]> {
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
      `Extract timeline events from this chapter:\n\n${text.substring(0, 8000)}`
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
      `Analyze the flow of this text:\n\n${text.substring(0, 8000)}`
    );
  }

  // Story Craft Assessment
  async extractStoryCraftFeedback(
    text: string, 
    chapterId: string, 
    chapterTitle: string,
    bookContext?: { themes?: string; previousFeedback?: string }
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
  } | null> {
    const contextInfo = bookContext?.themes 
      ? `\n\nKnown themes in this book: ${bookContext.themes}` 
      : '';
    const previousInfo = bookContext?.previousFeedback
      ? `\n\nPrevious feedback items to check if addressed: ${bookContext.previousFeedback}`
      : '';

    const systemPrompt = `You are a professional story craft analyst and developmental editor. Assess this chapter for how well it advances the story.

Score each category from 1-5:
1 = Poor/Missing
2 = Needs significant work
3 = Adequate but could improve
4 = Good
5 = Excellent

Categories to assess:
1. **Plot Progression**: Does the chapter advance the main plot? Does something meaningful happen?
2. **Character Development**: Do characters grow, change, or reveal new facets?
3. **Theme Reinforcement**: Are the story's themes present and developed?
4. **Pacing**: Is the chapter well-paced? Does it drag or rush?
5. **Conflict/Tension**: Does it build, maintain, or resolve tension appropriately?
6. **Hook/Ending**: Does it pull the reader to continue? Strong chapter ending?

Also provide a checklist of specific, actionable improvements.${contextInfo}${previousInfo}

Respond in JSON format:
{
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
  ]
}`;

    const response = await this.chat(
      systemPrompt,
      `Analyze this chapter for story craft:\n\nChapter: ${chapterTitle}\n\n${text.substring(0, 8000)}`
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
      `Extract themes, motifs, and symbols from this chapter:\n\nChapter: ${chapterTitle}\n\n${text.substring(0, 8000)}`
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
}

export const openAIService = new OpenAIService();
