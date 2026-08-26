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
import { useMessages } from '../i18n';
import { scrollToNode } from '../../scroll-navigator';
import { nodeLabel } from './node-label';
import { pickParent, wouldCreateCycle } from './parent-resolver';
import { setNodeMetadata } from '@shared/metadata-storage';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;
const H_GAP = 60;       // extra horizontal spacing between depth levels
const V_GAP = 12;       // extra vertical spacing betwen siblings
const PADDING = 16;

// Zoom-related constants
const ZOOM_LADDER = [25, 50, 75, 100, 125, 150, 200];
const ZOOM_MIN = ZOOM_LADDER[0] / 100;
const ZOOM_MAX = ZOOM_LADDER[ZOOM_LADDER.length - 1] / 100;
const ZOOM_FINE_STEP = 0.05;

const HANDLE_RADIUS = 5;
const SNAP_RADIUS = 30;

// Summary dropdown (issue #165). Wider than the node box — the Q&A text needs
// the room the keyword does not. Height is measured from the content and capped
// here, with the panel scrolling internally past the cap.
const SUMMARY_TOGGLE_RADIUS = 7;
const SUMMARY_PANEL_WIDTH = 240;
const SUMMARY_PANEL_MAX_HEIGHT = 180;
const SUMMARY_PANEL_GAP = 10; // clears the toggle, which straddles the box edge

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
  const t = useMessages();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tree = usePanelStore((s) => s.tree);
  const sessionMetadata = usePanelStore((s) => s.sessionMetadata);
  const sessionSummaries = usePanelStore((s) => s.sessionSummaries);
  const patchNodeMetadata = usePanelStore((s) => s.patchNodeMetadata);

  // Zoom behavior state
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const isSpacePressedRef = useRef(false);
  const isPointerInsideRef = useRef(false);
  // Track window listeners registered during an active drag so the effect
  // cleanup can detach them if the component unmounts mid-drag.
  const dragListenersRef = useRef<{
    move: ((e: PointerEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  const [zoomPercent, setZoomPercent] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  // Summary dropdown (#165) — one open at a time. Clicking the same toggle
  // closes it, clicking another node's switches.
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);

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
          // .im-summary-fo is not inside g.im-node — it lives in the overlay
          // position so it can paint over neighbours — so it needs its own
          // exclusion, or selecting text in an open panel pans the map (and
          // double-clicking a word zooms it).
          return (
            !target.closest('g.im-node') &&
            !target.closest('.im-handle') &&
            !target.closest('.im-summary-fo')
          );
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
          .attr('r', 7);
        const s = 3;
        sel
          .append('line')
          .attr('x1', -s).attr('y1', -s).attr('x2', s).attr('y2', s);
        sel
          .append('line')
          .attr('x1', -s).attr('y1', s).attr('x2', s).attr('y2', -s);
      });

    const nodeGroup = g
      .selectAll<SVGGElement, d3.HierarchyPointNode<TreeDatum>>('g.im-node')
      .data(drawable as d3.HierarchyPointNode<TreeDatum>[])
      .enter()
      .append('g')
      .attr('class', 'im-node')
      .attr('transform', (d) => `translate(${(d.y ?? 0) - minY}, ${(d.x ?? 0) - minX})`)
      .on('click', (_event, d) => scrollToNode(d.data.id));

    nodeGroup
      .append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 8);

    nodeGroup
      .append('text')
      .attr('x', NODE_WIDTH / 2)
      .attr('y', NODE_HEIGHT / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .text((d) => nodeLabel(d.data.text, sessionSummaries[d.data.id]));

    // Summary dropdown toggle (issue #165) — bottom-center of the box, the one
    // edge midpoint nothing else claims: both rewire handles and both edge
    // endpoints sit at NODE_HEIGHT / 2. Rendered only for summarized turns, so
    // it doubles as the "this node has a summary" indicator.
    nodeGroup
      .filter((d) => Boolean(sessionSummaries[d.data.id]))
      .append('g')
      .attr('class', 'im-summary-toggle')
      .classed('is-open', (d) => expandedSummaryId === d.data.id)
      .attr('transform', `translate(${NODE_WIDTH / 2}, ${NODE_HEIGHT})`)
      .attr('role', 'button')
      .attr('aria-label', (d) =>
        expandedSummaryId === d.data.id ? t.collapseSummaryAria : t.expandSummaryAria,
      )
      .on('click', function (event: MouseEvent, d) {
        // The node body's click handler scrolls the conversation; #165 reserves
        // that for the body, so the toggle must not bubble into it.
        event.stopPropagation();
        setExpandedSummaryId((current) => (current === d.data.id ? null : d.data.id));
      })
      .each(function () {
        const sel = d3.select(this);
        sel.append('circle').attr('r', SUMMARY_TOGGLE_RADIUS);
        // Chevron points down when closed; panel.css rotates this path (not
        // the group, whose transform attribute CSS would override) when open.
        sel.append('path').attr('class', 'im-summary-chevron').attr('d', 'M-3,-1.5 L0,1.5 L3,-1.5');
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

        // Targets that would close a cycle are resolved once per gesture.
        // The layout can't change mid-drag, so this set is stable — computing
        // it here keeps pointermove O(targets) instead of O(targets × nodes).
        const forbiddenTargets = new Set(
          dropTargets
            .filter(
              (t) =>
                t.id !== d.data.id &&
                wouldCreateCycle(d.data.id, t.id, tree.nodes, sessionMetadata),
            )
            .map((t) => t.id),
        );

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
            .classed('is-snap-target', true);
        };

        const onPointerMove = (moveEvent: PointerEvent) => {
          const { x, y } = pointToLocal(moveEvent.clientX, moveEvent.clientY);

          let bestId: string | null = null;
          let bestDist = SNAP_RADIUS;
          for (const t of dropTargets) {
            if (t.id === d.data.id) continue;
            if (forbiddenTargets.has(t.id)) continue;
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
          dragListenersRef.current = { move: null, up: null };
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        dragListenersRef.current = { move: onPointerMove, up: onPointerUp };
      });

    // Right handle (outgoing edge source)
    nodeGroup
      .append('circle')
      .attr('class', 'im-handle im-handle-right')
      .attr('cx', NODE_WIDTH)
      .attr('cy', NODE_HEIGHT / 2)
      .attr('r', HANDLE_RADIUS);

    const branchNodes = nodeGroup.filter((d) => isOnBranch(d));
    // Branch label — sticky-style tag, only shown for nodes that live on a
    // branch point AND have a saved name. The "+ label" affordance and inline
    // editing are added in the next step.
    branchNodes
      .filter((d) => 
        isOnBranch(d) && (!!sessionMetadata[d.data.id]?.branchName || editingLabelId === d.data.id)
    )
      .append('g')
      .attr('class', 'im-branch-label')
      .attr('transform', `translate(30, -6)`) // Above-left of the node.
      .each(function (d) {
        const name = sessionMetadata[d.data.id]?.branchName ?? '';
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
                const current = sessionMetadata[d.data.id]?.branchName ?? null;
                const next = val || null;
                if (current !== next) {
                  const patch = { branchName: next };
                  patchNodeMetadata(d.data.id, patch);
                  const sessionId = tree?.sessionId;
                  if (sessionId) void setNodeMetadata(sessionId, d.data.id, patch);
                }
                setEditingLabelId(null);
              } else if (event.key === 'Escape') {
                // Cancel without saving. savedByKeydown prevents blur from
                // committing the pending value.
                savedByKeydown = true;
                setEditingLabelId(null);
              }
            })
            .on('blur', function (this: HTMLInputElement) {
              if (savedByKeydown) return;
              const val = this.value.trim();
              const current = sessionMetadata[d.data.id]?.branchName ?? null;
              const next = val || null;
              if (current !== next) {
                const patch = { branchName: next };
                patchNodeMetadata(d.data.id, patch);
                const sessionId = tree?.sessionId;
                if (sessionId) void setNodeMetadata(sessionId, d.data.id, patch);
              }
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
      .filter((d) => 
        !sessionMetadata[d.data.id]?.branchName &&
        editingLabelId !== d.data.id
      )
      .append('g')
      .attr('class', 'im-branch-add')
      .attr('transform', `translate(30, -6)`)
      .on('click', function (event, d) {
        event.stopPropagation();
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
          .attr('rx', 4);

        sel.append('text')
          .attr('x', -approxWidth / 2 + paddingX)
          .attr('y', -paddingY - 1)
          .attr('dominant-baseline', 'alphabetic')
          .text(label);
      });

    // Summary dropdown panel (issue #165). Appended last so it paints over
    // neighbouring nodes — V_GAP is only 12px, so an open panel always overlaps
    // whatever sits below it.
    //
    // Resolved against `drawable` rather than trusting the state directly: a
    // branch switch or a hidden-node change can drop the open node from the
    // tree, and this makes that close the panel instead of stranding it.
    const openNode = expandedSummaryId
      ? drawable.find((d) => d.data.id === expandedSummaryId)
      : undefined;
    const openSummary = openNode ? sessionSummaries[openNode.data.id] : undefined;

    if (openNode && openSummary) {
      const nodeX = (openNode.y ?? 0) - minY;
      const nodeY = (openNode.x ?? 0) - minX;

      // foreignObject rather than an HTML overlay: inside the zoom viewport it
      // pans and scales with the map for free, the way the branch-name input
      // above already does.
      const fo = g
        .append('foreignObject')
        .attr('class', 'im-summary-fo')
        .attr('x', nodeX - (SUMMARY_PANEL_WIDTH - NODE_WIDTH) / 2)
        .attr('y', nodeY + NODE_HEIGHT + SUMMARY_PANEL_GAP)
        .attr('width', SUMMARY_PANEL_WIDTH)
        .attr('height', SUMMARY_PANEL_MAX_HEIGHT);

      // Pan/zoom isolation is handled by the zoom filter's .im-summary-fo
      // exclusion above, not by a stopPropagation here — the panel is not a
      // descendant of g.im-node, so its clicks never reach the scroll-to
      // handler in the first place.
      const panel = fo.append('xhtml:div' as never).attr('class', 'im-summary-panel');

      const rows: Array<[string, string]> = [
        [t.summaryQuestionLabel, openSummary.question],
        [t.summaryAnswerLabel, openSummary.answer],
      ];
      for (const [label, text] of rows) {
        const row = panel.append('xhtml:div' as never).attr('class', 'im-summary-row');
        row.append('xhtml:div' as never).attr('class', 'im-summary-label').text(label);
        row.append('xhtml:div' as never).attr('class', 'im-summary-text').text(text);
      }

      // foreignObject needs an explicit height, so measure the laid-out panel
      // and shrink to it. panel.css caps it at 100% of the provisional height
      // set above, so offsetHeight is already clamped to the max and scrolls
      // internally past it — no second Math.min needed.
      //
      // offsetHeight, not getBoundingClientRect: the latter reports screen px
      // and would be wrong at any zoom level other than 100%. Not scrollHeight
      // either — that excludes the border this box actually draws.
      panel.each(function (this: HTMLDivElement) {
        fo.attr('height', this.offsetHeight);
      });
    }

      // Detach any drag listeners still attached to window on unmount /
      // before the next effect run. Guards against the component being
      // torn down mid-drag (panel close, session switch).
      return () => {
        const { move, up } = dragListenersRef.current;
        if (move) window.removeEventListener('pointermove', move);
        if (up) window.removeEventListener('pointerup', up);
        dragListenersRef.current = { move: null, up: null };
      };
  }, [tree, sessionMetadata, sessionSummaries, editingLabelId, expandedSummaryId, t]);

  // Close the summary dropdown on a conversation switch. Node IDs encode
  // absolute turn position, so "chatbox-3" exists in most conversations — the
  // open panel would otherwise reappear on an unrelated node in the next one.
  useEffect(() => {
    setExpandedSummaryId(null);
  }, [tree?.sessionId]);

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
