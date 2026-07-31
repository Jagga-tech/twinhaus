import { useState } from 'react';
import { useTwinStore, type LlmProviderId } from './store/twinStore.js';
import type { EditorMode } from './store/types.js';
import { LeftPanel } from './components/LeftPanel.js';
import { TwinViewer } from './components/viewer/TwinViewer.js';
import { ChatPanel } from './components/chat/ChatPanel.js';
import { SettingsPanel } from './components/settings/SettingsPanel.js';
import { ViewModeSwitch } from './components/panels/ViewModeSwitch.js';
import { LevelSwitcher } from './components/LevelSwitcher.js';
import { DeviceInspector } from './components/panels/DeviceInspector.js';
import { RecommendationWizard } from './components/panels/RecommendationWizard.js';
import { PlacementPrompt } from './components/discovery/PlacementPrompt.js';
import { WelcomeFlow } from './components/WelcomeFlow.js';
import { useDiscovery } from './hooks/useDiscovery.js';
import { useLivePositioning } from './hooks/useLivePositioning.js';

const MODES: EditorMode[] = ['view', 'draw', 'place'];

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  useDiscovery();
  useLivePositioning();
  const mode = useTwinStore((state) => state.editorMode);
  const setEditorMode = useTwinStore((state) => state.setEditorMode);
  const status = useTwinStore((state) => state.connectionStatus);
  const providerId = useTwinStore((state) => state.llmConfig.provider);
  const backendId = useTwinStore((state) => state.providerId);

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
          <span className={`status status-${status}`}>
            {backendTag(backendId)}: {status}
          </span>
          <span className="provider-tag">{providerLabel(providerId)}</span>
          <button onClick={() => setSettingsOpen((open) => !open)}>Settings</button>
        </div>
      </header>

      <main className="workspace">
        <LeftPanel onOpenWizard={() => setWizardOpen(true)} />

        <section className="pane pane-viewer">
          <div className="viewer-header">
            <h3 className="pane-title">3D twin</h3>
            <ViewModeSwitch />
          </div>
          <LevelSwitcher />
          <TwinViewer />
          <PlacementPrompt />
          <DeviceInspector />
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

      {wizardOpen && <RecommendationWizard onClose={() => setWizardOpen(false)} />}

      <WelcomeFlow onOpenSettings={() => setSettingsOpen(true)} />
    </div>
  );
}

function providerLabel(provider: LlmProviderId): string {
  return { anthropic: 'Anthropic', openai: 'OpenAI', ollama: 'Ollama (local)' }[provider];
}

/** Short prefix for the connection pill, so it reflects the active device backend, not just HA. */
function backendTag(backendId: string): string {
  return (
    { homeassistant: 'HA', demo: 'Demo', mqtt: 'MQTT', matter: 'Matter' }[backendId] ?? 'Backend'
  );
}
