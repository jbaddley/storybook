import { llmService } from '../services/llm/LLMService';
import { useSettingsStore } from '../stores/settingsStore';

export function initializeLLMProviders() {
  const { llmConfigs, llmProvider } = useSettingsStore.getState();

  // Initialize and register all providers
  if (llmConfigs.openai) {
    const openaiProvider = llmService.createOpenAIProvider(llmConfigs.openai);
    llmService.registerProvider(openaiProvider);
  }

  if (llmConfigs.anthropic) {
    const anthropicProvider = llmService.createAnthropicProvider(llmConfigs.anthropic);
    llmService.registerProvider(anthropicProvider);
  }

  if (llmConfigs.ollama) {
    const ollamaProvider = llmService.createOllamaProvider(llmConfigs.ollama);
    llmService.registerProvider(ollamaProvider);
  }

  // Set the current provider
  if (llmProvider) {
    try {
      llmService.setCurrentProvider(llmProvider);
    } catch (error) {
      console.warn('Failed to set LLM provider:', error);
    }
  }
}

