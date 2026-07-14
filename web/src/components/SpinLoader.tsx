export function SpinLoader({ label }: { label?: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 14, padding: 40 }}>
      <div className="spinloader" />
      {label && <p className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase' }}>{label}</p>}
    </div>
  );
}
