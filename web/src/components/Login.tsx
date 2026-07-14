import { useState } from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';
import { api, type AuthedUser } from '../api/client';
import { useT } from '../i18n';

export function Login({ onLogin }: { onLogin: (u: AuthedUser) => void }) {
  const t = useT();
  const [email, setEmail] = useState('student@nielit.test');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { onLogin(await api.login(email, password)); }
    catch { setError('Invalid credentials'); }
    finally { setBusy(false); }
  }

  return (
    <div className="center-screen" style={{ background: 'radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, hsl(var(--primary)) 14%, transparent), transparent)' }}>
      <form className="card login-card" onSubmit={submit} style={{ padding: '32px 30px' }}>
        <div className="row" style={{ gap: 12, marginBottom: 6 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'hsl(var(--primary))', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>{t('appTitle')}</h1>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>NIELIT · MeitY · AppSec + Cyber-Awareness</p>
          </div>
        </div>
        <div style={{ height: 14 }} />
        <label className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>{t('email')}</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" style={{ marginTop: 4 }} />
        <div style={{ height: 12 }} />
        <label className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>{t('password')}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" style={{ marginTop: 4 }} />
        {error && <p className="result-bad" style={{ marginBottom: 0 }}>{error}</p>}
        <div style={{ height: 16 }} />
        <button className="primary" disabled={busy} style={{ width: '100%', padding: '12px' }}>
          <LogIn size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />{t('login')}
        </button>
        <p className="muted" style={{ fontSize: 11, marginBottom: 0, marginTop: 12 }}>
          {t('seedLogins')}: student@ · instructor@ · admin@nielit.test
        </p>
      </form>
    </div>
  );
}
