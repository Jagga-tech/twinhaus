/**
 * Turn live power draw into money, so the energy view can answer "what is this costing me?" not
 * just "how many watts?". Pure and unit-agnostic: give it watts and a tariff and it returns cost.
 */

/** Cost of a constant load over common windows, given a per-kWh rate. */
export interface EnergyCost {
  perHourUsd: number;
  perDayUsd: number;
  perMonthUsd: number;
}

/** Cost of running `watts` continuously at `ratePerKwh` (dollars per kWh). */
export function energyCost(watts: number, ratePerKwh: number): EnergyCost {
  const kw = Math.max(0, watts) / 1000;
  const rate = Math.max(0, ratePerKwh);
  const perHourUsd = kw * rate;
  return {
    perHourUsd,
    perDayUsd: perHourUsd * 24,
    perMonthUsd: perHourUsd * 24 * 30,
  };
}

/** Format a dollar amount compactly (cents below a dollar, two decimals otherwise). */
export function formatUsd(amount: number): string {
  if (amount < 1) return `${Math.round(amount * 100)}c`;
  return `$${amount.toFixed(2)}`;
}
