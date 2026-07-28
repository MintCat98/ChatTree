// D3-rendered interactive map shell
// Renders each chat turn as a rounded FigJam-style keyword box.
// The layout order is now left-to-right.
// Edge structure comes from a mock relevance function for now.
// Chain: each node simply connects to its predecessor
// Random: each node connects to random previous nodes

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { ChatboxNode } from '@shared/types';
import { usePanelStore } from '../store/panel-store';
import { scrollToNode } from '../../scroll-navigator';

// Dev flag: relevance scoring mock strategy.
// TODO: Remove when real relevance scoring lands.
const MOCK_RELEVANCE_MODE: 'chain' | 'random' = 'chain';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;
const H_GAP = 60;       // extra horizontal spacing between depth levels
const V_GAP = 12;       // extra vertical spacing betwen siblings
const NODE_GAP_Y = 12;
const PADDING = 16;
const EDGE_COLOR = 'var(--nav-color-edge)';
const EDGE_STROKE_WIDTH = 1.5;

// Zoom-related constants
const ZOOM_LADDER = [25, 50, 75, 100, 125, 150, 200];
const ZOOM_MIN = ZOOM_LADDER[0] / 100;
const ZOOM_MAX = ZOOM_LADDER[ZOOM_LADDER.length - 1] / 100;

// Mock relevance: pick a parent for each node from earlier nodes.
// 'chain' → previous node; 'random' → any earlier node (or root).
function pickParent(nodes: ChatboxNode[], i: number): string | null {
  if (i === 0) return null;
  if (MOCK_RELEVANCE_MODE === 'chain') return nodes[i - 1].id;
  const idx = Math.floor(Math.random() * i);
  return nodes[idx].id;
}

function nextLadderStep(current: number, direction: 1 | -1): number {
  if (direction === 1) {
    const next = ZOOM_LADDER.find((v) => v > current);
    return next ?? ZOOM_LADDER[ZOOM_LADDER.length - 1];
  } else {
    const prev = [...ZOOM_LADDER].reverse().find((v) => v < current);
    return prev ?? ZOOM_LADDER[0];
  }
}

// Turn the flat node list into a d3.hierarchy. Multiple roots collapse
// into a synthetic root so d3.tree() has a single entry point; the
// synthetic root is not rendered.
interface TreeDatum {
  id: string;
  text: string;
  children: TreeDatum[];
}

function buildHierarchy(nodes: ChatboxNode[]): TreeDatum {
  const byId = new Map<string, TreeDatum>();
  nodes.forEach((n) => byId.set(n.id, { id: n.id, text: n.text, children: [] }));

  const roots: TreeDatum[] = [];
  nodes.forEach((n, i) => {
    const parentId = pickParent(nodes, i);
    const self = byId.get(n.id)!;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(self);
    } else {
      roots.push(self);
    }
  });

  return { id: '__root__', text: '', children: roots };
}

