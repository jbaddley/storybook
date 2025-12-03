import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { llmService } from '../../services/llm/LLMService';
import { LLMConfig } from '../../services/llm/types';
import './Settings.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    editorMode,
    autoSaveInterval,
    llmProvider,
    llmConfigs,
    setEditorMode,
    setAutoSaveInterval,
    setLLMProvider,
    setLLMConfig,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'general' | 'llm'>('general');
  const [localConfigs, setLocalConfigs] = useState<Record<string, LLMConfig>>(llmConfigs);

  // Load API keys from a secure storage (for now, they need to be re-entered)
  // In production, you'd use electron-store or similar for secure storage
  React.useEffect(() => {
    if (isOpen) {
      setLocalConfigs(llmConfigs);
    }
  }, [isOpen, llmConfigs]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Update all LLM configs
    Object.entries(localConfigs).forEach(([provider, config]) => {
      setLLMConfig(provider, config);
      
      // Update provider instances
      if (provider === 'openai') {
        const providerInstance = llmService.createOpenAIProvider(config);
        llmService.registerProvider(providerInstance);
      } else if (provider === 'anthropic') {
        const providerInstance = llmService.createAnthropicProvider(config);
        llmService.registerProvider(providerInstance);
      } else if (provider === 'ollama') {
        const providerInstance = llmService.createOllamaProvider(config);
        llmService.registerProvider(providerInstance);
      }
    });

    if (llmProvider) {
      llmService.setCurrentProvider(llmProvider);
    }

    onClose();
  };

  const updateConfig = (provider: string, field: keyof LLMConfig, value: any) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settings-tabs">
          <button
            className={activeTab === 'general' ? 'active' : ''}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={activeTab === 'llm' ? 'active' : ''}
            onClick={() => setActiveTab('llm')}
          >
            LLM Providers
          </button>
        </div>
        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="setting-item">
                <label>Default Editor Mode</label>
                <select
                  value={editorMode}
                  onChange={(e) => setEditorMode(e.target.value as 'wysiwyg' | 'markdown')}
                >
                  <option value="wysiwyg">WYSIWYG</option>
                  <option value="markdown">Markdown</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Auto-save Interval (ms)</label>
                <input
                  type="number"
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          {activeTab === 'llm' && (
            <div className="settings-section">
              <div className="setting-item">
                <label>Active Provider</label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLLMProvider(e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="ollama">Ollama</option>
                </select>
              </div>
              <div className="provider-configs">
                <div className="provider-config">
                  <h3>OpenAI</h3>
                  <div className="setting-item">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={localConfigs.openai?.apiKey || ''}
                      onChange={(e) => updateConfig('openai', 'apiKey', e.target.value)}
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="setting-item">
                    <label>Model</label>
                    <select
                      value={localConfigs.openai?.model || 'gpt-3.5-turbo'}
                      onChange={(e) => updateConfig('openai', 'model', e.target.value)}
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </select>
                  </div>
                </div>
                <div className="provider-config">
                  <h3>Anthropic</h3>
                  <div className="setting-item">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={localConfigs.anthropic?.apiKey || ''}
                      onChange={(e) => updateConfig('anthropic', 'apiKey', e.target.value)}
                      placeholder="sk-ant-..."
                    />
                  </div>
                  <div className="setting-item">
                    <label>Model</label>
                    <select
                      value={localConfigs.anthropic?.model || 'claude-3-haiku-20240307'}
                      onChange={(e) => updateConfig('anthropic', 'model', e.target.value)}
                    >
                      <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                      <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                      <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                    </select>
                  </div>
                </div>
                <div className="provider-config">
                  <h3>Ollama</h3>
                  <div className="setting-item">
                    <label>Base URL</label>
                    <input
                      type="text"
                      value={localConfigs.ollama?.baseURL || 'http://localhost:11434'}
                      onChange={(e) => updateConfig('ollama', 'baseURL', e.target.value)}
                    />
                  </div>
                  <div className="setting-item">
                    <label>Model</label>
                    <input
                      type="text"
                      value={localConfigs.ollama?.model || 'llama2'}
                      onChange={(e) => updateConfig('ollama', 'model', e.target.value)}
                      placeholder="llama2, mistral, etc."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="settings-footer">
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

