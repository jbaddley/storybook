import { llmService } from '../llm/LLMService';
import { StoryElement } from '@shared/types';

export interface ExtractedElements {
  characters: StoryElement[];
  locations: StoryElement[];
  dates: StoryElement[];
  themes: StoryElement[];
}

const EXTRACTION_PROMPT = `Analyze the following story text and extract story elements. Return a JSON object with the following structure:
{
  "characters": [
    {"name": "Character Name", "description": "Brief description", "age": 25, "metadata": {}}
  ],
  "locations": [
    {"name": "Location Name", "description": "Brief description", "metadata": {}}
  ],
  "dates": [
    {"name": "Date/Event Name", "description": "When it occurred", "metadata": {"date": "2024-01-01"}}
  ],
  "themes": [
    {"name": "Theme Name", "description": "Description", "metadata": {}}
  ]
}

Only include elements that are explicitly mentioned in the text. Be thorough but accurate.`;

export async function extractStoryElements(content: string): Promise<ExtractedElements> {
  const prompt = `${EXTRACTION_PROMPT}\n\nStory text:\n${content}`;
  
  try {
    const response = await llmService.sendPrompt(
      prompt,
      'You are a helpful assistant that extracts story elements from text. Always return valid JSON.'
    );

    // Try to parse JSON from the response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const extracted = JSON.parse(jsonMatch[0]) as ExtractedElements;

    // Add IDs to elements
    const addIds = (elements: StoryElement[], type: StoryElement['type']): StoryElement[] => {
      return elements.map((el, idx) => ({
        ...el,
        id: `${type}-${Date.now()}-${idx}`,
        type,
      }));
    };

    return {
      characters: addIds(extracted.characters || [], 'character'),
      locations: addIds(extracted.locations || [], 'location'),
      dates: addIds(extracted.dates || [], 'date'),
      themes: addIds(extracted.themes || [], 'theme'),
    };
  } catch (error) {
    console.error('Error extracting story elements:', error);
    return {
      characters: [],
      locations: [],
      dates: [],
      themes: [],
    };
  }
}

