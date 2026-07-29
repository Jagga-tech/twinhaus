import { useTwinStore } from '../../store/twinStore.js';

/**
 * Shown over the 3D viewer right after a device is added: prompts the user to click the room it
 * lives in. Clicking a room floor (handled in the viewer) creates the placement and clears this.
 */
export function PlacementPrompt() {
  const pendingPlacement = useTwinStore((state) => state.pendingPlacement);
  const setPendingPlacement = useTwinStore((state) => state.setPendingPlacement);

  if (!pendingPlacement) return null;

  return (
    <div className="placement-prompt">
      <span>
        Where does <strong>{pendingPlacement.label}</strong> live? Click its room in the 3D view.
      </span>
      <button className="link" onClick={() => setPendingPlacement(null)}>
        Skip
      </button>
    </div>
  );
}
