import { useMemo, useRef, useState } from 'react';
import type { Agent, AgentEvent, ControlAction, SafetyVerdict } from '@twinhaus/agent';
import { useTwinStore } from '../../store/twinStore.js';
import { createAgent } from '../../lib/agentFactory.js';

interface TranscriptItem {
  role: 'user' | 'assistant' | 'tool';
  text: string;
}

interface PendingConfirmation {
  action: ControlAction;
  verdict: SafetyVerdict;
  resolve: (approved: boolean) => void;
}

/**
 * Talk to your home. Natural-language commands go to the agent, which calls Home Assistant
 * services; the results flow back into the twin visually. Guarded actions (unlocking, disarming,
 * opening, whole-home) pause here for an explicit Approve/Deny so the agent can never do something
 * serious on its own.
 */
export function ChatPanel() {
  const llmConfig = useTwinStore((state) => state.llmConfig);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);

  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);

  /** Read a reply aloud with the browser speech synthesiser, when the user has turned it on. */
  function speakReply(text: string) {
    if (!speak || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /** Dictate a message with the browser's speech recognition; the text lands in the input box. */
  function startVoice() {
    const Ctor =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new (
      Ctor as new () => {
        lang: string;
        interimResults: boolean;
        onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        onerror: () => void;
        start: () => void;
      }
    )();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript ?? '';
      if (said) setInput(said);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  // One agent per provider configuration. The API key is part of the identity, entering or changing
  // it must rebuild the agent, otherwise an agent created before the key was saved keeps sending an
  // empty x-api-key and the API 401s. A short fingerprint keeps the secret out of the render key.
  const keyFingerprint = `${llmConfig.apiKey.length}:${llmConfig.apiKey.slice(-4)}`;
  const agentKey = `${llmConfig.provider}:${llmConfig.model}:${llmConfig.baseUrl}:${keyFingerprint}`;
  const agentRef = useRef<{ key: string; agent: Agent } | null>(null);
  const agent = useMemo(() => {
    if (agentRef.current?.key !== agentKey) {
      agentRef.current = { key: agentKey, agent: createAgent(llmConfig, confirmAction) };
    }
    return agentRef.current.agent;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey]);

  /** Gate a guarded action behind an inline Approve/Deny, resolving when the user chooses. */
  function confirmAction(action: ControlAction, verdict: SafetyVerdict): Promise<boolean> {
    return new Promise((resolve) => {
      setPending({
        action,
        verdict,
        resolve: (approved) => {
          setPending(null);
          resolve(approved);
        },
      });
    });
  }

  async function handleSend() {
    const message = input.trim();
    if (!message || busy) return;

    if (llmConfig.provider !== 'ollama' && !llmConfig.apiKey) {
      appendItem({ role: 'tool', text: 'Add an API key in Settings first (or switch to Ollama).' });
      return;
    }

    setInput('');
    appendItem({ role: 'user', text: message });
    useTwinStore.getState().markAgentUsed();
    setBusy(true);

    try {
      const reply = await agent.send(message, onAgentEvent);
      if (reply) {
        appendItem({ role: 'assistant', text: reply });
        speakReply(reply);
      }
    } catch (err) {
      appendItem({ role: 'tool', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  function onAgentEvent(event: AgentEvent) {
    if (event.type === 'tool_call') {
      appendItem({ role: 'tool', text: `${event.name}(${JSON.stringify(event.input)})` });
    } else if (event.type === 'tool_result') {
      const prefix = event.isError ? 'error:' : 'ok:';
      appendItem({ role: 'tool', text: `${prefix} ${truncate(event.content)}` });
    } else if (event.type === 'action_blocked') {
      appendItem({ role: 'tool', text: `Declined (${event.reason}), not executed.` });
    } else if (event.type === 'loop_halted') {
      appendItem({ role: 'tool', text: `Stopped for safety: ${event.reason}.` });
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
            Hi, I&apos;m Homie. Ask me to <em>"turn on the living room light"</em>, or say{' '}
            <em>"is everything okay before bed?"</em>
          </p>
        )}
        {transcript.map((item, index) => (
          <div key={index} className={`chat-item chat-${item.role}`}>
            {item.text}
          </div>
        ))}

        {pending && (
          <div className="confirm-card">
            <div className="confirm-head">Confirm {pending.verdict.risk} action</div>
            <p className="confirm-body">
              The agent wants to run{' '}
              <code>
                {pending.action.domain}.{pending.action.service}
              </code>
              {pending.action.entityId ? (
                <>
                  {' '}
                  on <code>{pending.action.entityId}</code>
                </>
              ) : null}{' '}
              , this {pending.verdict.reason}.
            </p>
            <div className="confirm-actions">
              <button className="primary" onClick={() => pending.resolve(true)}>
                Approve
              </button>
              <button className="link" onClick={() => pending.resolve(false)}>
                Deny
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="chat-input">
        <input
          value={input}
          placeholder={
            connectionStatus === 'connected'
              ? 'Talk to your home...'
              : 'Connect Home Assistant to control devices...'
          }
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleSend()}
          disabled={busy}
        />
        {voiceSupported() && (
          <button
            className={listening ? 'active' : ''}
            title="Dictate a message"
            disabled={busy}
            onClick={startVoice}
          >
            {listening ? 'Listening' : 'Voice'}
          </button>
        )}
        {ttsSupported() && (
          <button
            className={speak ? 'active' : ''}
            title="Read replies aloud"
            onClick={() => setSpeak((on) => !on)}
          >
            {speak ? 'Speaking' : 'Speak'}
          </button>
        )}
        <button onClick={handleSend} disabled={busy || !input.trim()}>
          {busy ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

/** Whether this browser exposes the Web Speech API (Chrome, Edge, Safari). */
function voiceSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

/** Whether this browser can speak text aloud. */
function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function truncate(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
