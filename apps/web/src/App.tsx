import { useState } from 'react';
import { useTwinStore, type LlmProviderId } from './store/twinStore.js';
import type { EditorMode } from './store/types.js';
import { FloorPlanEditor } from './components/editor/FloorPlanEditor.js';
import { EntityPanel } from './components/editor/EntityPanel.js';
import { TwinViewer } from './components/viewer/TwinViewer.js';
import { ChatPanel } from './components/chat/ChatPanel.js';
import { SettingsPanel } from './components/settings/SettingsPanel.js';

const MODES: EditorMode[] = ['view', 'draw', 'place'];

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mode = useTwinStore((state) => state.editorMode);
  const setEditorMode = useTwinStore((state) => state.setEditorMode);
  const status = useTwinStore((state) => state.connectionStatus);
  const providerId = useTwinStore((state) => state.llmConfig.provider);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Twin<strong>haus</strong>
        </div>
        <div className="mode-switch">
          {MODES.map((option) => (
            <button
              key={option}
              className={mode === option ? 'active' : ''}
              onClick={() => setEditorMode(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="topbar-right">
          <span className={`status status-${status}`}>HA: {status}</span>
          <span className="provider-tag">{providerLabel(providerId)}</span>
          <button onClick={() => setSettingsOpen((open) => !open)}>Settings</button>
        </div>
      </header>

      <main className="workspace">
        <section className="pane pane-editor">
          <h3 className="pane-title">Floor plan</h3>
          <FloorPlanEditor />
          <EntityPanel />
        </section>

        <section className="pane pane-viewer">
          <h3 className="pane-title">3D twin</h3>
          <TwinViewer />
        </section>

        <section className="pane pane-chat">
          <h3 className="pane-title">Chat control</h3>
          <ChatPanel />
        </section>
      </main>

      {settingsOpen && (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <SettingsPanel onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function providerLabel(provider: LlmProviderId): string {
  return { anthropic: 'Anthropic', openai: 'OpenAI', ollama: 'Ollama (local)' }[provider];
}
