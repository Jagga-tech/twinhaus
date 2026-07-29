# Failure recovery — the connection heals itself

Home Assistant restarts. Wi-Fi blips. Laptops sleep. When the live WebSocket drops, the twin used
to freeze on stale data until someone reopened Settings and clicked Connect. Now the connection
recovers on its own — the failure the system couldn't previously solve.

## What happens on a drop

```
socket drops (HA restart / network blip)
      │
      ▼
status → "reconnecting"        the badge pulses; the app knows it's degraded, not dead
      │  exponential backoff (1s, 2s, 4s … capped at 30s, + jitter)
      ▼
reopen socket → re-auth
      │
      ├─ re-subscribe to state_changed          live updates resume
      ├─ re-establish every active subscription  discovery flows keep streaming
      └─ onReconnected → reload full snapshot     stale mirror is healed (missed events don't matter)
      │
      ▼
status → "connected"
```

Key properties:

- **Only after a real connection.** Auto-reconnect kicks in only once the client has authenticated
  at least once. A bad URL or token still fails the initial connect immediately, so the user sees
  the real error instead of a silent retry loop.
- **User intent wins.** Calling `disconnect()` stops reconnection for good; a drop after that stays
  disconnected. `auth_invalid` on a retry (token revoked) also stops the loop rather than hammering.
- **Backoff with jitter.** Delays double each attempt up to a 30s ceiling, plus a random jitter
  fraction so a fleet of clients reconnecting after the same outage don't stampede in lockstep.
- **Bounded.** An optional `maxAttempts` gives up and reports `disconnected` instead of retrying
  forever; the default is unbounded (keep trying until told to stop).
- **Snapshot resync.** Events missed while offline would leave the mirror wrong, so on reconnect the
  app reloads a full `get_states()` snapshot rather than trusting the gap.
- **Commands survive the gap.** A command issued mid-reconnect (a light toggle, a service call) is
  held in a queue and flushed the moment the socket is back, instead of failing outright. Each
  queued command has a timeout (`commandTimeoutMs`, default 15s) so it can't hang forever, and the
  queue is rejected if the user disconnects or reconnection gives up. Opt out with
  `queueWhileReconnecting: false`.

## Where it lives

- **`packages/ha-bridge/src/backoff.ts`** — `backoffDelay(attempt, options, random)`, a pure,
  deterministic (with an injected `random`) exponential-backoff-with-jitter function.
- **`packages/ha-bridge/src/client.ts`** — the reconnect state machine: `openSocket`, `handleClose`,
  `scheduleReconnect`, `reestablishSubscriptions`, and the `onReconnected` hook. The socket and
  timer are injectable (`HaClientOptions`) so the whole thing is unit-tested without a network.
- **`apps/web` `useHaConnection`** — wires `onReconnected` to reload the entity snapshot, and the
  status badge surfaces the `reconnecting` state.

## Tuning

```ts
new HaClient({
  reconnect: { enabled: true, baseMs: 1000, maxMs: 30000, jitter: 0.2, maxAttempts: Infinity },
});
```

All fields are optional; the defaults above are the shipping behavior. Set `enabled: false` to
opt out entirely, or a finite `maxAttempts` to give up after a bounded number of tries.

## How it pairs with the agent safety loop

The [safety loop](SAFETY.md) stops the agent from doing something _wrong_; resilience stops a
transient outage from making the twin _wrong_. Together: the agent's circuit breaker halts a burst
of failing commands, while the connection layer quietly reconnects underneath — so a blip never
snowballs into a serious issue while operating.
