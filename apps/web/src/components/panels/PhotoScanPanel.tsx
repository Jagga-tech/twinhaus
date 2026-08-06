import { useRef, useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { photoScanToTwin, type PhotoScanResult } from '../../lib/photoScan.js';
import { scanPhoto } from '../../lib/visionScan.js';

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'preview'; result: PhotoScanResult; previewUrl: string }
  | { status: 'error'; message: string };

/**
 * Build the twin straight from a phone photo. Snap a picture of a room, the vision model reads the
 * layout and any smart devices it can see, and one tap turns that into rooms and placed devices you
 * can refine. Scan room by room to grow the whole home.
 */
const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'GPT',
  ollama: 'your local model',
  custom: 'your model',
};

export function PhotoScanPanel() {
  const provider = useTwinStore((state) => state.llmConfig.provider);
  const apiKey = useTwinStore((state) => state.llmConfig.apiKey);
  const model = useTwinStore((state) => state.llmConfig.model);
  const baseUrl = useTwinStore((state) => state.llmConfig.baseUrl);
  const rooms = useTwinStore((state) => state.rooms);
  const importTwin = useTwinStore((state) => state.importTwin);
  const setActiveLeftTab = useTwinStore((state) => state.setActiveLeftTab);
  const visionName = PROVIDER_LABEL[provider] ?? 'your AI';

  const [scan, setScan] = useState<ScanState>({ status: 'idle' });
  const [roomNames, setRoomNames] = useState<Record<number, string>>({});
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const photoInput = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File) {
    setRoomNames({});
    setDropped(new Set());
    setScan({ status: 'scanning' });
    try {
      const result = await scanPhoto({ provider, apiKey, model, baseUrl, file });
      setScan({ status: 'preview', result, previewUrl: URL.createObjectURL(file) });
    } catch (err) {
      setScan({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function apply(result: PhotoScanResult) {
    const edited: PhotoScanResult = {
      rooms: result.rooms.map((room, index) => ({ ...room, name: roomNames[index] ?? room.name })),
      devices: result.devices.filter((_, index) => !dropped.has(index)),
      note: result.note,
    };
    // Merge with a per-scan seed so repeated scans build the home without id clashes.
    importTwin(photoScanToTwin(edited, String(rooms.length)), 'merge');
    setScan({ status: 'idle' });
    setActiveLeftTab('plan');
  }

  return (
    <div className="panel-block">
      <h4>Build from a photo</h4>
      <p className="hint">
        Take or upload a photo of a room. {visionName} reads the layout and any smart devices in it,
        then turns them into a room you can refine. Scan each room to build the whole home. It uses
        whichever AI you run the chat on, set in Settings.
      </p>

      {scan.status !== 'preview' && (
        <button
          className="primary"
          onClick={() => photoInput.current?.click()}
          disabled={scan.status === 'scanning'}
        >
          {scan.status === 'scanning' ? 'Reading photo...' : 'Choose or take a photo'}
        </button>
      )}

      {scan.status === 'error' && <p className="settings-error">{scan.message}</p>}

      {scan.status === 'preview' && (
        <div className="scan-preview">
          <img className="photo-scan-thumb" src={scan.previewUrl} alt="Scanned room" />
          <p>
            Found <strong>{scan.result.rooms.length}</strong> room
            {scan.result.rooms.length === 1 ? '' : 's'} and{' '}
            <strong>{scan.result.devices.length}</strong> device
            {scan.result.devices.length === 1 ? '' : 's'}. Review and tweak below.
          </p>
          {scan.result.note && <p className="hint">{scan.result.note}</p>}

          <h5 className="scan-subhead">Rooms</h5>
          <div className="scan-rooms">
            {scan.result.rooms.map((room, index) => (
              <label key={index} className="photo-scan-room">
                <input
                  className="scan-room-name"
                  value={roomNames[index] ?? room.name}
                  onChange={(event) =>
                    setRoomNames((prev) => ({ ...prev, [index]: event.target.value }))
                  }
                />
                <span className="hint">
                  {Math.round(room.widthM)} x {Math.round(room.depthM)} m
                </span>
              </label>
            ))}
          </div>

          {scan.result.devices.length > 0 && (
            <>
              <h5 className="scan-subhead">Devices spotted</h5>
              <ul className="scan-devices">
                {scan.result.devices.map((device, index) => {
                  const isDropped = dropped.has(index);
                  return (
                    <li key={index} className={isDropped ? 'scan-device excluded' : 'scan-device'}>
                      <span className="scan-device-id">
                        {device.label}
                        <span className="brain-risk brain-auto">{device.category}</span>
                      </span>
                      <button
                        className="link"
                        onClick={() =>
                          setDropped((prev) => {
                            const next = new Set(prev);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          })
                        }
                      >
                        {isDropped ? 'keep' : 'drop'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="import-actions">
            <button className="primary" onClick={() => apply(scan.result)}>
              Add to twin
            </button>
            <button className="link" onClick={() => setScan({ status: 'idle' })}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => event.target.files?.[0] && onPhoto(event.target.files[0])}
      />
    </div>
  );
}
