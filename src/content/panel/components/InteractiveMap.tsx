// D3-rendered interactive map shell
// Renders each chat turn as a rounded FigJam-style keyword box.
// The layout order is now left-to-right.
// Edge structure comes from a mock relevance function for now.
// Chain: each node simply connects to its predecessor
// Random: each node connects to random previous nodes

import { useCallback, useEffect, useRef, useState } from 'react';
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
const ZOOM_FINE_STEP = 0.05;

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
  const isSpacePressedRef = useRef(false);
  const isPointerInsideRef = useRef(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);

  // Zoom helpers wrapped in useCallback so the listener effect has stable refs.
  const zoomTo = useCallback((percent: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, percent / 100));
    const svg = d3.select(svgRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;
    const current = d3.zoomTransform(svgRef.current);
    const newTransform = d3.zoomIdentity
      .translate(cx - k * ((cx - current.x) / current.k),
                 cy - k * ((cy - current.y) / current.k))
      .scale(k);
    svg.transition().duration(150).call(zoomBehaviorRef.current.transform, newTransform);
  }, []);

  const zoomAtPoint = useCallback((deltaK: number, px: number, py: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    const current = d3.zoomTransform(svgRef.current);
    const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current.k + deltaK));
    const newTransform = d3.zoomIdentity
      .translate(px - k * ((px - current.x) / current.k),
                 py - k * ((py - current.y) / current.k))
      .scale(k);
    svg.call(zoomBehaviorRef.current.transform, newTransform);
  }, []);

  // Effect A - event listeners. Registered once on mount so pointer/space
  // state and DOM listeners survive tree re-enders
  useEffect(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const shadowRoot = svgEl.getRootNode() as ShadowRoot;

    const onPointerEnter = () => {
      isPointerInsideRef.current = true;
      svgEl.focus();
    };
    const onPointerLeave = () => {
      isPointerInsideRef.current = false;
    }
    const onPointerDown = () => {
      setTimeout(() => svgEl.focus(), 0);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPointerInsideRef.current) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        isSpacePressedRef.current = true;
        svgEl.style.cursor = 'grabbing';
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        e.stopPropagation();
        const rect = svgEl.getBoundingClientRect();
        zoomAtPoint(ZOOM_FINE_STEP, rect.width / 2, rect.height / 2);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        e.stopPropagation();
        const rect = svgEl.getBoundingClientRect();
        zoomAtPoint(-ZOOM_FINE_STEP, rect.width / 2, rect.height / 2);
        return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.stopPropagation();
      isSpacePressedRef.current = false;
      svgEl.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      const rect = svgEl.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      zoomAtPoint(direction * ZOOM_FINE_STEP, px, py);
    };

    svgEl.addEventListener('pointerenter', onPointerEnter);
    svgEl.addEventListener('pointerleave', onPointerLeave);
    svgEl.addEventListener('pointerdown', onPointerDown);
    svgEl.addEventListener('wheel', onWheel, { passive: false });
    shadowRoot.addEventListener('keydown', onKeyDown as EventListener);
    shadowRoot.addEventListener('keyup', onKeyUp as EventListener);

    return () => {
      svgEl.removeEventListener('pointerenter', onPointerEnter);
      svgEl.removeEventListener('pointerleave', onPointerLeave);
      svgEl.removeEventListener('pointerdown', onPointerDown);
      svgEl.removeEventListener('wheel', onWheel);
      shadowRoot.removeEventListener('keydown', onKeyDown as EventListener);
      shadowRoot.removeEventListener('keyup', onKeyUp as EventListener);
    };
  }, [zoomAtPoint]);

  // Effect B - render tree. Runs on every tree update, but preserves the
  // user/s pan/zoom transform so typing in the chat doesn't reset the view.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const preservedTransform = zoomBehaviorRef.current
      ? d3.zoomTransform(svgRef.current)
      : d3.zoomIdentity;
    
      svg.selectAll('*').remove();

      if(!tree || tree.nodes.length === 0) {
        zoomBehaviorRef.current = null;
        return;
      }

      const root = d3.hierarchy(buildHierarchy(tree.nodes));
      const layout = d3.tree<TreeDatum>().nodeSize([
      NODE_HEIGHT + V_GAP,
      NODE_WIDTH + H_GAP,
    ]);
    layout(root);

    const drawable = root.descendants().filter((d) => d.depth > 0);
    if (drawable.length === 0) return;

    const minX = d3.min(drawable, (d) => d.x ?? 0) ?? 0;
    const minY = d3.min(drawable, (d) => d.y ?? 0) ?? 0;

    const viewport = svg.append('g').attr('class', 'zoom-viewport');
    const g = viewport.append('g').attr('transform', `translate(${PADDING}, ${PADDING})`);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .filter((event) => {
        if (event.type === 'wheel') return false;
        if (event.button === 1) return true;
        if (isSpacePressedRef.current && event.button === 0) return true;
        if (event.button === 0) {
          const target = event.target as Element;
          return !target.closest('g.im-node');
        }
        return false;
      })
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
        setZoomPercent(Math.round(event.transform.k * 100));
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    // Restore the previous pan/zoom so tree updates don't jump the view.
    svg.call(zoomBehavior.transform, preservedTransform);

    const linkGenerator = d3
      .linkHorizontal<d3.HierarchyPointLink<TreeDatum>, d3.HierarchyPointNode<TreeDatum>>()
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

    // Hover handles
    const previewLayer = g.append('g').attr('class', 'im-preview-layer');

    const HANDLE_RADIUS = 5;

    // Left handle (incoming edge target)
    nodeGroup
      .append('circle')
      .attr('class', 'im-handle im-handle-left')
      .attr('cx', 0)
      .attr('cy', NODE_HEIGHT / 2)
      .attr('r', HANDLE_RADIUS)
      .attr('fill', 'var(--nav-color-node-fill)')
      .attr('stroke', 'var(--nav-color-node-border)')
      .attr('stroke-width', 1.5)
      .style('opacity', 0);

    // Right handle (outgoing edge source)
    nodeGroup
      .append('circle')
      .attr('class', 'im-handle im-handle-right')
      .attr('cx', NODE_WIDTH)
      .attr('cy', NODE_HEIGHT / 2)
      .attr('r', HANDLE_RADIUS)
      .attr('fill', 'var(--nav-color-node-fill)')
      .attr('stroke', 'var(--nav-color-node-border)')
      .attr('stroke-width', 1.5)
      .style('opacity', 0)
      .on('pointerdown', function (event: PointerEvent, d) {
          // Don't let d3.zoom start a pan when a handle is grabbed.
          event.stopPropagation();
          event.preventDefault();

          // Source point: this handle's position in the g coord system.
          const srcX = (d.y ?? 0) - minY + NODE_WIDTH;
          const srcY = (d.x ?? 0) - minX + NODE_HEIGHT / 2;

          // Preview path — starts as a zero-length curve at the source.
          const previewPath = previewLayer
            .append('path')
            .attr('class', 'im-preview-edge')
            .attr('fill', 'none')
            .attr('stroke', 'var(--nav-color-edge)')
            .attr('stroke-width', EDGE_STROKE_WIDTH)
            .attr('stroke-dasharray', '4 3')
            .attr('pointer-events', 'none');

          // Capture the pointer so we get moves even off the handle circle.
          (event.target as Element).setPointerCapture?.(event.pointerId);

          function pointToSvgCoords(clientX: number, clientY: number) {
            // Convert client (viewport) coords → svg → viewport-group coords.
            if (!svgRef.current) return { x: 0, y: 0 };
            const pt = svgRef.current.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const ctm = (g.node() as SVGGraphicsElement).getScreenCTM();
            if (!ctm) return { x: 0, y: 0 };
            const local = pt.matrixTransform(ctm.inverse());
            return { x: local.x, y: local.y };
          }

          function bezier(x1: number, y1: number, x2: number, y2: number): string {
            // Same horizontal-cubic style as d3.linkHorizontal for visual continuity.
            const midX = (x1 + x2) / 2;
            return `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
          }

          const onPointerMove = (moveEvent: PointerEvent) => {
            const { x, y } = pointToSvgCoords(moveEvent.clientX, moveEvent.clientY);
            previewPath.attr('d', bezier(srcX, srcY, x, y));
          };

          const onPointerUp = () => {
            previewPath.remove();
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
          };

          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
        });
  }, [tree]);

  // Sync expand state to the parent sidebar-bottom container so it can
  // break out horizontally beyond the sidebar width.
  useEffect(() => {
    if (!svgRef.current) return;
    const parent = svgRef.current.closest('.nav-sidebar-bottom');
    if (!parent) return;
    parent.classList.toggle('is-expanded', isExpanded);
    return () => parent.classList.remove('is-expanded');
  }, [isExpanded]);
  

  return (
    <div className="nav-im-container">
      <svg
        ref={svgRef}
        className="nav-im-svg"
        tabIndex={0}
      />

      {/* Horizontal expand toggle (bottom-right, left of zoom control) */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-label={isExpanded ? 'Collapse map' : 'Expand map'}
        aria-pressed={isExpanded}
        title={isExpanded ? 'Collapse' : 'Expand'}
        className="nav-im-expand-btn"
      >
        {isExpanded ? '⇥' : '⇤'}
      </button>

      {/* Zoom control (bottom-right) */}
      <div className="nav-im-zoom-control">
        <button
          type="button"
          onClick={() => zoomTo(nextLadderStep(zoomPercent, -1))}
          aria-label="Zoom out"
          className="nav-im-zoom-btn"
        >
          −
        </button>
        <span className="nav-im-zoom-readout">{zoomPercent}%</span>
        <button
          type="button"
          onClick={() => zoomTo(nextLadderStep(zoomPercent, 1))}
          aria-label="Zoom in"
          className="nav-im-zoom-btn"
        >
          +
        </button>
      </div>
    </div>
  );
}