import { usePanelStore } from '../store/panel-store';

export function TagPanel() {
  const sessionMetadata  = usePanelStore((s) => s.sessionMetadata);
  const activeTagFilters = usePanelStore((s) => s.activeTagFilters);
  const toggleTagFilter  = usePanelStore((s) => s.toggleTagFilter);
  const clearTagFilters  = usePanelStore((s) => s.clearTagFilters);

  const allTags = [...new Set(
    Object.values(sessionMetadata).flatMap((m) => m.tags),
  )].sort();

  if (allTags.length === 0) {
    return (
      <div className="nav-tag-panel">
        <p className="nav-tag-panel-empty">아직 태그가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="nav-tag-panel">
      <div className="nav-tag-panel-chips">
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTagFilters.includes(tag)}
            onClick={() => toggleTagFilter(tag)}
            className={
              activeTagFilters.includes(tag)
                ? 'nav-tag-panel-chip is-active'
                : 'nav-tag-panel-chip'
            }
          >
            {tag}
          </button>
        ))}
      </div>
      {activeTagFilters.length > 0 && (
        <button
          type="button"
          aria-label="태그 필터 초기화"
          onClick={clearTagFilters}
          className="nav-tag-panel-clear"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
