# Device backends

Twinhaus is a browser-based digital twin. It never speaks a device protocol itself, it talks to a
**device backend** through one small interface, `DeviceProvider`. Home Assistant is one backend; it
is no longer the only one. This is how Twinhaus stays useful with or without HA.

The twin, agent, energy, and positioning layers never learn which backend they are on. They all
talk to one `DeviceProvider` interface (connect, status, state stream, getStates, callService), and
each backend implements it:

- Home Assistant: widest device coverage.
- Demo: no hub or hardware.
- MQTT: zigbee2mqtt over WebSocket.
- Matter: via a local companion service.

The interface lives in `apps/web/src/lib/provider/types.ts`. A backend implements connect/disconnect,
a status + state-change subscription, `getStates()`, and `callService()`. An optional `registry`
capability (area/floor/device lists) powers the auto home-scan; backends without it simply omit it and
the scan UI steps aside.

Pick the backend in **Settings to Device backend**. The choice is persisted, and the topbar pill shows
which one is live (HA / Demo / MQTT / Matter).

## Home Assistant , `homeassistant`

The default. Adapts the existing `HaClient` (auth, state subscription, auto-reconnect, service calls)
to `DeviceProvider`, and exposes the area/floor registry for home-scan. HA gives the widest device
coverage because you inherit its entire integration ecosystem. Needs a URL + long-lived token.

## Demo , `demo`

A fully self-contained backend: no hub, no hardware. It seeds ten live devices, answers control by
mutating in-memory state (emitting the same `state_changed` events a real backend would), and gently
animates itself. Selecting it also loads a furnished four-room twin when your twin is empty, so a
first-run visitor can explore, control devices, and watch the twin react before connecting anything.

## MQTT (zigbee2mqtt) , `mqtt`

An HA-free live backend that speaks MQTT straight to a [zigbee2mqtt](https://www.zigbee2mqtt.io/)
bridge over WebSocket, so you control a real Zigbee network with just a broker.

- The device roster comes from the retained `zigbee2mqtt/bridge/devices` topic.
- State arrives on `zigbee2mqtt/<friendly_name>`; commands go to `zigbee2mqtt/<friendly_name>/set`.
- The translation (`z2m.ts`) is pure and unit-tested; the mqtt.js transport is lazy-loaded so its
  ~150 kB only ship when MQTT is selected.

Requirements: an MQTT broker with a WebSocket listener (e.g. Mosquitto on `ws://host:9001`) and the
zigbee2mqtt bridge publishing to it. Enter the broker's WebSocket URL in Settings. The mapping and
provider are tested against a fake transport; a live broker is needed to exercise it end to end.

## Matter , `matter`

A browser **cannot** commission or drive Matter devices directly: that needs a native controller
(BLE/Thread/mDNS, certificates, PASE/CASE). So the Matter backend talks to a small **local companion
service** that runs the Matter fabric and bridges it to this JSON-over-WebSocket contract:

```
browser to service:   { "type": "subscribe" }
                     { "type": "command", "domain": "...", "service": "...",
                       "entity_id": "...", "data": { ... } }

service to browser:   { "type": "snapshot", "states": [ EntityState, ... ] }
                     { "type": "event", "state": EntityState }
```

`EntityState` is the same `{ entity_id, state, attributes, last_changed, last_updated }` every backend
speaks. Twinhaus ships the **browser half** (`matterProvider.ts` + `companionSocket.ts`); the service
half is the deployment's responsibility, a thin adapter in front of, for example,
[`python-matter-server`](https://github.com/home-assistant-libs/python-matter-server) that maps Matter
clusters to `EntityState` and back. Point Settings at the service URL (e.g. `ws://localhost:5580`).

Until such a service is running, selecting Matter connects to nothing and says so, it never pretends
to control hardware it can't reach.

## Adding a backend

1. Implement `DeviceProvider` (see `demoProvider.ts` for the simplest full example).
2. `registerProvider(new YourProvider(...))` in `apps/web/src/lib/provider/index.ts`.
3. Add any config fields to the Settings backend section, and a short prefix in `backendTag`.

Keep protocol translation in a pure, tested module (like `z2m.ts`) and inject the transport, so the
mapping is verifiable without live hardware.

## The trade-off

Home Assistant gives thousands of integrations for free. Every backend that leaves HA behind takes on
device support itself, so Twinhaus is **HA-optional, not HA-hostile**: HA for the widest coverage,
Demo for zero-setup exploration, MQTT and Matter for real control without HA when you want it.
