import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { usePanelStore } from '../store/panel-store';
import { useMessages } from '../i18n';
import { scrollToNode } from '../../scroll-navigator';
import { truncate } from './constants';

export function SearchPanel() {
  const t = useMessages();
  const tree = usePanelStore((s) => s.tree);
  const searchQuery = usePanelStore((s) => s.searchQuery);
  const setSearchQuery = usePanelStore((s) => s.setSearchQuery);
  const sessionMetadata = usePanelStore((s) => s.sessionMetadata);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Hidden nodes (issue #167) stay out of the results — hiding wins over every
  // view filter, so a match never drags a collapsed node back into sight.
  const nodes = (tree?.nodes ?? []).filter((n) => !sessionMetadata[n.id]?.hidden);
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
          placeholder={t.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={t.searchAria}
        />
        {searchQuery && (
          <button
            type="button"
            className="nav-search-clear"
            aria-label={t.searchClear}
            onClick={handleClear}
          >
            ✕
          </button>
        )}
      </div>

      {q && (
        <div className="nav-search-results">
          <div className="nav-search-count">
            {matches.length > 0 ? t.searchResultCount(matches.length) : t.searchNoResults}
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
