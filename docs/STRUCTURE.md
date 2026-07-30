# Whole-house structure, floors & levels

A real home is more than one floor plan. Twinhaus models a building as a **stack of levels**
(storeys), each with its own rooms and devices. The app shows one floor at a time, the "pages" of
the structure, and you switch between them without losing your place.

## The model

- **`Level`** (`store/types.ts`), `{ id, name, order }`. `order` is the storey number (basement
  negative, ground 0, first 1…) so the switcher always reads bottom-to-top.
- **`Room.levelId`**, the floor a room sits on. It's optional: an unset value means the default
  ground floor, so every pre-levels twin keeps working untouched.
- **`TwinModel.levels`**, the portable document carries the building's floors, so templates,
  export/import, and the MCP server all round-trip a multi-storey home.

`lib/levels.ts` holds the pure helpers, `roomsOnLevel`, `devicesOnLevel`, `sortedLevels`,
`normalizeLevels` (guarantees ≥1 level and repairs dangling `levelId`s on import), all unit-tested.

## The switcher (pages)

`LevelSwitcher` renders one chip per floor with its room count. Click to switch; double-click to
rename; the active floor can be removed (with everything on it) as long as one remains. The **2D
editor and 3D twin both filter to the active level**, so drawing, placing, and viewing all happen on
the floor you're looking at, and new rooms are tagged to it automatically.

## Building types

Instead of a single blank plan, `BUILDING_TYPES` (`lib/levels.ts`) offers ready multi-storey
starts, **Bungalow** (1), **Two-storey house** (2), **Townhouse** (3), materialized by
`buildingToTwin` into a `TwinModel` with stacked levels. They sit alongside the single-floor
templates in the Import tab.

## Stacked 3D view

The floor switcher's **Stack floors** toggle (shown once there's more than one storey) explodes the
whole building vertically, every floor rendered at its own elevation (`levelElevation`, storey ×
`LEVEL_GAP`) so you see the house as a stack instead of one floor at a time. Picking/placing is
disabled while stacked; switch back to a single floor to edit.

## Whole-house summary

The Devices tab shows a **Whole house** rollup once a home has 2+ floors (`buildingSummary`):
rooms, devices, and power draw per storey, plus building-wide totals. Power reuses the same
`computeRoomEnergy` as the heatmap, scoped per floor. Click a floor row to jump the editor and twin
to it. The first-run WelcomeFlow also gains an optional "Add your floors" nudge.

## Scanning a multi-storey home

Home Assistant has a **floor registry**, and areas reference it by `floor_id`. The scan
(`buildHomeScan`) reads `listFloors()`, creates one **level per floor**, groups each area onto its
floor, and packs each floor's rooms into their own grid (floors share the same footprint since only
one shows at a time). No floors defined in HA? Everything lands on a single **Home** level. So a
three-storey house with HA floors set up scans into three switchable pages in one click.
