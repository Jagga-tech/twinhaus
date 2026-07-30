import { useTwinStore } from '../store/twinStore.js';
import { sortedLevels, roomsOnLevel } from '../lib/levels.js';

/**
 * Floor switcher — the "pages" of the whole-house structure. Each level is a storey; picking one
 * shows just that floor in the 2D editor and 3D twin. Add or rename floors inline so a bungalow can
 * grow into a townhouse without leaving the view.
 */
export function LevelSwitcher() {
  const levels = useTwinStore((state) => state.levels);
  const rooms = useTwinStore((state) => state.rooms);
  const activeLevelId = useTwinStore((state) => state.activeLevelId);
  const setActiveLevel = useTwinStore((state) => state.setActiveLevel);
  const addLevel = useTwinStore((state) => state.addLevel);
  const renameLevel = useTwinStore((state) => state.renameLevel);
  const removeLevel = useTwinStore((state) => state.removeLevel);

  const ordered = sortedLevels(levels);

  function onAdd() {
    const name = window.prompt('Name this floor:', `Floor ${levels.length + 1}`);
    if (name) addLevel(name);
  }

  function onRename(id: string, current: string) {
    const name = window.prompt('Rename floor:', current);
    if (name) renameLevel(id, name);
  }

  function onRemove(id: string, name: string) {
    if (levels.length <= 1) return;
    if (window.confirm(`Delete "${name}" and everything on it?`)) removeLevel(id);
  }

  return (
    <div className="level-switcher" role="tablist">
      {ordered.map((level) => {
        const count = roomsOnLevel(rooms, level.id).length;
        const active = level.id === activeLevelId;
        return (
          <button
            key={level.id}
            role="tab"
            aria-selected={active}
            className={active ? 'active' : ''}
            onClick={() => setActiveLevel(level.id)}
            onDoubleClick={() => onRename(level.id, level.name)}
            title="Double-click to rename"
          >
            {level.name}
            <span className="level-count">{count}</span>
            {active && levels.length > 1 && (
              <span
                className="level-x"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(level.id, level.name);
                }}
              >
                ×
              </span>
            )}
          </button>
        );
      })}
      <button className="level-add" onClick={onAdd} title="Add a floor">
        + Floor
      </button>
    </div>
  );
}
