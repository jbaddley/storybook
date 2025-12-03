import { LLMProvider, LLMMessage, LLMResponse, LLMConfig } from './types';

export class OllamaProvider implements LLMProvider {
  name = 'Ollama';
  id = 'ollama';
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async sendMessage(messages: LLMMessage[]): Promise<LLMResponse> {
    const baseURL = this.config.baseURL || 'http://localhost:11434';
    const model = this.config.model || 'llama2';

    // Convert messages to prompt format for Ollama
    const prompt = messages
      .map(m => {
        if (m.role === 'system') {
          return `System: ${m.content}`;
        } else if (m.role === 'user') {
          return `User: ${m.content}`;
        } else {
          return `Assistant: ${m.content}`;
        }
      })
      .join('\n\n') + '\n\nAssistant:';

    const response = await fetch(`${baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature || 0.7,
          num_predict: this.config.maxTokens || 2000,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Ollama API error');
    }

    const data = await response.json();
    return {
      content: data.response || '',
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

