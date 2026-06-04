// Fallback shown when store.tree is null or contains no nodes.

export function EmptyState() {
  return (
    <div data-testid="empty-state" className="nav-empty-state">
      <div className="nav-empty-icon">
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 4.2c0-.66.54-1.2 1.2-1.2h7.6c.66 0 1.2.54 1.2 1.2v5.1c0 .66-.54 1.2-1.2 1.2H7l-3 2.5v-2.5c-.66 0-1.2-.54-1.2-1.2V4.2Z"
            stroke="var(--nav-color-accent)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      대화를 시작하면
      <br />
      여기에 트리가 나타납니다.
    </div>
  );
}
