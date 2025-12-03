import { llmService } from '../llm/LLMService';

export interface PlotHole {
  type: 'unresolved_thread' | 'motivation' | 'timeline' | 'explanation';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  location?: string;
  suggestion?: string;
}

const PLOT_ANALYSIS_PROMPT = `Analyze the following story for plot holes and logical issues. Look for:
1. Unresolved plot threads (storylines that are introduced but never resolved)
2. Character motivation inconsistencies (characters acting out of character)
3. Timeline gaps or contradictions
4. Missing explanations for important events

Return a JSON array of plot holes with this structure:
[
  {
    "type": "unresolved_thread|motivation|timeline|explanation",
    "severity": "critical|major|minor",
    "description": "Description of the plot hole",
    "location": "Where in the story (optional)",
    "suggestion": "How to fix (optional)"
  }
]`;

export async function analyzePlotHoles(content: string): Promise<PlotHole[]> {
  const prompt = `${PLOT_ANALYSIS_PROMPT}\n\nStory text:\n${content}`;

  try {
    const response = await llmService.sendPrompt(
      prompt,
      'You are a helpful assistant that analyzes stories for plot holes. Always return valid JSON.'
    );

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]) as PlotHole[];
  } catch (error) {
    console.error('Error analyzing plot holes:', error);
    return [];
  }
}

