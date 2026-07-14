import { useEffect, useState } from 'react';
import { Sun, Moon, AArrowDown, AArrowUp, ALargeSmall, ShieldCheck } from 'lucide-react';
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
        <div className="tricolor" />
        <div style={{ display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))', color: '#fff', width: 40, height: 40, borderRadius: 12 }}>
          <ShieldCheck size={22} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--cond)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.03em', fontSize: 18, lineHeight: 1 }}>
            {t('appTitle')}
          </div>
          <div className="muted" style={{ fontSize: 11, letterSpacing: '.04em' }}>
            NIELIT · Ministry of Electronics & IT · {locale === 'hi' ? 'साइबर सुरक्षा प्रशिक्षण' : 'Cyber Security Training'}
          </div>
        </div>
      </div>
    </div>
  );
}
