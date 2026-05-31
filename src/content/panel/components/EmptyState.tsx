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
        padding: '32px 24px',
        color: 'var(--nav-color-text-muted)',
        fontFamily: 'var(--nav-font-family)',
        fontSize: 'var(--nav-font-size-sm)',
        textAlign: 'center',
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
      Start chatting and the
      <br />
      tree will appear here.
    </div>
  );
}
