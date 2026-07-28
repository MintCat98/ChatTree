// Hover-only "−" control that collapses a node into the spine (issue #167).
// Anchored to the node itself; the matching "+ n" expand control is anchored to
// the gap between rows, so the two never share a spot on the spine.

import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { Minus } from 'lucide-react';
import { useMessages } from '../i18n';

interface HideButtonProps {
  x: number;
  cy: number;
  onHide: (e: MouseEvent<HTMLButtonElement>) => void;
}

const SIZE = 16;

export function HideButton({ x, cy, onHide }: HideButtonProps) {
  const t = useMessages();
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.currentTarget.click();
      }
    },
    [],
  );

  return (
    <foreignObject x={x} y={cy - SIZE / 2} width={SIZE} height={SIZE} className="nav-node-hide">
      <button
        type="button"
        aria-label={t.hideNode}
        onClick={onHide}
        onKeyDown={handleKeyDown}
        className="nav-hide-btn"
      >
        <Minus size={12} />
      </button>
    </foreignObject>
  );
}
