import { LLMProvider, LLMMessage, LLMResponse, LLMConfig } from './types';

export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic';
  id = 'anthropic';
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async sendMessage(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // Convert messages format for Anthropic API
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: this.config.maxTokens || 2000,
        system: systemMessage?.content,
        messages: conversationMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API error');
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  async sendPrompt(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const messages: LLMMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    return this.sendMessage(messages);
  }
}

