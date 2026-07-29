import { useEffect } from 'react';
import { useTwinStore } from '../store/twinStore.js';
import { deriveLivePositions } from '../lib/positioningSources.js';

/**
 * Keep {@link useTwinStore}'s `livePositions` in sync with Home Assistant's distance sensors. Runs
 * whenever the placements or the live entity mirror change, so a device's dot follows it around the
 * twin as new ranging readings arrive. Inert when no distance sensors are present.
 */
export function useLivePositioning(): void {
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const setLivePositions = useTwinStore((state) => state.setLivePositions);

  useEffect(() => {
    setLivePositions(deriveLivePositions(devices, entityStates));
  }, [devices, entityStates, setLivePositions]);
}
