import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Terminal, ShieldAlert, Award, ShieldCheck, Bell, Menu, LogOut,
  ChevronRight, Zap, ArrowLeft, Lock, Settings, HelpCircle, Radar,
} from 'lucide-react';
import { api, type AuthedUser, type CatalogueEntry, type Locale } from './api/client';
import { L, LanguageContext, useLang, useT } from './i18n';
import { Login } from './components/Login';
import { OfficialHeader } from './components/OfficialHeader';
import { SpinLoader } from './components/SpinLoader';
import { MentorWidget } from './components/MentorWidget';
import { AppSecLab } from './labs/AppSecLab';
import { ScenarioEngine } from './engine/ScenarioEngine';

type View = 'dashboard' | 'appsec' | 'awareness' | 'profile';

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [user, setUser] = useState<AuthedUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.me().then((u) => { setUser(u); setLocale(u.locale); }).catch(() => {}).finally(() => setReady(true));
  }, []);

  const ctx = useMemo(() => ({ locale, setLocale }), [locale]);
  if (!ready) return <div className="center-screen"><SpinLoader label="Loading" /></div>;

  return (
    <LanguageContext.Provider value={ctx}>
      {user
        ? <Shell user={user} onLogout={() => setUser(null)} />
        : <Login onLogin={(u) => { setUser(u); setLocale(u.locale); }} />}
    </LanguageContext.Provider>
  );
}

function tierMeta(tier: number) {
  if (tier === 0) return { label: 'Foundation', cls: 'diff-easy' };
  if (tier === 1) return { label: 'Simulated', cls: 'diff-med' };
  if (tier === 2) return { label: 'Intermediate', cls: 'diff-med' };
  return { label: 'Advanced', cls: 'diff-hard' };
}

function Shell({ user, onLogout }: { user: AuthedUser; onLogout: () => void }) {
  const { locale, setLocale } = useLang();
  const t = useT();
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [active, setActive] = useState<CatalogueEntry | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { api.catalogue().then(setCatalogue).catch(() => {}); }, []);

  const appsec = catalogue.filter((c) => c.module === 'appsec');
  const awareness = catalogue.filter((c) => c.module === 'awareness');
  async function logout() { await api.logout().catch(() => {}); onLogout(); }
  function goto(v: View) { setView(v); setActive(null); setMenuOpen(false); }
  function open(c: CatalogueEntry) { setActive(c); setMenuOpen(false); }

  const nav: { key: View; label: string; icon: typeof LayoutDashboard; accent?: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'appsec', label: t('appsec'), icon: Terminal },
    { key: 'awareness', label: t('awareness'), icon: ShieldAlert },
    { key: 'profile', label: 'Profile', icon: Award },
  ];

  return (
    <div className="app-shell">
      <OfficialHeader />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.5)', zIndex: 30 }} />}
        <aside className="sidebar" data-open={menuOpen}>
          <div className="dots bg-dot-pattern" />
          <div className="sidebar-brand">
            <div className="logo" style={{ padding: '5px 9px' }}>
              <img src="/brand/nielit-logo.png" alt="NIELIT" style={{ height: 28, width: 'auto', display: 'block' }} />
            </div>
            <span className="name">AppSec</span>
          </div>
          <nav className="nav">
            {nav.map((n) => (
              <button key={n.key} className={`nav-item ${view === n.key && !active ? 'active' : ''}`} onClick={() => goto(n.key)}>
                <n.icon size={18} /> <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ padding: 18, borderTop: '1px solid rgba(255,255,255,.12)', position: 'relative' }}>
            <button className="nav-item" style={{ fontSize: 10 }}><Settings size={15} /> Settings</button>
            <button className="nav-item" style={{ fontSize: 10 }}><HelpCircle size={15} /> Support</button>
          </div>
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header className="topbar">
            <button className="icon-btn lg-hide" onClick={() => setMenuOpen(true)}><Menu size={18} /></button>
            <span className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radar size={16} color="var(--accent)" />
              {active ? L(active.title, locale) : nav.find((n) => n.key === view)?.label}
            </span>
            <span className="spacer" />
            <span className="chip"><Zap size={12} /> {catalogue.length} Missions</span>
            <div className="lang-toggle row" style={{ gap: 4 }}>
              <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
              <button className={locale === 'hi' ? 'active' : ''} onClick={() => setLocale('hi')}>हिं</button>
            </div>
            <button className="icon-btn" style={{ position: 'relative' }}><Bell size={17} /><span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 999, background: 'var(--bad)' }} /></button>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>
                {user.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="lg-only" style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-.01em' }}>{user.displayName}</div>
                <button onClick={logout} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--bad)', fontSize: 9, letterSpacing: '.12em' }}><LogOut size={10} style={{ verticalAlign: 'middle' }} /> Log out</button>
              </div>
            </div>
          </header>

          <main className="content" id="main">
            <div className="content-inner">
              {active ? (
                <LabView entry={active} onBack={() => setActive(null)} />
              ) : view === 'dashboard' ? (
                <Dashboard user={user} catalogue={catalogue} onOpen={open} onModule={(m) => goto(m === 'appsec' ? 'appsec' : 'awareness')} />
              ) : view === 'appsec' ? (
                <Catalogue title={t('appsec')} subtitle="On-demand vulnerable targets for hands-on offensive testing." labs={appsec} onOpen={open} />
              ) : view === 'awareness' ? (
                <Catalogue title={t('awareness')} subtitle="Branching fraud-recognition scenarios — UPI, digital arrest, phishing & more." labs={awareness} onOpen={open} />
              ) : (
                <Profile user={user} />
              )}
            </div>
          </main>
        </div>
      </div>

      <MentorWidget labId={active?.id ?? null} />
    </div>
  );
}

