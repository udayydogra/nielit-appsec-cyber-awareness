import { useState } from 'react';
import { Globe, KeyRound, Check } from 'lucide-react';
import { api, type AuthedUser, type Locale } from '../api/client';
import { useLang } from '../i18n';

// User-managed settings: language preference (persisted to the profile) and a
// password change. Account identity/roles are shown read-only.
export function Settings({ user, onUser }: { user: AuthedUser; onUser: (u: AuthedUser) => void }) {
  const { locale, setLocale } = useLang();

  async function chooseLocale(l: Locale) {
    setLocale(l);
    try { await api.updateProfile({ locale: l }); onUser({ ...user, locale: l }); } catch { /* keep UI choice */ }
  }

  return (
    <div>
      <h1 style={{ fontSize: 34, margin: '0 0 18px' }}>Settings</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}><Globe size={17} style={{ verticalAlign: '-3px' }} /> Language</h2>
        <p className="muted" style={{ marginTop: 0 }}>Your preferred language for the platform. Saved to your profile.</p>
        <div className="row">
          <button className={locale === 'en' ? 'good' : ''} onClick={() => chooseLocale('en')}>English {locale === 'en' && <Check size={13} style={{ verticalAlign: '-2px' }} />}</button>
          <button className={locale === 'hi' ? 'good' : ''} onClick={() => chooseLocale('hi')}>हिन्दी {locale === 'hi' && <Check size={13} style={{ verticalAlign: '-2px' }} />}</button>
        </div>
      </div>

      <PasswordCard />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Account</h2>
        <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div><div className="muted" style={{ fontSize: 11 }}>Email</div><div>{user.email}</div></div>
          <div><div className="muted" style={{ fontSize: 11 }}>Roles</div><div>{user.roles.map((r) => <span key={r} className="chip" style={{ marginRight: 4 }}>{r}</span>)}</div></div>
        </div>
      </div>
    </div>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function change() {
    setMsg(null);
    if (next.length < 8) return setMsg({ text: 'New password must be at least 8 characters', ok: false });
    if (next !== confirm) return setMsg({ text: 'Passwords do not match', ok: false });
    try {
      await api.changePassword(cur, next);
      setMsg({ text: 'Password changed', ok: true });
      setCur(''); setNext(''); setConfirm('');
    } catch (e) { setMsg({ text: (e as Error).message, ok: false }); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}><KeyRound size={17} style={{ verticalAlign: '-3px' }} /> Change password</h2>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 640 }}>
        <div><label className="muted" style={{ fontSize: 11 }}>Current</label><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div><label className="muted" style={{ fontSize: 11 }}>New</label><input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <div><label className="muted" style={{ fontSize: 11 }}>Confirm</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="good" onClick={change} disabled={!cur || !next}>Update password</button>
        {msg && <span className={msg.ok ? 'result-good' : 'result-bad'} style={{ margin: 0, padding: '4px 10px' }}>{msg.text}</span>}
      </div>
    </div>
  );
}
