// Dashed lane peeling off a branch-point node.
// Visually hints that other branches exist; the content of those branches
// is unknown to us because only the active branch's nodes are in the DOM.

interface BranchLaneProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function BranchLane({ startX, startY, endX, endY }: BranchLaneProps) {
  // Cubic bezier — leaves the main lane vertically, ends along the offset direction.
  const cx1 = startX;
  const cy1 = (startY + endY) / 2;
  const cx2 = endX;
  const cy2 = cy1;

  const path = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--nav-color-node-inactive)"
      strokeWidth={1.5}
      strokeDasharray="4 4"
      strokeLinecap="round"
      opacity={0.7}
    />
  );
}
