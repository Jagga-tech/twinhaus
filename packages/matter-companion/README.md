# @twinhaus/matter-companion

Reference companion service for the Twinhaus **Matter** backend.

A browser cannot commission or drive Matter devices directly (that needs a native controller with
BLE, Thread, mDNS, and certificates). So Twinhaus ships the browser half of a small
JSON-over-WebSocket contract, and a local companion service runs the Matter fabric. This package is
that service, with a **simulated** fabric so the Matter backend works out of the box.

## Run it

```
npm run start --workspace @twinhaus/matter-companion
```

It listens on `ws://localhost:5580` (override with `PORT`). In Twinhaus, open Settings, choose the
**Matter (companion service)** backend, enter `ws://localhost:5580`, and connect. You will see a few
simulated Matter devices you can control.

## The contract

```
browser to service:   { "type": "subscribe" }
                      { "type": "command", "domain": "...", "service": "...",
                        "entity_id": "...", "data": { ... } }

service to browser:   { "type": "snapshot", "states": [ EntityState, ... ] }
                      { "type": "event", "state": EntityState }
```

`EntityState` is `{ entity_id, state, attributes, last_changed, last_updated }`, the same shape
every Twinhaus backend speaks.

## Driving real hardware

The simulated fabric lives in `src/core.ts` (`CompanionCore`). To control real Matter devices,
replace its in-memory state store with a bridge to a controller such as
[`python-matter-server`](https://github.com/home-assistant-libs/python-matter-server): map its node
and attribute model to `EntityState` on the way out, and map `command` messages to Matter cluster
commands on the way in. The wire messages in `src/server.ts` do not change.

The message handling in `core.ts` is covered by unit tests; the WebSocket wrapper in `server.ts` is
a thin transport around it.
