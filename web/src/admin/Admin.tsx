import { useEffect, useRef, useState } from 'react';
import { Users, Boxes, Layers, Plus, Ban, RotateCcw, Trash2, Pencil, ShieldCheck, Upload, Mail, AlertTriangle } from 'lucide-react';
import { api, type AdminUser, type AdminCohort, type ModuleRow, type AuthedUser, type Locale, type ImportSummary } from '../api/client';
import { L, useLang } from '../i18n';
import { ModuleEditor } from './ModuleEditor';

type Tab = 'users' | 'batches' | 'modules';

export function Admin({ user }: { user: AuthedUser }) {
  const can = (p: string) => (user.permissions ?? []).includes(p);
  const tabs: { key: Tab; label: string; icon: typeof Users; perm: string }[] = [
    { key: 'users', label: 'Users', icon: Users, perm: 'user:manage' },
    { key: 'batches', label: 'Batches', icon: Boxes, perm: 'cohort:assign' },
    { key: 'modules', label: 'Modules', icon: Layers, perm: 'module:edit' },
  ].filter((t) => can(t.perm)) as { key: Tab; label: string; icon: typeof Users; perm: string }[];
  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? 'users');

  return (
    <div>
      <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ShieldCheck size={26} style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontSize: 34, margin: 0 }}>Admin console</h1>
      </div>
      <p className="muted" style={{ margin: '0 0 18px' }}>Manage learners, batches, and training modules.</p>

      <div className="row" style={{ gap: 8, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        {tabs.map((tt) => (
          <button key={tt.key} className={tab === tt.key ? 'good' : ''} onClick={() => setTab(tt.key)}>
            <tt.icon size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{tt.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab me={user} />}
      {tab === 'batches' && <BatchesTab />}
      {tab === 'modules' && <ModulesTab />}
    </div>
  );
}

function Banner({ msg, kind }: { msg: string; kind: 'good' | 'bad' }) {
  if (!msg) return null;
  return <p className={kind === 'good' ? 'result-good' : 'result-bad'} style={{ marginTop: 0 }}>{msg}</p>;
}

// ─────────────────────────────── Users ──────────────────────────────────────
function UsersTab({ me }: { me: AuthedUser }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({ email: '', displayName: '', password: '', roles: ['student'] as string[] });
  const canAssign = (me.permissions ?? []).includes('role:assign');

  const load = () => api.admin.users().then(setUsers).catch((e) => setErr(e.message));
  useEffect(() => { load(); api.admin.roles().then(setRoles).catch(() => {}); }, []);

  async function create() {
    setErr(''); setOk('');
    try {
      await api.admin.createUser(form);
      setOk(`Created ${form.email}`); setForm({ email: '', displayName: '', password: '', roles: ['student'] });
      load();
    } catch (e) { setErr((e as Error).message); }
  }
  async function act(fn: Promise<unknown>, label: string) {
    setErr(''); setOk('');
    try { await fn; setOk(label); load(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}><Plus size={16} style={{ verticalAlign: '-2px' }} /> Add a user</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <input placeholder="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <input placeholder="temporary password (min 8)" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select multiple={false} value={form.roles[0]} disabled={!canAssign}
            onChange={(e) => setForm({ ...form, roles: [e.target.value] })}
            title={canAssign ? 'role' : 'role:assign required to grant non-student roles'}>
            {(canAssign ? roles : ['student']).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="good" onClick={create}>Create user</button>
        </div>
        <Banner msg={err} kind="bad" /><Banner msg={ok} kind="good" />
      </div>

      <ImportPanel onImported={load} />

      <div className="card" style={{ overflowX: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>Users ({users.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              <th style={{ padding: '8px 6px' }}>Name</th><th>Username</th><th>Email</th><th>Roles</th><th>Batches</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 6px', fontWeight: 700 }}>{u.displayName}</td>
                <td className="muted" style={{ fontSize: 12 }}>{u.username || '—'}</td>
                <td className="muted">{u.email}</td>
                <td>{u.roles.map((r) => <span key={r} className="chip" style={{ marginRight: 4 }}>{r}</span>)}</td>
                <td className="muted" style={{ fontSize: 12 }}>{u.cohorts.join(', ') || '—'}</td>
                <td>
                  <span className="chip" style={{ background: u.status === 'active' ? 'hsla(142,71%,45%,.12)' : 'hsla(0,84%,60%,.12)', color: u.status === 'active' ? 'var(--good)' : 'var(--bad)' }}>{u.status}</span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {u.id !== me.id && u.status === 'active' && (
                    <button title="deactivate" onClick={() => act(api.admin.deactivateUser(u.id), 'Deactivated')} style={{ padding: '4px 8px' }}><Ban size={13} /></button>
                  )}
                  {u.status === 'deactivated' && (
                    <>
                      <button title="reactivate" onClick={() => act(api.admin.reactivateUser(u.id), 'Reactivated')} style={{ padding: '4px 8px' }}><RotateCcw size={13} /></button>
                      <button title="delete permanently" className="bad" onClick={() => { if (confirm(`Permanently delete ${u.email}? This wipes all their data.`)) act(api.admin.deleteUser(u.id), 'Deleted'); }} style={{ padding: '4px 8px', marginLeft: 4 }}><Trash2 size={13} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Bulk import from CSV / Excel ──────────────────────────────────────────────
function ImportPanel({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [cohorts, setCohorts] = useState<AdminCohort[]>([]);
  const [cohortId, setCohortId] = useState('');   // '' = none, '__new' = create
  const [cohortName, setCohortName] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.admin.cohorts().then(setCohorts).catch(() => {});
    api.admin.mailStatus().then((s) => setMailConfigured(s.mailConfigured)).catch(() => {});
  }, []);

  async function run() {
    setErr(''); setSummary(null);
    if (!file) { setErr('Choose a .csv or .xlsx file first'); return; }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = ''; const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const contentBase64 = btoa(bin);
      const res = await api.admin.importUsers({
        filename: file.name, contentBase64, sendEmail,
        cohortId: cohortId && cohortId !== '__new' ? cohortId : undefined,
        cohortName: cohortId === '__new' ? cohortName.trim() : undefined,
      });
      setSummary(res);
      if (inputRef.current) inputRef.current.value = '';
      setFile(null);
      onImported();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}><Upload size={16} style={{ verticalAlign: '-2px' }} /> Import users from CSV / Excel</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        File columns: <b>email</b>, <b>name</b>, and a unique id (used as the login <b>username</b>). Each new user gets a
        temporary password and — if email is configured — an invitation with their credentials.
      </p>
      {mailConfigured === false && (
        <p className="result-bad" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={15} /> Email is not configured (SMTP). Users will be created and their temporary passwords shown below so you can distribute them.
        </p>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, alignItems: 'center' }}>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <select value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">— no batch —</option>
          <option value="__new">+ create a new batch…</option>
          {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {cohortId === '__new' && (
          <input placeholder="new batch name" value={cohortName} onChange={(e) => setCohortName(e.target.value)} />
        )}
        <label className="row" style={{ gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} style={{ width: 'auto' }} />
          <Mail size={14} /> Email credentials to each user
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="good" onClick={run} disabled={busy}>{busy ? 'Importing…' : 'Import'}</button>
      </div>
      <Banner msg={err} kind="bad" />

      {summary && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 8px' }}>
            <b>{summary.created}</b> created · <b>{summary.skipped}</b> skipped · <b>{summary.errored}</b> errored
            {summary.cohort && <> · added to batch <b>{summary.cohort.name}</b></>}
            {sendEmail && <> · <b>{summary.emailsSent}</b> email(s) sent</>}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px' }}>Email</th><th>Username</th><th>Result</th><th>Temp password</th>
              </tr></thead>
              <tbody>
                {summary.rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px' }}>{r.email}</td>
                    <td className="muted">{r.username}</td>
                    <td>
                      <span className="chip" style={{ color: r.status === 'created' ? 'var(--good)' : r.status === 'error' ? 'var(--bad)' : 'var(--muted)' }}>{r.status}</span>
                      {r.reason && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{r.reason}</span>}
                    </td>
                    <td className="mono" style={{ fontFamily: 'monospace' }}>{r.tempPassword ?? (r.emailed ? '✉ emailed' : '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.rows.some((r) => r.tempPassword) && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
              Temporary passwords are shown only here (not stored in plaintext). Distribute them now — they expire shortly.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Batches ────────────────────────────────────
function BatchesTab() {
  const [cohorts, setCohorts] = useState<AdminCohort[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.admin.cohorts().then(setCohorts).catch((e) => setErr(e.message));
  useEffect(() => { load(); api.admin.users().then(setUsers).catch(() => {}); }, []);

  async function act(fn: Promise<unknown>) { setErr(''); try { await fn; load(); } catch (e) { setErr((e as Error).message); } }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}><Plus size={16} style={{ verticalAlign: '-2px' }} /> Create a batch</h2>
        <div className="row">
          <input placeholder="e.g. NIELIT Batch 2026-B" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <button className="good" onClick={() => { if (name.trim()) act(api.admin.createCohort(name.trim())).then(() => setName('')); }}>Create</button>
        </div>
        <Banner msg={err} kind="bad" />
      </div>

      {cohorts.map((c) => (
        <div key={c.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{c.name}</h2>
              <span className="chip" style={{ background: c.status === 'active' ? 'hsla(142,71%,45%,.12)' : 'hsla(38,92%,50%,.14)', color: c.status === 'active' ? 'var(--good)' : 'var(--warn)' }}>{c.status}</span>
              <span className="muted" style={{ fontSize: 12 }}>{c.members.length} member(s)</span>
            </div>
            <div className="row">
              {c.status === 'active'
                ? <button onClick={() => act(api.admin.suspendCohort(c.id))}><Ban size={13} style={{ verticalAlign: '-2px' }} /> Suspend</button>
                : <button className="good" onClick={() => act(api.admin.reactivateCohort(c.id))}><RotateCcw size={13} style={{ verticalAlign: '-2px' }} /> Reactivate</button>}
              <button className="bad" onClick={() => { if (confirm(`Delete batch "${c.name}"?`)) act(api.admin.deleteCohort(c.id)); }}><Trash2 size={13} /></button>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            {c.members.map((m) => (
              <span key={m.userId} className="chip" style={{ marginRight: 6, marginBottom: 6, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {m.displayName} {m.role === 'instructor' && <em style={{ fontSize: 10 }}>(instructor)</em>}
                <button onClick={() => act(api.admin.removeMember(c.id, m.userId))} style={{ padding: 0, background: 'none', border: 'none', color: 'var(--bad)', cursor: 'pointer' }}>×</button>
              </span>
            ))}
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <AddMember cohortId={c.id} users={users} existing={c.members.map((m) => m.userId)} onDone={load} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AddMember({ cohortId, users, existing, onDone }: { cohortId: string; users: AdminUser[]; existing: string[]; onDone: () => void }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'learner' | 'instructor'>('learner');
  const available = users.filter((u) => !existing.includes(u.id) && u.status === 'active');
  return (
    <>
      <select value={userId} onChange={(e) => setUserId(e.target.value)}>
        <option value="">add member…</option>
        {available.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>)}
      </select>
      <select value={role} onChange={(e) => setRole(e.target.value as 'learner' | 'instructor')}>
        <option value="learner">learner</option><option value="instructor">instructor</option>
      </select>
      <button onClick={() => { if (userId) api.admin.addMember(cohortId, userId, role).then(() => { setUserId(''); onDone(); }); }}>Add</button>
    </>
  );
}

// ─────────────────────────────── Modules ────────────────────────────────────
function ModulesTab() {
  const { locale } = useLang();
  const [mods, setMods] = useState<ModuleRow[]>([]);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null); // {id:null}=new, {id}=edit
  const [err, setErr] = useState('');

  const load = () => api.admin.modules().then(setMods).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function act(fn: Promise<unknown>) { setErr(''); try { await fn; load(); } catch (e) { setErr((e as Error).message); } }

  if (editing) {
    return <ModuleEditor moduleId={editing.id} onClose={() => { setEditing(null); load(); }} />;
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0 }}>{mods.length} modules · built-ins can be enabled/disabled; authored modules are fully editable.</p>
        <button className="good" onClick={() => setEditing({ id: null })}><Plus size={14} style={{ verticalAlign: '-2px' }} /> New module</button>
      </div>
      <Banner msg={err} kind="bad" />
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              <th style={{ padding: '8px 6px' }}>Title</th><th>Module</th><th>Tier</th><th>Source</th><th>Enabled</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mods.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 6px', fontWeight: 700 }}>{L(m.title, locale)}<div className="muted" style={{ fontWeight: 400, fontSize: 11 }}>{m.id}</div></td>
                <td><span className="chip">{m.module}</span></td>
                <td>{m.executionTier}</td>
                <td><span className="chip" style={{ color: m.source === 'authored' ? 'var(--accent)' : 'var(--muted)' }}>{m.source}</span></td>
                <td>
                  <button onClick={() => act(api.admin.moduleSettings(m.id, { enabled: !m.enabled }))} style={{ padding: '3px 9px', background: m.enabled ? 'hsla(142,71%,45%,.14)' : 'var(--surface)', color: m.enabled ? 'var(--good)' : 'var(--muted)' }}>
                    {m.enabled ? 'on' : 'off'}
                  </button>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {m.source === 'authored' && (
                    <>
                      <button title="edit" onClick={() => setEditing({ id: m.id })} style={{ padding: '4px 8px' }}><Pencil size={13} /></button>
                      <button title="delete" className="bad" onClick={() => { if (confirm(`Delete module "${m.id}"?`)) act(api.admin.deleteModule(m.id)); }} style={{ padding: '4px 8px', marginLeft: 4 }}><Trash2 size={13} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { Locale };
