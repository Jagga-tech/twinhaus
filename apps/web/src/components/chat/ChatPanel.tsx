import { useMemo, useRef, useState } from 'react';
import type { Agent, AgentEvent } from '@twinhaus/agent';
import { useTwinStore } from '../../store/twinStore.js';
import { createAgent } from '../../lib/agentFactory.js';

interface TranscriptItem {
  role: 'user' | 'assistant' | 'tool';
  text: string;
}

/**
 * Talk to your home. Natural-language commands go to the agent, which calls Home Assistant
 * services; the results flow back into the twin visually. Tool activity is shown inline so
 * you can see what the agent actually did.
 */
export function ChatPanel() {
  const llmConfig = useTwinStore((state) => state.llmConfig);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);

  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // One agent per provider configuration; a new key rebuilds it with fresh settings.
  const agentKey = `${llmConfig.provider}:${llmConfig.model}:${llmConfig.baseUrl}`;
  const agentRef = useRef<{ key: string; agent: Agent } | null>(null);
  const agent = useMemo(() => {
    if (agentRef.current?.key !== agentKey) {
      agentRef.current = { key: agentKey, agent: createAgent(llmConfig) };
    }
    return agentRef.current.agent;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  async function handleSend() {
    const message = input.trim();
    if (!message || busy) return;

    if (llmConfig.provider !== 'ollama' && !llmConfig.apiKey) {
      appendItem({ role: 'tool', text: 'Add an API key in Settings first (or switch to Ollama).' });
      return;
    }

    setInput('');
    appendItem({ role: 'user', text: message });
    setBusy(true);

    try {
      const reply = await agent.send(message, onAgentEvent);
      if (reply) appendItem({ role: 'assistant', text: reply });
    } catch (err) {
      appendItem({ role: 'tool', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  function onAgentEvent(event: AgentEvent) {
    if (event.type === 'tool_call') {
      appendItem({ role: 'tool', text: `→ ${event.name}(${JSON.stringify(event.input)})` });
    } else if (event.type === 'tool_result') {
      const prefix = event.isError ? '✗' : '✓';
      appendItem({ role: 'tool', text: `${prefix} ${truncate(event.content)}` });
    }
  }

  function appendItem(item: TranscriptItem) {
    setTranscript((prev) => [...prev, item]);
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {transcript.length === 0 && (
          <p className="chat-empty">
            Try: <em>"turn on the living room light"</em> or <em>"what's on in the kitchen?"</em>
          </p>
        )}
        {transcript.map((item, index) => (
          <div key={index} className={`chat-item chat-${item.role}`}>
            {item.text}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={input}
          placeholder={
            connectionStatus === 'connected'
              ? 'Talk to your home…'
              : 'Connect Home Assistant to control devices…'
          }
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleSend()}
          disabled={busy}
        />
        <button onClick={handleSend} disabled={busy || !input.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function truncate(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
