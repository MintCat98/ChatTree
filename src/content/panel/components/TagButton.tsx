import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { Tag } from 'lucide-react';

interface TagButtonProps {
  x: number;
  cy: number;
  hasTags: boolean;
  isOpen: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}

const SIZE = 16;

export function TagButton({ x, cy, hasTags, isOpen, onClick }: TagButtonProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.currentTarget.click();
      }
    },
    [],
  );

  const foClass = [
    'nav-node-tag',
    hasTags ? 'has-tags' : '',
    isOpen  ? 'is-open'  : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <foreignObject
      x={x}
      y={cy - SIZE / 2}
      width={SIZE}
      height={SIZE}
      className={foClass}
    >
      <button
        type="button"
        aria-label={hasTags ? '태그 편집' : '태그 추가'}
        aria-pressed={isOpen}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="nav-tag-btn"
      >
        <Tag size={12} />
      </button>
    </foreignObject>
  );
}
