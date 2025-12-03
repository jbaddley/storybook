import { llmService } from '../llm/LLMService';
import { StoryElement } from '@shared/types';

export interface ConsistencyIssue {
  type: 'character' | 'timeline' | 'location' | 'theme';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
  suggestion?: string;
}

const CONSISTENCY_PROMPT = `Analyze the following story text for consistency issues. Check for:
1. Character name/age inconsistencies
2. Timeline conflicts (dates that don't make sense)
3. Location name variations (same place with different names)
4. Theme inconsistencies

Return a JSON array of issues with this structure:
[
  {
    "type": "character|timeline|location|theme",
    "severity": "error|warning|info",
    "message": "Description of the issue",
    "location": "Where in the story (optional)",
    "suggestion": "How to fix (optional)"
  }
]`;

export async function checkConsistency(
  content: string,
  storyElements: {
    characters: StoryElement[];
    locations: StoryElement[];
    dates: StoryElement[];
    themes: StoryElement[];
  }
): Promise<ConsistencyIssue[]> {
  const elementsSummary = JSON.stringify(storyElements, null, 2);
  const prompt = `${CONSISTENCY_PROMPT}\n\nKnown story elements:\n${elementsSummary}\n\nStory text:\n${content}`;

  try {
    const response = await llmService.sendPrompt(
      prompt,
      'You are a helpful assistant that checks story consistency. Always return valid JSON.'
    );

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]) as ConsistencyIssue[];
  } catch (error) {
    console.error('Error checking consistency:', error);
    return [];
  }
}

