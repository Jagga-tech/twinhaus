# Scan your home, no drawing

Drawing a floor plan is the biggest hurdle to a first twin. But Home Assistant already knows the
user's rooms and which device lives in which, so for anyone who's organized their HA into areas,
Twinhaus can build the whole layout and place every device in one click. No drawing, no hardware.

## How it works

```
Home Assistant registries                     Twinhaus
─────────────────────────                     ────────
config/area_registry/list    ──▶  areas   ──▶  one room per area (packed into a tidy grid)
config/device_registry/list  ──▶  devices ─┐
config/entity_registry/list  ──▶ entities ─┴▶  entity → device → area → room
                                               placeable entities dropped into their room
                                                       │
                                                       ▼
                                          preview ("6 rooms, 18 devices") → Apply
```

- **`packages/ha-bridge`** exposes `listAreas()`, `listDeviceRegistry()`, and
  `listEntityRegistry()`, thin reads over HA's WebSocket registry commands.
- **`apps/web/src/lib/homeScan.ts`** is the pure builder: `packAreasIntoRooms` lays out a room per
  area, `resolveEntityArea` maps each entity to its area (the entity's own assignment wins, else it
  inherits its device's), and `buildHomeScan` returns a ready-to-import `TwinModel`.
- **Import tab → "Scan from Home Assistant"** runs it, shows a preview, and applies it to the twin.

## What gets placed

Every entity in a **placeable domain** (light, switch, lock, climate, cover, camera, media_player,
fan, binary_sensor, sensor, vacuum) that resolves to an area is dropped into that room. HA's many
diagnostic and config entities (e.g. `update.*`) are skipped so the twin reads clean. Placeable
entities with no area are counted and reported, assign them an area in HA and rescan.

## Honest about geometry

The generated rooms are equal rectangles in a centered grid, a **starting point, not a claim of
real geometry**. It's deterministic (no randomness or clock), so the same home always scans to the
same layout, and the user drags walls in the Plan tab to match reality. The value is skipping the
blank canvas and getting every device already in the right room.

## Where this is going

This is Slice 1 (layout + placement from HA areas). Two layers build on it:

- **Slice 2, review & nudge:** a richer confirm step to fix a misassigned room before applying.
- **Slice 3, position from distance:** fine placement within a room via Bluetooth/UWB ranging
  (ESPHome BT proxies feeding HA's Bermuda/ESPresense), so a device's live dot sits where it
  actually is. Room-level today, sub-room with proxies later.
