// Fallback shown when store.tree is null or contains no nodes.

export function EmptyState() {
  return (
    <div
      data-testid="empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        color: 'var(--nav-color-text-muted)',
        fontFamily: 'var(--nav-font-family)',
        fontSize: 'var(--nav-font-size-sm)',
        textAlign: 'center',
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          marginBottom: 12,
          borderRadius: 12,
          background: 'var(--nav-color-accent-soft)',
        }}
      >
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
