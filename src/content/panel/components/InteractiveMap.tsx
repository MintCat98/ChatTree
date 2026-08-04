// D3-rendered interactive map shell
// Renders each chat turn as a rounded FigJam-style keyword box.
// The layout order is now left-to-right.
// Edge structure comes from a mock relevance function for now.
// Chain: each node simply connects to its predecessor
// Random: each node connects to random previous nodes

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { ChatboxNode, NodeMetadata } from '@shared/types';
import { usePanelStore } from '../store/panel-store';
import { scrollToNode } from '../../scroll-navigator';
import { pickParent, wouldCreateCycle } from './parent-resolver';
import { setNodeMetadata } from '@shared/metadata-storage';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;
const H_GAP = 60;       // extra horizontal spacing between depth levels
const V_GAP = 12;       // extra vertical spacing betwen siblings
const PADDING = 16;
const EDGE_COLOR = 'var(--nav-color-edge)';
const EDGE_STROKE_WIDTH = 1.5;

// Zoom-related constants
const ZOOM_LADDER = [25, 50, 75, 100, 125, 150, 200];
const ZOOM_MIN = ZOOM_LADDER[0] / 100;
const ZOOM_MAX = ZOOM_LADDER[ZOOM_LADDER.length - 1] / 100;
const ZOOM_FINE_STEP = 0.05;

const HANDLE_RADIUS = 5;
const SNAP_RADIUS = 30;

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

function buildHierarchy(
  nodes: ChatboxNode[],
  metadata: Record<string, NodeMetadata>,
): TreeDatum {
  const byId = new Map<string, TreeDatum>();
  nodes.forEach((n) => byId.set(n.id, { id: n.id, text: n.text, children: [] }));

  const roots: TreeDatum[] = [];
  nodes.forEach((n, i) => {
    const parentId = pickParent(nodes, i, metadata);
    const self = byId.get(n.id)!;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(self);
    } else {
      roots.push(self);
    }
  });

  return { id: '__root__', text: '', children: roots };
}

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
}

