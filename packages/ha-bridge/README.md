# @twinhaus/ha-bridge

Home Assistant WebSocket client: auth handshake, entity state sync, `state_changed` event subscription, and service calls. Twinhaus never talks to hardware directly, this is the only path to devices, and Home Assistant owns every integration behind it.

## Usage

```ts
import { HaClient } from '@twinhaus/ha-bridge';

const client = new HaClient();
client.onStateChanged((event) => console.log(event.entity_id, event.new_state?.state));

await client.connect({ url: 'http://homeassistant.local:8123', token: '<long-lived-token>' });
const states = await client.getStates();

await client.callService({
  domain: 'light',
  service: 'turn_on',
  target: { entity_id: 'light.living_room' },
  serviceData: { brightness_pct: 40 },
});
```

- `connect(config)`, resolves once authenticated; auto-subscribes to `state_changed`.
- `getStates()`, snapshot of every entity.
- `callService(options)`, call any Home Assistant service.
- `onStateChanged` / `onStatusChange`, live updates and connection status.
