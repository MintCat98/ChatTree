// Parent resolution for the Interactive Map (issue #164): the mock relevance
// chain, user overrides from node metadata, and the cycle guard that keeps a
// corrupt override from stranding nodes outside the rendered forest.

import type { ChatboxNode, NodeMetadata } from '@shared/types';

// Dev flag: relevance scoring mock strategy.
// TODO: Remove when real relevance scoring lands.
const MOCK_RELEVANCE_MODE: 'chain' | 'random' = 'chain';

// pickParent runs on every render (the map effect re-runs on tree, metadata
// and label-edit changes), so an unguarded warn would repeat for the lifetime
// of the panel. Warn once per offending edge instead.
const warnedCycles = new Set<string>();

// Test seam: the dedupe above is module state, so suites that assert on the
// warning must clear it between cases.
export function resetCycleWarnings(): void {
  warnedCycles.clear();
}

// Would setting `newParentId` as `nodeId`'s parent create a cycle?
// Walks up from newParentId via the resolved parent chain (override wins
// over chain parentId). If we reach nodeId, it's a cycle.
export function wouldCreateCycle(
  nodeId: string,
  newParentId: string,
  nodes: ChatboxNode[],
  metadata: Record<string, NodeMetadata>,
): boolean {
  const idxById = new Map(nodes.map((n, k) => [n.id, k]));

  const parentOf = (id: string): string | null => {
    const meta = metadata[id];
    if (meta?.parentDisconnected) return null;
    const override = meta?.parentOverride;
    if (override !== undefined && override !== null) return override;
    const idx = idxById.get(id);
    if (idx === undefined || idx === 0) return null;
    if (MOCK_RELEVANCE_MODE === 'chain') return nodes[idx - 1].id;
    const r = Math.floor(Math.random() * idx);
    return nodes[r].id;
  };

  let current: string | null = newParentId;
  const visited = new Set<string>();
  while (current !== null) {
    if (current === nodeId) return true;      // cycle
    if (visited.has(current)) return false;   // pre-existing cycle (defensive)
    visited.add(current);
    current = parentOf(current);
  }
  return false;
}

// Mock relevance: pick a parent for each node from earlier nodes.
// 'chain' → previous node; 'random' → any earlier node (or root).
export function pickParent(
  nodes: ChatboxNode[], 
  i: number,
  metadata: Record<string, NodeMetadata>,
): string | null {
  const node = nodes[i];
  const meta = metadata[node.id];

  // Explicit disconnect overrides everyhthing - user made this a root !
  if (meta?.parentDisconnected) return null;

  // User chose parent.
  const override = metadata[node.id]?.parentOverride;
  if (override !== undefined && override !== null) {
    if (wouldCreateCycle(node.id, override, nodes, metadata)) {
      const key = `${node.id}->${override}`;
      if (!warnedCycles.has(key)) {
        warnedCycles.add(key);
        console.warn(
          `[InteractiveMap] Cycle detected via ${node.id} → ${override}; ` +
          `falling back to root. Persisted parentOverride left intact.`,
        );
      }
      return null;
    }
    return override;
  }

  if (i === 0) return null;
  if (MOCK_RELEVANCE_MODE === 'chain') return nodes[i - 1].id;
  const idx = Math.floor(Math.random() * i);
  return nodes[idx].id;
}