export function InteractiveMap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tree = usePanelStore((s) => s.tree);
  const sessionMetadata = usePanelStore((s) => s.sessionMetadata);
  const patchNodeMetadata = usePanelStore((s) => s.patchNodeMetadata);

  // Zoom behavior state
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const isSpacePressedRef = useRef(false);
  const isPointerInsideRef = useRef(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);

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

    const root = d3.hierarchy(buildHierarchy(tree?.nodes, sessionMetadata));
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
          return !target.closest('g.im-node') && !target.closest('im-handle');
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

    // Hover handles
    const previewLayer = g.append('g').attr('class', 'im-preview-layer');
    
    const dropTargets = drawable.map((node) => ({
      id: node.data.id,
      x: (node.y ?? 0) - minY + NODE_WIDTH, // target: right node
      y: (node.x ?? 0) - minX + NODE_HEIGHT / 2,
    }));

    // Count siblings per parent so we know which children live on a branch point.
    const siblingCount = new Map<string, number>();
    for (const node of drawable) {
      const parent = node.parent;
      if (!parent) continue;
      const parentId = parent.data.id;
      siblingCount.set(parentId, (siblingCount.get(parentId) ?? 0) + 1);
    }
    // A node "lives on a branch" if its parent has more than one child.
    const isOnBranch = (node: d3.HierarchyPointNode<TreeDatum>) => {
      const parent = node.parent;
      if (!parent) return false;
      return (siblingCount.get(parent.data.id) ?? 0) > 1;
    };

    // A node is "connected" when it has an incoming edge in the current tree.
    // Roots (no parent) and explicitly disconnected nodes both fall into "not connected".
    const hasIncomingEdge = (node: d3.HierarchyPointNode<TreeDatum>) =>
      node.depth > 0 && node.parent !== null;

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

    // Edge group: contains both the edge path and the disconnect "x".
    // Hovering the group (not the whole viewport) toggles the x visibility,
    // so the map stays clean with many edges.
    const edgeLinks = root.links().filter((l) => l.source.depth > 0) as d3.HierarchyPointLink<TreeDatum>[];

    const edgeGroup = g
      .selectAll('g.im-edge-group')
      .data(edgeLinks)
      .enter()
      .append('g')
      .attr('class', 'im-edge-group');

    // Edge path (inside the group)
    edgeGroup
      .append('path')
      .attr('class', 'im-edge')
      .attr('d', linkGenerator)
      .attr('fill', 'none')
      .attr('stroke', EDGE_COLOR)
      .attr('stroke-width', EDGE_STROKE_WIDTH);

    // Disconnect "x" (inside the same group)
    edgeGroup
      .append('g')
      .attr('class', 'im-disconnect')
      .attr('transform', (l) => {
        const sx = (l.source.y ?? 0) - minY + NODE_WIDTH;
        const sy = (l.source.x ?? 0) - minX + NODE_HEIGHT / 2;
        const tx = (l.target.y ?? 0) - minY;
        const ty = (l.target.x ?? 0) - minX + NODE_HEIGHT / 2;
        return `translate(${(sx + tx) / 2}, ${(sy + ty) / 2})`;
      })
      .style('cursor', 'pointer')
      .on('click', function (event: MouseEvent, l) {
        event.stopPropagation();
        const patch = { parentOverride: null, parentDisconnected: true };
        patchNodeMetadata(l.target.data.id, patch);
        const sessionId = tree?.sessionId;
        if (sessionId) void setNodeMetadata(sessionId, l.target.data.id, patch);
      })
      .each(function () {
        const sel = d3.select(this);
        sel
          .append('circle')
          .attr('r', 7)
          .attr('fill', 'var(--nav-color-bg)')
          .attr('stroke', 'var(--nav-color-node-border)')
          .attr('stroke-width', 1);
        const s = 3;
        sel
          .append('line')
          .attr('x1', -s).attr('y1', -s).attr('x2', s).attr('y2', s)
          .attr('stroke', 'var(--nav-color-text)')
          .attr('stroke-width', 1.2)
          .attr('stroke-linecap', 'round');
        sel
          .append('line')
          .attr('x1', -s).attr('y1', s).attr('x2', s).attr('y2', -s)
          .attr('stroke', 'var(--nav-color-text)')
          .attr('stroke-width', 1.2)
          .attr('stroke-linecap', 'round');
      });

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

    

    // Left handle (incoming edge target)
    // Connected node: "x" control, click to disconect the incoming edge
    // Unconnected node: dot, drag to rewire (connect to a parent).
    nodeGroup
      .append('circle')
      .attr('class', 'im-handle im-handle-left')
      .attr('cx', 0)
      .attr('cy', NODE_HEIGHT / 2)
      .attr('r', HANDLE_RADIUS)
      .on('pointerdown', function (event: PointerEvent, d) {
        event.stopPropagation();
        event.preventDefault();

        const srcX = (d.y ?? 0) - minY;
        const srcY = (d.x ?? 0) - minX + NODE_HEIGHT / 2;

        const previewPath = previewLayer
          .append('path')
          .attr('class', 'im-preview-edge');

        (event.target as Element).setPointerCapture?.(event.pointerId);

        function pointToLocal(clientX: number, clientY: number) {
          if (!svgRef.current) return { x: 0, y: 0 };
          const pt = svgRef.current.createSVGPoint();
          pt.x = clientX;
          pt.y = clientY;
          const ctm = (g.node() as SVGGraphicsElement).getScreenCTM();
          if (!ctm) return { x: 0, y: 0 };
          const local = pt.matrixTransform(ctm.inverse());
          return { x: local.x, y: local.y };
        }

        let snappedTargetId: string | null = null;

        const clearHighlight = (id: string | null) => {
          if (id === null) return;
          g.selectAll<SVGCircleElement, d3.HierarchyPointNode<TreeDatum>>('.im-handle-right')
            .filter((nd) => nd.data.id === id)
            .classed('is-snap-target', false);
        };

        const applyHighlight = (id: string) => {
          g.selectAll<SVGCircleElement, d3.HierarchyPointNode<TreeDatum>>('.im-handle-right')
            .filter((nd) => nd.data.id === id)
            .classed('is-snap-target',true);
        };

        const onPointerMove = (moveEvent: PointerEvent) => {
          const { x, y } = pointToLocal(moveEvent.clientX, moveEvent.clientY);

          let bestId: string | null = null;
          let bestDist = SNAP_RADIUS;
          for (const t of dropTargets) {
            if (t.id === d.data.id) continue;
            if (wouldCreateCycle(d.data.id, t.id, tree!.nodes, sessionMetadata)) continue;
            const dx = t.x - x;
            const dy = t.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
              bestDist = dist;
              bestId = t.id;
            }
          }

          if (bestId !== null) {
            const target = dropTargets.find((t) => t.id === bestId)!;
            previewPath.attr('d', bezier(srcX, srcY, target.x, target.y));
          } else {
            previewPath.attr('d', bezier(srcX, srcY, x, y));
          }

          if (bestId !== snappedTargetId) {
            clearHighlight(snappedTargetId);
            if (bestId !== null) applyHighlight(bestId);
            snappedTargetId = bestId;
          }
        };

        const onPointerUp = () => {
          previewPath.remove();
          clearHighlight(snappedTargetId);
          if (snappedTargetId !== null) {
            const patch = { parentOverride: snappedTargetId, parentDisconnected: false };
            patchNodeMetadata(d.data.id, patch);
            const sessionId = tree?.sessionId;
            if (sessionId) void setNodeMetadata(sessionId, d.data.id, patch);
          }
          // Dropping in empty space simply cancels the gesture — never a disconnect.
          snappedTargetId = null;
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });

    // Right handle (outgoing edge source)
    nodeGroup
      .append('circle')
      .attr('class', 'im-handle im-handle-right')
      .attr('cx', NODE_WIDTH)
      .attr('cy', NODE_HEIGHT / 2)
      .attr('r', HANDLE_RADIUS)
    
    const branchNodes = nodeGroup.filter((d) => isOnBranch(d));
    // Branch label — sticky-style tag, only shown for nodes that live on a
    // branch point AND have a saved name. The "+ label" affordance and inline
    // editing are added in the next step.
    branchNodes
      .filter((d) => isOnBranch(d) && !!sessionMetadata[d.data.id]?.branchName)
      .append('g')
      .attr('class', 'im-branch-label')
      .attr('transform', `translate(30, -6)`) // Above-left of the node.
      .each(function (d) {
        const name = sessionMetadata[d.data.id]!.branchName!;
        const isEditing = editingLabelId === d.data.id;
        const sel = d3.select(this);

        // Measure text later — use fixed padding for now.
        const paddingX = 8;
        const paddingY = 3;
        const fontSize = 10;
        const height = fontSize + paddingY * 2;

        if (isEditing) {
          // Editing mode: foreignObject with an HTML <input>.
          const width = Math.max(80, name.length * 6 + paddingX * 2);
          let savedByKeydown = false;

          const fo = sel
            .append('foreignObject')
            .attr('x', -width / 2)
            .attr('y', -height)
            .attr('width', width)
            .attr('height', height);

          fo.append('xhtml:input' as never)
            .attr('type', 'text')
            .attr('value', name)
            .attr('class', 'im-branch-input')
            .on('click', function (event: Event) {
              event.stopPropagation();
            })
            .on('keydown', function (this: HTMLInputElement, event: KeyboardEvent) {
              event.stopPropagation();
              if (event.key === 'Enter') {
                savedByKeydown = true;
                const val = this.value.trim();
                const patch = { branchName: val || null };
                patchNodeMetadata(d.data.id, patch);
                const sessionId = tree?.sessionId;
                if (sessionId) void setNodeMetadata(sessionId, d.data.id, patch);
                setEditingLabelId(null);
              }
            })
            .on('blur', function (this: HTMLInputElement) {
              if (savedByKeydown) return;
              const val = this.value.trim();
              const patch = { branchName: val || null };
              patchNodeMetadata(d.data.id, patch);
              const sessionId = tree?.sessionId;
              if (sessionId) void setNodeMetadata(sessionId, d.data.id, patch);
              setEditingLabelId(null);
            })
            .each(function (this: HTMLInputElement) {
              setTimeout(() => {
                this.focus();
                this.select();
              }, 0);
            });
        } else {
          // Display mode: click to enter editing mode.
          const approxWidth = name.length * 6 + paddingX * 2;

          sel
            .append('rect')
            .attr('x', -approxWidth / 2)
            .attr('y', -height)
            .attr('width', approxWidth)
            .attr('height', height)
            .attr('rx', 4)
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              setEditingLabelId(d.data.id);
            });

          sel
            .append('text')
            .attr('x', -approxWidth / 2 + paddingX)
            .attr('y', -paddingY - 1)
            .attr('dominant-baseline', 'alphabetic')
            .text(name);
        }
      });

    // "+ label" affordance — hover-only, only on branch nodes without a name.
    // Clicking it saves a default name and immediately enters editing mode.
    branchNodes
      .filter((d) => !sessionMetadata[d.data.id]?.branchName)
      .append('g')
      .attr('class', 'im-branch-add')
      .attr('transform', `translate(30, -6)`)
      .on('click', function (event, d) {
        event.stopPropagation();
        const patch = { branchName: 'branch' };
        patchNodeMetadata(d.data.id, patch);
        const sessionId = tree?.sessionId;
        if (sessionId) void setNodeMetadata(sessionId, d.data.id, patch);
        setEditingLabelId(d.data.id);
      })
      .each(function () {
        const sel = d3.select(this);
        const label = '+ label';
        const paddingX = 6;
        const paddingY = 3;
        const fontSize = 10;
        const approxWidth = label.length * 5.5 + paddingX * 2;
        const height = fontSize + paddingY * 2;

        sel.append('rect')
          .attr('x', -approxWidth / 2)
          .attr('y', -height)
          .attr('width', approxWidth)
          .attr('height', height)
          .attr('rx', 4)
          .attr('fill', 'var(--nav-color-bg)')
          .attr('stroke', 'var(--nav-color-node-border)')
          .attr('stroke-width', 0.5)
          .attr('stroke-dasharray', '3 2');

        sel.append('text')
          .attr('x', -approxWidth / 2 + paddingX)
          .attr('y', -paddingY - 1)
          .attr('font-family', 'var(--nav-font-family)')
          .attr('font-size', `${fontSize}px`)
          .attr('fill', 'var(--nav-color-text-muted)')
          .attr('dominant-baseline', 'alphabetic')
          .text(label);
      });
  }, [tree, sessionMetadata, editingLabelId]);

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