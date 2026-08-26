// Interactive Map node label resolution (issue #165).
// Split out of InteractiveMap.tsx — as parent-resolver.ts was — so it can be
// exercised without d3, React, or a DOM.

import type { NodeSummary } from '@shared/summary';

// Label budget for the box. KEYWORD_MAX_LENGTH is 20, but NODE_WIDTH (140px)
// at 12px fits about 18 — so the clamp lives on the render side, and applies to
// the raw-prompt fallback too rather than being duplicated per source.
export const LABEL_MAX_CHARS = 18;

// The summary keyword (#158 contract) when the turn has been summarized,
// otherwise the truncated prompt text the map shipped with.
//
// A pipeline fallback entry already carries the truncated question as its
// keyword (summary.ts `fallbackSummary`), so the degradation path needs no
// branch of its own — it lands on the same text it would have shown anyway.
export function nodeLabel(text: string, summary: NodeSummary | undefined): string {
  const label = (summary?.keyword ?? text).trim();
  return label.length > LABEL_MAX_CHARS ? label.slice(0, LABEL_MAX_CHARS - 1) + '…' : label;
}
