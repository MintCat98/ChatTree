import { usePanelStore } from '../store/panel-store';
import { useMessages } from '../i18n';

export function TagPanel() {
  const t = useMessages();
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
        <p className="nav-tag-panel-empty">{t.tagPanelEmpty}</p>
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
          aria-label={t.clearTagFilterAria}
          onClick={clearTagFilters}
          className="nav-tag-panel-clear"
        >
          {t.clearTagFilter}
        </button>
      )}
    </div>
  );
}
