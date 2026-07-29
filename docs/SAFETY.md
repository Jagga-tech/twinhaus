# Agent safety loop

The chat agent controls real devices. The safety loop makes sure it can never cause a serious,
hard-to-undo problem while operating — unlocking the house, disarming the alarm, opening a garage,
cutting the heat in winter, or firing off a runaway burst of commands. It wraps the tool-calling
loop with four independent guards, all in `packages/agent` and fully unit-tested.

## Where it lives

- **`packages/agent/src/safety.ts`** — classifies each control action and parses tool input.
- **`packages/agent/src/agent.ts`** — the loop enforces the guards around every tool call.
- **`apps/web` chat** — renders the inline Approve/Deny prompt for guarded actions.

Read-only tools (`describe_home`, `list_entities`, `search_device_catalog`, …) never touch this
layer; only state-changing actions (`call_service`) do.

## The four guards

### 1. Risk classification

Every action is assessed before it runs (`assessAction`):

| Risk          | Examples                                                              | Behavior                                  |
| ------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| **safe**      | light/switch on, scene on, lock **lock**, cover **close**             | runs immediately                          |
| **sensitive** | whole-home (`homeassistant.*`), switch off, vacuum/water heater       | needs confirmation                        |
| **critical**  | lock **unlock**, alarm **disarm**, cover/garage **open**, heating off | needs confirmation; denied if no approver |

Rules are conservative and directional — locking and closing are safe, unlocking and opening are
guarded. When unsure, the classifier escalates rather than relaxes.

### 2. Confirmation gate

A guarded action is **not executed** until approved. In the app the user sees an inline
Approve/Deny card; approving runs it, denying feeds a "declined — do not retry" result back to the
model so it explains instead of working around the guard. If no approver is wired
(`confirmAction` omitted), guarded actions are **declined by default** — the loop never runs a
sensitive or critical action unattended.

### 3. Circuit breaker

After `maxConsecutiveErrors` (default 3) tool errors in a row, the loop halts with a clear reason
instead of thrashing against a broken Home Assistant connection. A single success resets the count.

### 4. Action budget

A hard cap of `maxActions` (default 12) control actions per user message. A misfiring model that
tries to fan out dozens of service calls is stopped at the budget, with the remaining calls skipped
and a `loop_halted` event emitted.

### 5. Verify-after-act

A confident lie is its own kind of serious issue. After a control call, the adapter confirms the
device actually reached the intended state instead of assuming success:

- **Retry transient failures.** `withRetry` re-runs the service call on connection-level errors
  (dropped/timed-out) with backoff, but never retries a deliberate Home Assistant rejection (bad
  service, unknown entity) — that would just repeat the error.
- **Confirm the outcome.** For unambiguous transitions (`expectedStateFor` — on/off, lock/unlock,
  cover open/close), `confirmState` polls the live state for a couple of seconds. If it lands, the
  tool reports "confirmed it is now …"; if not, it reports "couldn't confirm it took effect (still
  …)" and the agent is instructed to tell the user rather than claim success.

Lives in `apps/web/src/lib/verifyAction.ts` (pure and injectable, so it's unit-tested without
timers), wired into the `call_service` adapter in `homeContext.ts`.

## Events

The loop emits safety events alongside the usual tool activity, so any UI can surface them:

- `confirmation_required` — a guarded action is waiting on the user.
- `action_blocked` — an action was declined and not executed.
- `loop_halted` — the breaker tripped or the budget was reached.

## Tuning

`new Agent({ provider, context, maxActions, maxConsecutiveErrors, confirmAction })` — all optional.
Defaults are conservative; raise the caps only for trusted, supervised automation.