function LabView({ entry, onBack }: { entry: CatalogueEntry; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: 16, display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={14} /> Back to catalogue</button>
      {entry.module === 'appsec' ? <AppSecLab key={entry.id} labId={entry.id} /> : <ScenarioEngine key={entry.id} labId={entry.id} />}
    </div>
  );
}

function LabCard({ c, onOpen }: { c: CatalogueEntry; onOpen: (c: CatalogueEntry) => void }) {
  const { locale } = useLang();
  const meta = tierMeta(c.executionTier);
  const Icon = c.module === 'appsec' ? (c.executionTier === 3 ? Lock : Terminal) : ShieldAlert;
  return (
    <button className="lab-card" onClick={() => onOpen(c)}>
      <div className="row" style={{ gap: 18, flexWrap: 'nowrap' }}>
        <div className="ico"><Icon size={26} /></div>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <span className="chip">{c.category}</span>
            <span className={`${meta.cls}`} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>{meta.label}</span>
            <span className="muted" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em' }}>TIER {c.executionTier}</span>
          </div>
          <h3 style={{ margin: '4px 0 2px', fontSize: 19 }}>{L(c.title, locale)}</h3>
          <p className="muted" style={{ fontSize: 12.5, margin: 0, maxWidth: 640 }}>{L(c.summary, locale)}</p>
        </div>
      </div>
      <span className="row" style={{ gap: 6, color: 'var(--accent)', fontWeight: 800, fontSize: 10, letterSpacing: '.2em', flexWrap: 'nowrap' }}>
        {c.module === 'appsec' ? 'LAUNCH' : 'START'} <ChevronRight size={16} />
      </span>
    </button>
  );
}

function Catalogue({ title, subtitle, labs, onOpen }: { title: string; subtitle: string; labs: CatalogueEntry[]; onOpen: (c: CatalogueEntry) => void }) {
  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>{title}</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontWeight: 500 }}>{subtitle}</p>
      </div>
      {labs.length === 0 ? <SpinLoader label="Fetching lab templates" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {labs.map((c) => <LabCard key={c.id} c={c} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function StatTile({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div className="card" style={{ margin: 0, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--cond)', fontSize: 32, fontWeight: 800, color: accent }}>{value}</div>
      <div className="muted" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function Dashboard({ user, catalogue, onOpen, onModule }: {
  user: AuthedUser; catalogue: CatalogueEntry[]; onOpen: (c: CatalogueEntry) => void; onModule: (m: 'appsec' | 'awareness') => void;
}) {
  const { locale } = useLang();
  const t = useT();
  const appsec = catalogue.filter((c) => c.module === 'appsec').length;
  const awareness = catalogue.filter((c) => c.module === 'awareness').length;
  const t3 = catalogue.filter((c) => c.executionTier === 3).length;
  const featured = catalogue.filter((c) => ['sqli', 'digital-arrest', 'command-injection', 'upi-fraud'].includes(c.id));

  return (
    <div>
      <div className="card" style={{ position: 'relative', overflow: 'hidden', color: '#fff', background: 'linear-gradient(120deg, hsl(var(--primary)), #1e3a8a)', borderColor: 'transparent', padding: '30px 32px' }}>
        <div className="dots bg-dot-pattern" style={{ position: 'absolute', inset: 0, opacity: .12 }} />
        <div style={{ position: 'relative' }}>
          <span className="chip" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}><ShieldCheck size={12} /> NIELIT · Secure Skills</span>
          <h1 style={{ fontSize: 36, margin: '12px 0 4px', color: '#fff' }}>
            {locale === 'hi' ? `नमस्ते, ${user.displayName}` : `Welcome, ${user.displayName}`}
          </h1>
          <p style={{ opacity: .85, maxWidth: 620, margin: 0 }}>
            {locale === 'hi'
              ? 'एक लैब चुनें — AppSec लैब्स असली शोषण चलाती हैं, जागरूकता लैब्स ब्रांचिंग फ्रॉड परिदृश्य हैं। सब द्विभाषी, सब सर्वर-स्कोर्ड।'
              : 'Pick a mission. AppSec labs run real exploits against isolated targets; awareness labs are branching fraud scenarios. All bilingual, all server-scored.'}
          </p>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="good" onClick={() => onModule('appsec')}><Terminal size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('appsec')}</button>
            <button style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }} onClick={() => onModule('awareness')}><ShieldAlert size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('awareness')}</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 18 }}>
        <StatTile value={catalogue.length} label="Total labs" accent="var(--accent)" />
        <StatTile value={appsec} label="AppSec labs" accent="var(--good)" />
        <StatTile value={awareness} label="Awareness labs" accent="var(--warn)" />
        <StatTile value={t3} label="Live containers" accent="var(--bad)" />
      </div>

      <h2 style={{ fontSize: 20, margin: '6px 0 12px' }}>Featured missions</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {featured.map((c) => <LabCard key={c.id} c={c} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function Profile({ user }: { user: AuthedUser }) {
  return (
    <div>
      <h1 style={{ fontSize: 34, margin: '0 0 18px' }}>Profile</h1>
      <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--cond)', fontSize: 26, fontWeight: 800 }}>
          {user.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>{user.displayName}</h2>
          <p className="muted" style={{ margin: '2px 0' }}>{user.email}</p>
          <div className="row" style={{ marginTop: 6 }}>
            {user.roles.map((r) => <span key={r} className="chip">{r}</span>)}
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Certificates</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Certificates are system-issued on verified lab completion, HMAC-signed, and publicly verifiable at <code>/verify/&lt;certId&gt;</code>. Complete a lab's quiz to earn one.
        </p>
      </div>
    </div>
  );
}
