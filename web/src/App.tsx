import { useEffect, useMemo, useState } from 'react';
import { api, type AuthedUser, type CatalogueEntry, type Locale } from './api/client';
import { L, LanguageContext, useLang, useT, UI } from './i18n';
import { Login } from './components/Login';
import { MentorWidget } from './components/MentorWidget';
import { AppSecLab } from './labs/AppSecLab';
import { ScenarioEngine } from './engine/ScenarioEngine';

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.me().then((u) => { setUser(u); setLocale(u.locale); }).catch(() => {}).finally(() => setReady(true));
  }, []);

  const ctx = useMemo(() => ({ locale, setLocale }), [locale]);

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={ctx}>
      {user ? <Shell user={user} onLogout={() => setUser(null)} /> : <Login onLogin={(u) => { setUser(u); setLocale(u.locale); }} />}
    </LanguageContext.Provider>
  );
}

function Shell({ user, onLogout }: { user: AuthedUser; onLogout: () => void }) {
  const { locale, setLocale } = useLang();
  const t = useT();
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [active, setActive] = useState<CatalogueEntry | null>(null);

  useEffect(() => { api.catalogue().then(setCatalogue).catch(() => {}); }, []);

  const appsec = catalogue.filter((c) => c.module === 'appsec');
  const awareness = catalogue.filter((c) => c.module === 'awareness');

  async function logout() { await api.logout().catch(() => {}); onLogout(); }

  return (
    <div style={{ height: '100%' }}>
      <div className="topbar">
        <span className="brand">🛡 {t('appTitle')}</span>
        <span className="chip">{user.displayName} · {user.roles.join(', ')}</span>
        <span className="spacer" />
        <div className="lang-toggle row">
          <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
          <button className={locale === 'hi' ? 'active' : ''} onClick={() => setLocale('hi')}>हिं</button>
        </div>
        <button onClick={logout}>{t('logout')}</button>
      </div>

      <div className="layout">
        <div className="sidebar">
          <h4>{t('appsec')}</h4>
          {appsec.map((c) => <NavItem key={c.id} c={c} active={active?.id === c.id} onClick={() => setActive(c)} />)}
          <h4>{t('awareness')}</h4>
          {awareness.map((c) => <NavItem key={c.id} c={c} active={active?.id === c.id} onClick={() => setActive(c)} />)}
        </div>

        <div className="content">
          {!active && <Welcome catalogue={catalogue} onPick={setActive} />}
          {active?.module === 'appsec' && <AppSecLab key={active.id} labId={active.id} />}
          {active?.module === 'awareness' && <ScenarioEngine key={active.id} labId={active.id} />}
        </div>
      </div>

      <MentorWidget labId={active?.id ?? null} />
    </div>
  );
}

function NavItem({ c, active, onClick }: { c: CatalogueEntry; active: boolean; onClick: () => void }) {
  const { locale } = useLang();
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="t">{L(c.title, locale)}</span>
      <span className="meta">Tier {c.executionTier} · {c.category}</span>
    </button>
  );
}

function Welcome({ catalogue, onPick }: { catalogue: CatalogueEntry[]; onPick: (c: CatalogueEntry) => void }) {
  const { locale } = useLang();
  return (
    <div>
      <div className="card">
        <h2>{L(UI.appTitle, locale)}</h2>
        <p className="muted">
          {locale === 'hi'
            ? 'एक लैब चुनें। AppSec लैब्स असली शोषण चलाती हैं; जागरूकता लैब्स ब्रांचिंग परिदृश्य हैं।'
            : 'Pick a lab. AppSec labs run real exploits against a shared target; awareness labs are branching fraud scenarios. All bilingual, all server-scored.'}
        </p>
      </div>
      <div className="grid">
        {catalogue.map((c) => (
          <button key={c.id} className="card" style={{ textAlign: 'left' }} onClick={() => onPick(c)}>
            <div className="row"><strong>{L(c.title, locale)}</strong><span className="tier-badge">T{c.executionTier}</span></div>
            <p className="muted" style={{ fontSize: 13 }}>{L(c.summary, locale)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
