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
        padding: '36px 24px',
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
          width: 48,
          height: 48,
          marginBottom: 12,
          borderRadius: '50%',
          fontSize: 24,
          background:
            'radial-gradient(circle at 50% 40%, rgba(139,124,246,0.25) 0%, rgba(139,124,246,0) 70%)',
        }}
      >
        💬
      </div>
      Start chatting and the
      <br />
      tree will appear here.
    </div>
  );
}
