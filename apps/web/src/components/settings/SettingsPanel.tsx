import { useTwinStore, type LlmProviderId } from '../../store/twinStore.js';
import { useHaConnection } from '../../hooks/useHaConnection.js';
import { listProviders } from '../../lib/provider/index.js';

const MODEL_PLACEHOLDER: Record<LlmProviderId, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o',
  ollama: 'llama3.1',
};

/** Connect Home Assistant and pick an LLM provider, cloud APIs or fully local via Ollama. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const haConfig = useTwinStore((state) => state.haConfig);
  const setHaConfig = useTwinStore((state) => state.setHaConfig);
  const llmConfig = useTwinStore((state) => state.llmConfig);
  const setLlmConfig = useTwinStore((state) => state.setLlmConfig);
  const status = useTwinStore((state) => state.connectionStatus);
  const providerId = useTwinStore((state) => state.providerId);

  const { connect, disconnect, switchProvider, connecting, error } = useHaConnection();
  const providers = listProviders();
  const active = providers.find((provider) => provider.id === providerId) ?? providers[0];

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>

      <section>
        <h3>Device backend</h3>
        <p className="hint">
          Where your devices come from. Home Assistant gives the widest coverage; Demo runs a
          simulated home with no hub or hardware at all.
        </p>
        <label>
          Backend
          <select value={active.id} onChange={(event) => switchProvider(event.target.value)}>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{active.summary}</p>

        {active.id === 'homeassistant' ? (
          <>
            <label>
              URL
              <input
                value={haConfig.url}
                placeholder="http://homeassistant.local:8123"
                onChange={(event) => setHaConfig({ ...haConfig, url: event.target.value })}
              />
            </label>
            <label>
              Long-lived access token
              <input
                type="password"
                value={haConfig.token}
                placeholder="Profile → Long-Lived Access Tokens"
                onChange={(event) => setHaConfig({ ...haConfig, token: event.target.value })}
              />
            </label>
          </>
        ) : null}

        <div className="settings-actions">
          {status === 'connected' ? (
            <button onClick={disconnect}>Disconnect</button>
          ) : (
            <button className="primary" onClick={connect} disabled={connecting}>
              {connecting ? 'Connecting…' : active.standalone ? 'Start demo' : 'Connect'}
            </button>
          )}
          <span className={`status status-${status}`}>{status}</span>
        </div>
        {error && <p className="settings-error">{error}</p>}
      </section>

      <section>
        <h3>AI provider</h3>
        <p className="hint">
          Bring your own LLM. Anthropic or OpenAI for cloud, or Ollama for fully local inference, no
          data leaves your machine.
        </p>
        <label>
          Provider
          <select
            value={llmConfig.provider}
            onChange={(event) => {
              const provider = event.target.value as LlmProviderId;
              setLlmConfig({ provider, model: MODEL_PLACEHOLDER[provider] });
            }}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </label>
        <label>
          Model
          <input
            value={llmConfig.model}
            placeholder={MODEL_PLACEHOLDER[llmConfig.provider]}
            onChange={(event) => setLlmConfig({ model: event.target.value })}
          />
        </label>
        {llmConfig.provider !== 'ollama' && (
          <label>
            API key
            <input
              type="password"
              value={llmConfig.apiKey}
              onChange={(event) => setLlmConfig({ apiKey: event.target.value })}
            />
          </label>
        )}
        {llmConfig.provider !== 'anthropic' && (
          <label>
            {llmConfig.provider === 'ollama' ? 'Ollama URL' : 'Base URL (optional)'}
            <input
              value={llmConfig.baseUrl}
              placeholder={
                llmConfig.provider === 'ollama'
                  ? 'http://localhost:11434'
                  : 'https://api.openai.com/v1'
              }
              onChange={(event) => setLlmConfig({ baseUrl: event.target.value })}
            />
          </label>
        )}
      </section>
    </div>
  );
}
