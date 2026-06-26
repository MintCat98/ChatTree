import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { Bookmark } from 'lucide-react';
import { useMessages } from '../i18n';

interface BookmarkButtonProps {
  x: number;
  cy: number;
  isBookmarked: boolean;
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void;
}

const SIZE = 16;

export function BookmarkButton({ x, cy, isBookmarked, onToggle }: BookmarkButtonProps) {
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
    <foreignObject
      x={x}
      y={cy - SIZE / 2}
      width={SIZE}
      height={SIZE}
      className={['nav-node-bookmark', isBookmarked ? 'is-bookmarked' : ''].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? t.removeBookmark : t.addBookmark}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className="nav-bookmark-btn"
      >
        <Bookmark size={12} />
      </button>
    </foreignObject>
  );
}
