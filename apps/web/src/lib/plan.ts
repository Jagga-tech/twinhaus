import type { CatalogDevice } from '@twinhaus/discovery';
import type { Point2D, Room, VirtualDevice } from '../store/types.js';

/**
 * Planning helpers for the no-hardware path: turn a catalog product into a placeable planned device,
 * and roll a set of planned devices up into a shopping list with an estimated total, so someone
 * with nothing can design a home, plan what to buy, and see the cost before spending anything.
 */

/** A planned device draft (no id yet) built from a real catalog product, ready for the store. */
export function virtualFromCatalog(
  device: CatalogDevice,
  roomId: string,
  position: Point2D,
): Omit<VirtualDevice, 'id'> {
  return {
    category: device.category,
    label: `${device.brand} ${device.model}`,
    roomId,
    position,
    rotationY: 0,
    rangeM: device.rangeM,
    fovDeg: device.category === 'camera' ? 90 : 360,
    catalogId: device.id,
    brand: device.brand,
    model: device.model,
    priceUsd: device.approxPriceUsd,
  };
}

/** One line of the plan's shopping list: a product (or generic device) and how many are planned. */
export interface PlanLine {
  label: string;
  category: VirtualDevice['category'];
  count: number;
  /** Unit price if the device is a priced catalog product; 0 for generic placements. */
  unitPriceUsd: number;
  /** count × unitPriceUsd. */
  lineTotalUsd: number;
}

export interface PlanSummary {
  lines: PlanLine[];
  deviceCount: number;
  /** Sum of all priced lines. */
  totalUsd: number;
  /** How many planned devices have no price yet (generic placements). */
  unpricedCount: number;
}

/**
 * Roll planned devices into a shopping list: identical products (same label + price) collapse into a
 * single line with a count, and the priced lines sum to a total. Ordered by line total, biggest
 * first, so the plan reads like a quote.
 */
export function planSummary(devices: VirtualDevice[]): PlanSummary {
  const byKey = new Map<string, PlanLine>();
  let unpricedCount = 0;

  for (const device of devices) {
    const unitPriceUsd = device.priceUsd ?? 0;
    if (unitPriceUsd === 0) unpricedCount += 1;
    const key = `${device.label}|${unitPriceUsd}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.lineTotalUsd = existing.count * existing.unitPriceUsd;
    } else {
      byKey.set(key, {
        label: device.label,
        category: device.category,
        count: 1,
        unitPriceUsd,
        lineTotalUsd: unitPriceUsd,
      });
    }
  }

  const lines = [...byKey.values()].sort((a, b) => b.lineTotalUsd - a.lineTotalUsd);
  const totalUsd = lines.reduce((sum, line) => sum + line.lineTotalUsd, 0);
  return { lines, deviceCount: devices.length, totalUsd, unpricedCount };
}

/** Rooms in the plan that have no planned or real device in them yet, the obvious gaps to fill. */
export function emptyRooms(rooms: Room[], occupiedRoomIds: Set<string>): Room[] {
  return rooms.filter((room) => !occupiedRoomIds.has(room.id));
}
