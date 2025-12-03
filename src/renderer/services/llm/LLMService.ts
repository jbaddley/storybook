import { LLMProvider, LLMConfig, LLMMessage, LLMResponse } from './types';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OllamaProvider } from './OllamaProvider';

class LLMService {
  private providers: Map<string, LLMProvider> = new Map();
  private currentProvider: LLMProvider | null = null;

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  setCurrentProvider(id: string): void {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }
    this.currentProvider = provider;
  }

  getCurrentProvider(): LLMProvider | null {
    return this.currentProvider;
  }

  async sendMessage(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.currentProvider) {
      throw new Error('No LLM provider selected');
    }
    return this.currentProvider.sendMessage(messages);
  }

  async sendPrompt(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    if (!this.currentProvider) {
      throw new Error('No LLM provider selected');
    }
    return this.currentProvider.sendPrompt(prompt, systemPrompt);
  }

  createOpenAIProvider(config: LLMConfig): OpenAIProvider {
    return new OpenAIProvider(config);
  }

  createAnthropicProvider(config: LLMConfig): AnthropicProvider {
    return new AnthropicProvider(config);
  }

  createOllamaProvider(config: LLMConfig): OllamaProvider {
    return new OllamaProvider(config);
  }
}

export const llmService = new LLMService();