export function InteractiveMap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tree = usePanelStore((s) => s.tree);

  // Zoom behavior state
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!tree || tree.nodes.length === 0) return;

    const root = d3.hierarchy(buildHierarchy(tree.nodes));

    // Left-to-right layout: swap x/y from d3.tree defaults.
    // nodeSize gives us predictable spacing regardless of container size.
    const layout = d3.tree<TreeDatum>().nodeSize([
      NODE_HEIGHT + V_GAP, // vertical step per sibling
      NODE_WIDTH + H_GAP,  // horizontal step per depth
    ]);
    layout(root);

    // Descendants excludes the synthetic root by filtering depth 0.
    const drawable = root.descendants().filter((d) => d.depth > 0);
    if (drawable.length === 0) return;

    // Normalize so the top-left of the drawn tree sits at (PADDING, PADDING).
    const minX = d3.min(drawable, (d) => d.x ?? 0) ?? 0;
    const minY = d3.min(drawable, (d) => d.y ?? 0) ?? 0;

    // Zoom + pan behavior. All content goes into #zoom-viewport
    // d3.zoom() writes a transform into it so we don't recompute layout on every gesture
    const viewport = svg.append('g').attr('class', 'zoom-viewport');
    const g = viewport
      .append('g')
      .attr('transform', `translate(${PADDING}, ${PADDING})`);
    
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
        setZoomPercent(Math.round(event.transform.k * 100));
      });
    
      svg.call(zoomBehavior);
      zoomBehaviorRef.current = zoomBehavior;

    // Curved edges — drawn first so nodes render on top of them.
    const linkGenerator = d3
      .linkHorizontal<d3.HierarchyPointLink<TreeDatum>, d3.HierarchyPointNode<TreeDatum>>()
      // Anchor edges on the right side of the source and left side of the target
      // so lines emerge from and land into the node edges, not their centers.
      .source((d) => ({
        ...d.source,
        x: (d.source.x ?? 0) - minX + NODE_HEIGHT / 2,
        y: (d.source.y ?? 0) - minY + NODE_WIDTH,
      } as d3.HierarchyPointNode<TreeDatum>))
      .target((d) => ({
        ...d.target,
        x: (d.target.x ?? 0) - minX + NODE_HEIGHT / 2,
        y: (d.target.y ?? 0) - minY,
      } as d3.HierarchyPointNode<TreeDatum>))
      // d3.linkHorizontal reads (y, x) as (horizontal, vertical) by default;
      // we already swapped the coords in the layout, so keep it consistent.
      .x((d) => d.y ?? 0)
      .y((d) => d.x ?? 0);

    g.selectAll('path.im-edge')
      .data(root.links().filter((l) => l.source.depth > 0) as d3.HierarchyPointLink<TreeDatum>[])
      .enter()
      .append('path')
      .attr('class', 'im-edge')
      .attr('d', linkGenerator)
      .attr('fill', 'none')
      .attr('stroke', EDGE_COLOR)
      .attr('stroke-width', EDGE_STROKE_WIDTH);

    const nodeGroup = g
        .selectAll<SVGGElement, d3.HierarchyPointNode<TreeDatum>>('g.im-node')
        .data(drawable as d3.HierarchyPointNode<TreeDatum>[])
        .enter()
        .append('g')
        .attr('class', 'im-node')
        .attr('transform', (d) => `translate(${(d.y ?? 0) - minY}, ${(d.x ?? 0) - minX})`)
        .style('cursor', 'pointer')
        .on('click', (_event, d) => scrollToNode(d.data.id));

    nodeGroup
      .append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 8)
      .attr('fill', 'var(--nav-color-node-fill)')
      .attr('stroke', 'var(--nav-color-node-border)')
      .attr('stroke-width', 1.5);

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
        const t = d.data.text.trim();
        return t.length > 18 ? t.slice(0, 17) + '…' : t;
      });
  }, [tree]);


  const zoomTo = (percent: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, percent / 100));
    const svg = d3.select(svgRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;
    const currentTransform = d3.zoomTransform(svgRef.current);
    const newTransform = d3.zoomIdentity
      .translate(cx - k * ((cx - currentTransform.x) / currentTransform.k),
                 cy - k * ((cy - currentTransform.y) / currentTransform.k))
      .scale(k);
    svg.transition().duration(150).call(zoomBehaviorRef.current.transform, newTransform);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: 'block', cursor: 'grab' }}
      />
      <div
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 6px',
          background: 'var(--nav-color-bg)',
          border: '1px solid var(--nav-color-border)',
          borderRadius: 8,
          fontFamily: 'var(--nav-font-family)',
          fontSize: 'var(--nav-font-size-sm)',
          color: 'var(--nav-color-text)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          userSelect: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => zoomTo(nextLadderStep(zoomPercent, -1))}
          aria-label="Zoom out"
          style={zoomBtnStyle}
        >
          −
        </button>
        <span style={{ minWidth: 40, textAlign: 'center' }}>{zoomPercent}%</span>
        <button
          type="button"
          onClick={() => zoomTo(nextLadderStep(zoomPercent, 1))}
          aria-label="Zoom in"
          style={zoomBtnStyle}
        >
          +
        </button>
      </div>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'currentColor',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  borderRadius: 4,
};