// Fallback shown when store.tree is null or contains no nodes.

import { useMessages } from '../i18n';

export function EmptyState() {
  const t = useMessages();
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
      {t.emptyLine1}
      <br />
      {t.emptyLine2}
    </div>
  );
}
