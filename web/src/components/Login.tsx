import { useState } from 'react';
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
    try {
      onLogin(await api.login(email, password));
    } catch {
      setError('Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card login-card" onSubmit={submit}>
        <h2>{t('appTitle')}</h2>
        <p className="muted">AppSec labs + cyber-fraud awareness · हिंदी/English</p>
        <label className="muted">{t('email')}</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <div style={{ height: 10 }} />
        <label className="muted">{t('password')}</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p className="result-bad">{error}</p>}
        <div style={{ height: 12 }} />
        <button className="primary" disabled={busy} style={{ width: '100%' }}>{t('login')}</button>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          {t('seedLogins')}: student@ · instructor@ · admin@nielit.test
        </p>
      </form>
    </div>
  );
}
