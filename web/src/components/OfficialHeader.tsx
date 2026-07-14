import { useEffect, useState } from 'react';
import { Sun, Moon, AArrowDown, AArrowUp, ALargeSmall } from 'lucide-react';
import { useLang, useT } from '../i18n';

// MeitY / NIELIT official government portal header — utility bar (accessibility,
// language, theme) + a branding row, ported from the reference app.
export function OfficialHeader() {
  const { locale, setLocale } = useLang();
  const t = useT();
  const [dark, setDark] = useState(false);
  const [scale, setScale] = useState(100);

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  useEffect(() => { document.documentElement.style.fontSize = `${scale}%`; }, [scale]);

  return (
    <div className="official">
      <div className="util">
        <div className="row" style={{ gap: 12 }}>
          <a href="#main" style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)' }}>Skip to main content</a>
          <div className="row" style={{ gap: 2 }}>
            <button className="icon-btn" title="Decrease text size" onClick={() => setScale((s) => Math.max(80, s - 10))}><AArrowDown size={15} /></button>
            <button className="icon-btn" title="Reset text size" onClick={() => setScale(100)}><ALargeSmall size={15} /></button>
            <button className="icon-btn" title="Increase text size" onClick={() => setScale((s) => Math.min(140, s + 10))}><AArrowUp size={15} /></button>
          </div>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div className="lang-toggle row" style={{ gap: 4 }}>
            <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>English</button>
            <button className={locale === 'hi' ? 'active' : ''} onClick={() => setLocale('hi')}>हिंदी</button>
          </div>
        </div>
        <button className="icon-btn" style={{ display: 'flex', gap: 6, alignItems: 'center', width: 'auto', padding: '6px 10px' }} onClick={() => setDark((d) => !d)}>
          {dark ? <Moon size={15} color="#60a5fa" /> : <Sun size={15} color="#f59e0b" />}
          <span style={{ fontSize: 11, fontWeight: 700 }}>{dark ? 'Dark' : 'Light'}</span>
        </button>
      </div>
      <div className="brandrow">
        <div className="brand-lockup">
          <img src="/brand/emblem.svg" alt="National Emblem of India" style={{ height: 42, width: 'auto' }} />
          <div style={{ width: 1, height: 34, background: '#e2e8f0' }} />
          <img src="/brand/nielit-logo.png" alt="NIELIT" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div style={{ marginLeft: 2 }}>
          <div style={{ fontFamily: 'var(--cond)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.03em', fontSize: 16, lineHeight: 1.1 }}>
            {locale === 'hi' ? 'साइबर सुरक्षा प्रशिक्षण' : 'Cyber Security Training'}
          </div>
          <div className="muted" style={{ fontSize: 11, letterSpacing: '.03em' }}>
            National Institute of Electronics &amp; IT · MeitY, Govt. of India
          </div>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="lg-only" style={{ textAlign: 'right', lineHeight: 1.15 }}>
          <div style={{ fontFamily: 'var(--cond)', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--accent)' }}>AppSec Academy</div>
          <div className="muted" style={{ fontSize: 10, letterSpacing: '.06em' }}>{t('appTitle')}</div>
        </div>
      </div>
    </div>
  );
}
