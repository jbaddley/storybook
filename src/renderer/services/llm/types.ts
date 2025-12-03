export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMProvider {
  name: string;
  id: string;
  sendMessage(messages: LLMMessage[]): Promise<LLMResponse>;
  sendPrompt(prompt: string, systemPrompt?: string): Promise<LLMResponse>;
}

export interface LLMConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

