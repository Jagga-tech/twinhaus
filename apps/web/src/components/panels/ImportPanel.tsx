import { useRef } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { HOME_TEMPLATES, templateToTwin } from '../../lib/templates.js';
import { captureToTwin, downloadTwin, parseTwin, type RoomCapture } from '../../lib/twinIo.js';
import { HomeScanPanel } from './HomeScanPanel.js';

/**
 * Every way to get geometry into the twin: built-in templates, an iPhone LiDAR / RoomPlan
 * capture, a `.glb`/`.gltf` model from Blender or SketchUp, a photo/blueprint to trace, or a
 * shared twin file. Also exports the current twin for backups and community sharing.
 */
export function ImportPanel() {
  const importTwin = useTwinStore((state) => state.importTwin);
  const exportTwin = useTwinStore((state) => state.exportTwin);
  const addImportedModel = useTwinStore((state) => state.addImportedModel);
  const importedModels = useTwinStore((state) => state.importedModels);
  const removeImportedModel = useTwinStore((state) => state.removeImportedModel);
  const setUnderlayUrl = useTwinStore((state) => state.setUnderlayUrl);
  const underlayUrl = useTwinStore((state) => state.underlayUrl);

  const captureInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const twinInput = useRef<HTMLInputElement>(null);

  async function onCapture(file: File) {
    try {
      const capture = JSON.parse(await file.text()) as RoomCapture;
      importTwin(captureToTwin(capture), 'replace');
    } catch (err) {
      window.alert(`Could not read capture: ${err instanceof Error ? err.message : err}`);
    }
  }

  function onModel(file: File) {
    const url = URL.createObjectURL(file);
    addImportedModel({ id: crypto.randomUUID(), name: file.name, url });
  }

  function onPhoto(file: File) {
    setUnderlayUrl(URL.createObjectURL(file));
  }

  async function onTwinFile(file: File) {
    try {
      importTwin(parseTwin(await file.text()), 'replace');
    } catch (err) {
      window.alert(`Could not read twin file: ${err instanceof Error ? err.message : err}`);
    }
  }

  return (
    <div className="panel-block">
      <HomeScanPanel />

      <h4>Start from a template</h4>
      <div className="template-grid">
        {HOME_TEMPLATES.map((template) => (
          <button key={template.id} onClick={() => importTwin(templateToTwin(template), 'replace')}>
            <strong>{template.name}</strong>
            <span className="hint">{template.description}</span>
          </button>
        ))}
      </div>

      <h4>Capture &amp; import</h4>
      <div className="import-actions">
        <button onClick={() => captureInput.current?.click()}>iPhone LiDAR capture (.json)</button>
        <button onClick={() => modelInput.current?.click()}>3D model (.glb/.gltf)</button>
        <button onClick={() => photoInput.current?.click()}>Photo / blueprint to trace</button>
        {underlayUrl && (
          <button className="link" onClick={() => setUnderlayUrl(null)}>
            Remove underlay
          </button>
        )}
      </div>
      <p className="hint">
        LiDAR capture expects a RoomPlan-style JSON: <code>{'{ rooms: [{ name, polygon }] }'}</code>{' '}
        with polygon points in meters.
      </p>

      {importedModels.length > 0 && (
        <ul className="model-list">
          {importedModels.map((model) => (
            <li key={model.id} className="panel-row">
              <span>{model.name}</span>
              <button className="link" onClick={() => removeImportedModel(model.id)}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4>Twin file</h4>
      <div className="import-actions">
        <button onClick={() => downloadTwin(exportTwin())}>Export twin</button>
        <button onClick={() => twinInput.current?.click()}>Import twin</button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={captureInput}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => event.target.files?.[0] && onCapture(event.target.files[0])}
      />
      <input
        ref={modelInput}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        hidden
        onChange={(event) => event.target.files?.[0] && onModel(event.target.files[0])}
      />
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => event.target.files?.[0] && onPhoto(event.target.files[0])}
      />
      <input
        ref={twinInput}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => event.target.files?.[0] && onTwinFile(event.target.files[0])}
      />
    </div>
  );
}
