// Unit tests for Interactive Map node labels (issue #165).
//
// nodeLabel decides what a map box says: the #158 summary keyword when the turn
// has been summarized, the raw prompt text when it has not. It lives in
// node-label.ts, split out of InteractiveMap.tsx so it can be exercised without
// d3 or a DOM — the same reason parent-resolver.ts exists.

import { nodeLabel, LABEL_MAX_CHARS } from '@content/panel/components/node-label';
import { KEYWORD_MAX_LENGTH } from '@shared/summary';
import type { NodeSummary } from '@shared/summary';

function summary(keyword: string): NodeSummary {
  return { keyword, question: 'q?', answer: 'a.' };
}

describe('nodeLabel — source selection', () => {
  it('prefers the summary keyword over the prompt text', () => {
    expect(nodeLabel('what is a LUT anyway', summary('LUT basics'))).toBe('LUT basics');
  });

  it('falls back to the prompt text when the node has no summary', () => {
    // summaryEnabled off, Prompt API absent, or the queue has not drained yet.
    expect(nodeLabel('short prompt', undefined)).toBe('short prompt');
  });

  it('trims surrounding whitespace from either source', () => {
    expect(nodeLabel('  spaced prompt  ', undefined)).toBe('spaced prompt');
    expect(nodeLabel('ignored', summary('  spaced kw  '))).toBe('spaced kw');
  });
});

describe('nodeLabel — box budget', () => {
  it('clamps a prompt longer than the box with an ellipsis', () => {
    const label = nodeLabel('a'.repeat(50), undefined);

    expect(label).toHaveLength(LABEL_MAX_CHARS);
    expect(label.endsWith('…')).toBe(true);
  });

  it('clamps a max-length keyword too — KEYWORD_MAX_LENGTH exceeds the box', () => {
    // The #158 contract caps keywords at 20 chars but the 140px box fits ~18,
    // so the render-side clamp has to apply to keywords as well as prompts.
    expect(KEYWORD_MAX_LENGTH).toBeGreaterThan(LABEL_MAX_CHARS);

    const label = nodeLabel('ignored', summary('k'.repeat(KEYWORD_MAX_LENGTH)));

    expect(label).toHaveLength(LABEL_MAX_CHARS);
    expect(label.endsWith('…')).toBe(true);
  });

  it('leaves a label that exactly fills the box untouched', () => {
    const exact = 'k'.repeat(LABEL_MAX_CHARS);

    expect(nodeLabel('ignored', summary(exact))).toBe(exact);
  });

  it('renders a truncated-fallback summary as its keyword, not as an empty box', () => {
    // summary.ts fallbackSummary sets keyword = truncate(question, 20), so a
    // pipeline failure degrades to the prompt text rather than a blank node.
    const fallback = summary('what is a LUT any...');

    expect(nodeLabel('what is a LUT anyway, really?', fallback)).toBe('what is a LUT any…');
  });
});
