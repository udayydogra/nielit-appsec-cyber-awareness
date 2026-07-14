import { useEffect, useState } from 'react';
import { Sun, Moon, AArrowDown, AArrowUp, ALargeSmall, Accessibility } from 'lucide-react';

// The government-portal accessibility strip, moved to a footer that slides up when
// the user scrolls. Owns text-size + light/dark theme (the only place that does).
export function AccessibilityFooter({ show }: { show: boolean }) {
  const [dark, setDark] = useState(false);
  const [scale, setScale] = useState(100);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  useEffect(() => { document.documentElement.style.fontSize = `${scale}%`; }, [scale]);

  return (
    <footer className={`a11y-footer ${show ? 'show' : ''}`} aria-hidden={!show}>
      <div className="row" style={{ gap: 14 }}>
        <span className="row" style={{ gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted-c)' }}>
          <Accessibility size={15} /> Accessibility
        </span>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <a href="#main" style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)' }}>Skip to main content</a>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span className="muted" style={{ fontSize: 11 }}>Text size</span>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" title="Decrease" onClick={() => setScale((s) => Math.max(80, s - 10))}><AArrowDown size={15} /></button>
          <button className="icon-btn" title="Reset" onClick={() => setScale(100)}><ALargeSmall size={15} /></button>
          <button className="icon-btn" title="Increase" onClick={() => setScale((s) => Math.min(140, s + 10))}><AArrowUp size={15} /></button>
        </div>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <span className="muted" style={{ fontSize: 11 }}>NIELIT · MeitY, Govt. of India</span>
        <button className="icon-btn" style={{ width: 'auto', padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => setDark((d) => !d)}>
          {dark ? <Moon size={15} color="#60a5fa" /> : <Sun size={15} color="#f59e0b" />}
          <span style={{ fontSize: 11, fontWeight: 700 }}>{dark ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </footer>
  );
}
