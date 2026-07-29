import { useState } from 'react';

interface LeScan {
  stop: () => void;
}

interface WebBluetooth {
  requestLEScan?: (options: { acceptAllAdvertisements?: boolean }) => Promise<LeScan>;
  requestDevice?: (options: { acceptAllDevices?: boolean }) => Promise<{ name?: string }>;
  addEventListener: (type: string, listener: (event: { device: { id: string } }) => void) => void;
  removeEventListener: (
    type: string,
    listener: (event: { device: { id: string } }) => void,
  ) => void;
}

function webBluetooth(): WebBluetooth | null {
  if (typeof navigator === 'undefined') return null;
  const bt = (navigator as unknown as { bluetooth?: WebBluetooth }).bluetooth;
  return bt ?? null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * An optional, clearly-separated browser-side Bluetooth peek. This is informational only — it
 * counts nearby BLE advertisements to hint at what's around; it never adds devices and its
 * results are never mixed into the Home-Assistant-backed discovery list. Hidden entirely on
 * browsers without Web Bluetooth (Safari/iOS).
 */
export function BluetoothQuickScan() {
  const bt = webBluetooth();
  const [result, setResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  if (!bt) return null;

  async function scan() {
    if (!bt) return;
    setScanning(true);
    setResult(null);
    try {
      if (bt.requestLEScan) {
        const seen = new Set<string>();
        const onAdvertisement = (event: { device: { id: string } }) => seen.add(event.device.id);
        bt.addEventListener('advertisementreceived', onAdvertisement);
        const activeScan = await bt.requestLEScan({ acceptAllAdvertisements: true });
        await delay(4000);
        activeScan.stop();
        bt.removeEventListener('advertisementreceived', onAdvertisement);
        setResult(`${seen.size} BLE device${seen.size === 1 ? '' : 's'} nearby`);
      } else if (bt.requestDevice) {
        const device = await bt.requestDevice({ acceptAllDevices: true });
        setResult(`Saw ${device.name ?? 'a device'} nearby`);
      }
    } catch (err) {
      setResult(
        err instanceof Error && err.name === 'NotFoundError'
          ? 'No devices selected'
          : 'Scan unavailable',
      );
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="bt-scan">
      <button onClick={scan} disabled={scanning}>
        {scanning ? 'Scanning…' : 'Quick scan (beta)'}
      </button>
      {result && <span className="hint">{result}</span>}
      <p className="hint">
        Informational only — for real setup, Home Assistant discovers and configures Bluetooth
        devices. Extend range with ESPHome Bluetooth proxies.
      </p>
    </div>
  );
}
