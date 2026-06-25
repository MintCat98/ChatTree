import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { usePanelStore } from '../store/panel-store';
import { scrollToNode } from '../../scroll-navigator';
import { truncate } from './constants';

export function SearchPanel() {
  const tree = usePanelStore((s) => s.tree);
  const searchQuery = usePanelStore((s) => s.searchQuery);
  const setSearchQuery = usePanelStore((s) => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const nodes = tree?.nodes ?? [];
  const q = searchQuery.toLowerCase().trim();
  const matches = q ? nodes.filter((n) => n.text.toLowerCase().includes(q)) : [];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === 'Escape') setSearchQuery('');
    },
    [setSearchQuery],
  );

  const handleClear = useCallback(() => {
    setSearchQuery('');
    inputRef.current?.focus();
  }, [setSearchQuery]);

  return (
    <div className="nav-search-panel">
      <div className="nav-search-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="nav-search-input"
          placeholder="메시지 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="메시지 검색"
        />
        {searchQuery && (
          <button
            type="button"
            className="nav-search-clear"
            aria-label="검색 초기화"
            onClick={handleClear}
          >
            ✕
          </button>
        )}
      </div>

      {q && (
        <div className="nav-search-results">
          <div className="nav-search-count">
            {matches.length > 0 ? `${matches.length}개 결과` : '일치하는 메시지가 없습니다.'}
          </div>
          {matches.map((node) => (
            <button
              key={node.id}
              type="button"
              className="nav-search-result"
              onClick={() => scrollToNode(node.id)}
            >
              <span className="nav-search-result-num">{node.index + 1}</span>
              <span className="nav-search-result-text">{truncate(node.text, 36)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
