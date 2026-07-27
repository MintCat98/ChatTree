// D3-rendered interactive map shell
// Renders each chat turn as a rounded FigJam-style keyword box.
// No edges, no interactions yet.

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { usePanelStore } from '../store/panel-store';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;
const NODE_GAP_Y = 12;
const PADDING = 16;

export function InteractiveMap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tree = usePanelStore((s) => s.tree);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!tree || tree.nodes.length === 0) return;

    // Simple vertical stack for now — layout comes in the next step.
    const nodeGroup = svg
      .selectAll('g.im-node')
      .data(tree.nodes)
      .enter()
      .append('g')
      .attr('class', 'im-node')
      .attr(
        'transform',
        (_, i) => `translate(${PADDING}, ${PADDING + i * (NODE_HEIGHT + NODE_GAP_Y)})`,
      );

    nodeGroup
      .append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 8)
      .attr('fill', 'var(--nav-color-node-fill)')
      .attr('stroke', 'var(--nav-color-node-border)')
      .attr('stroke-width', 1.5);

    // Truncated prompt text — real keyword summaries land in #160.
    nodeGroup
      .append('text')
      .attr('x', NODE_WIDTH / 2)
      .attr('y', NODE_HEIGHT / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'var(--nav-color-text)')
      .attr('font-size', '12px')
      .attr('font-family', 'var(--nav-font-family)')
      .text((d) => {
        const t = d.text.trim();
        return t.length > 18 ? t.slice(0, 17) + '…' : t;
      });
  }, [tree]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block' }}
    />
  );
}