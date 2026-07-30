import { useEffect } from 'react';
import { useTwinStore } from '../store/twinStore.js';
import { deriveLivePositions } from '../lib/positioningSources.js';
import { smoothPositions } from '../lib/positioning.js';

/**
 * Keep {@link useTwinStore}'s `livePositions` in sync with Home Assistant's distance sensors. Runs
 * whenever the placements or the live entity mirror change, so a device's dot follows it around the
 * twin as new ranging readings arrive. The raw estimates are calibrated with `positioningScale` and
 * exponentially smoothed against the previous frame so dots glide instead of jumping. Inert when no
 * distance sensors are present.
 */
export function useLivePositioning(): void {
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const positioningScale = useTwinStore((state) => state.positioningScale);
  const setLivePositions = useTwinStore((state) => state.setLivePositions);

  useEffect(() => {
    const next = deriveLivePositions(devices, entityStates, positioningScale);
    // Read the previous estimates without subscribing, smoothing must not retrigger this effect.
    const previous = useTwinStore.getState().livePositions;
    setLivePositions(smoothPositions(previous, next));
  }, [devices, entityStates, positioningScale, setLivePositions]);
}
