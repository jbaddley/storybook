import { llmService } from '../llm/LLMService';

export interface GrammarSuggestion {
  type: 'grammar' | 'style' | 'spelling';
  severity: 'error' | 'warning' | 'suggestion';
  original: string;
  suggestion: string;
  explanation?: string;
  position?: { start: number; end: number };
}

const GRAMMAR_PROMPT = `Analyze the following text for grammar, spelling, and style issues. Return a JSON array of suggestions:
[
  {
    "type": "grammar|style|spelling",
    "severity": "error|warning|suggestion",
    "original": "The problematic text",
    "suggestion": "The corrected text",
    "explanation": "Why this change is suggested (optional)"
  }
]`;

export async function checkGrammar(content: string): Promise<GrammarSuggestion[]> {
  const prompt = `${GRAMMAR_PROMPT}\n\nText to check:\n${content}`;

  try {
    const response = await llmService.sendPrompt(
      prompt,
      'You are a helpful grammar and style checker. Always return valid JSON.'
    );

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]) as GrammarSuggestion[];
  } catch (error) {
    console.error('Error checking grammar:', error);
    return [];
  }
}

