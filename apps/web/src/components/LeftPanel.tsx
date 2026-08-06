import { useTwinStore } from '../store/twinStore.js';
import { FloorPlanEditor } from './editor/FloorPlanEditor.js';
import { EntityPanel } from './editor/EntityPanel.js';
import { EnergySummary } from './panels/EnergySummary.js';
import { EventTimeline } from './panels/EventTimeline.js';
import { SimulationPanel } from './panels/SimulationPanel.js';
import { ImportPanel } from './panels/ImportPanel.js';
import { FoundNearYou } from './discovery/FoundNearYou.js';
import { DeviceCatalog } from './catalog/DeviceCatalog.js';
import { BuildingSummaryPanel } from './panels/BuildingSummaryPanel.js';
import { ScenesPanel } from './panels/ScenesPanel.js';
import { BrainPanel } from './panels/BrainPanel.js';

type Tab = 'plan' | 'devices' | 'brain' | 'found' | 'catalog' | 'simulate' | 'import' | 'events';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'plan', label: 'Design' },
  { id: 'devices', label: 'Devices' },
  { id: 'brain', label: 'Brain' },
  { id: 'found', label: 'Found near you' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'simulate', label: 'Plan' },
  { id: 'import', label: 'Import' },
  { id: 'events', label: 'Events' },
];

/** The left workspace column: tabbed access to the editor and every Phase 2 to 4 tool. */
export function LeftPanel({ onOpenWizard }: { onOpenWizard: () => void }) {
  const tab = useTwinStore((state) => state.activeLeftTab) as Tab;
  const setTab = useTwinStore((state) => state.setActiveLeftTab);
  const discoveredCount = useTwinStore((state) => state.discovered.length);

  return (
    <section className="pane pane-left">
      <div className="tab-strip">
        {TABS.map((option) => (
          <button
            key={option.id}
            className={tab === option.id ? 'active' : ''}
            onClick={() => setTab(option.id)}
          >
            {option.label}
            {option.id === 'found' && discoveredCount > 0 && (
              <span className="tab-badge">{discoveredCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="tab-body">
        {tab === 'plan' && <FloorPlanEditor />}
        {tab === 'devices' && (
          <>
            <EntityPanel />
            <ScenesPanel />
            <h4 className="section-heading">Energy</h4>
            <EnergySummary />
            <BuildingSummaryPanel />
          </>
        )}
        {tab === 'brain' && <BrainPanel />}
        {tab === 'found' && <FoundNearYou />}
        {tab === 'catalog' && <DeviceCatalog />}
        {tab === 'simulate' && <SimulationPanel onOpenWizard={onOpenWizard} />}
        {tab === 'import' && <ImportPanel />}
        {tab === 'events' && <EventTimeline />}
      </div>
    </section>
  );
}
