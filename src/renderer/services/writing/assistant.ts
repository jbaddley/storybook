import { llmService } from '../llm/LLMService';

export interface WritingSuggestion {
  type: 'character' | 'pacing' | 'dialogue' | 'transition' | 'general';
  suggestion: string;
  context?: string;
  example?: string;
}

const WRITING_ASSISTANCE_PROMPT = `Analyze the following story excerpt and provide writing suggestions for:
1. Character development
2. Pacing improvements
3. Dialogue enhancement
4. Scene transitions

Return a JSON array of suggestions:
[
  {
    "type": "character|pacing|dialogue|transition|general",
    "suggestion": "Your suggestion",
    "context": "The relevant part of the text (optional)",
    "example": "An example of how to improve (optional)"
  }
]`;

export async function getWritingSuggestions(content: string): Promise<WritingSuggestion[]> {
  const prompt = `${WRITING_ASSISTANCE_PROMPT}\n\nStory excerpt:\n${content}`;

  try {
    const response = await llmService.sendPrompt(
      prompt,
      'You are a helpful writing assistant that provides constructive feedback on stories. Always return valid JSON.'
    );

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]) as WritingSuggestion[];
  } catch (error) {
    console.error('Error getting writing suggestions:', error);
    return [];
  }
}

