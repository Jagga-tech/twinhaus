import { useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { activeProvider } from '../../lib/provider/index.js';
import { sceneFromStates, sceneToCalls } from '../../lib/scenes.js';

/**
 * Scenes: save how the home is set right now as a named mood, then re-apply it in one tap. The
 * "learned scenes" building block, capture "movie night" once and replay it whenever.
 */
export function ScenesPanel() {
  const scenes = useTwinStore((state) => state.scenes);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const addScene = useTwinStore((state) => state.addScene);
  const removeScene = useTwinStore((state) => state.removeScene);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);

  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const scene = sceneFromStates(trimmed, devices, entityStates);
    if (scene.entries.length === 0) {
      window.alert('No controllable devices with live state to capture yet.');
      return;
    }
    addScene(scene);
    setName('');
  }

  async function apply(id: string) {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;
    setBusy(id);
    try {
      for (const call of sceneToCalls(scene)) await activeProvider().callService(call);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel-block">
      <h4 className="section-heading">Scenes</h4>
      <div className="sim-form">
        <input
          placeholder="Name this setup, e.g. Movie night"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && save()}
        />
        <button onClick={save}>Save</button>
      </div>
      {scenes.length === 0 ? (
        <p className="hint">Set your lights and devices how you like, then save it as a scene.</p>
      ) : (
        <ul className="scene-list">
          {scenes.map((scene) => (
            <li key={scene.id} className="panel-row">
              <span>
                {scene.name} <span className="hint">({scene.entries.length})</span>
              </span>
              <span className="catalog-actions">
                <button
                  className="link"
                  disabled={connectionStatus !== 'connected' || busy === scene.id}
                  onClick={() => apply(scene.id)}
                >
                  {busy === scene.id ? 'Applying...' : 'Apply'}
                </button>
                <button className="link" onClick={() => removeScene(scene.id)}>
                  remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
