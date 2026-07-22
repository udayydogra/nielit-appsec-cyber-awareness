import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { api, type LocalizedString } from '../api/client';

// A form-based authoring editor for a full training module — metadata plus the
// content graph (AppSec lifecycle sections / quiz / missions, or an Awareness
// scenario-node graph). Produces the same unified manifest the built-ins use.

type Draft = Record<string, any>;
const LS = (): LocalizedString => ({ en: '', hi: '' });

function Bi({ label, value, onChange, area }: { label: string; value: LocalizedString; onChange: (v: LocalizedString) => void; area?: boolean }) {
  const I = area ? 'textarea' : 'input';
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
        <I placeholder="English" value={value.en} onChange={(e: any) => onChange({ ...value, en: e.target.value })} rows={area ? 3 : undefined} />
        <I placeholder="हिन्दी" value={value.hi} onChange={(e: any) => onChange({ ...value, hi: e.target.value })} rows={area ? 3 : undefined} />
      </div>
    </div>
  );
}

const APPSEC_WIDGETS = ['sqli-console', 'idor-console', 'xss-console', 'csrf-console', 'auth-console', 'session-console', 'bola-console', 'bizlogic-console', 'race-console', 'api-console', 'llm-console', 'fileupload-console', 'cloud-console'];
const NODE_TYPES = ['narration', 'decision', 'consequence', 'feedback', 'checklist'];

export function ModuleEditor({ moduleId, onClose }: { moduleId: string | null; onClose: () => void }) {
  const isNew = moduleId === null;
  const [d, setD] = useState<Draft>({
    id: '', module: 'appsec', executionTier: 0, category: '',
    title: LS(), summary: LS(), lifecycle: [], quiz: [], missions: [],
    start: '', nodes: {},
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch: Draft) => setD((p) => ({ ...p, ...patch }));

  useEffect(() => {
    if (!isNew && moduleId) {
      api.admin.module(moduleId).then((r) => {
        const m = r.manifest as Draft;
        setD({ lifecycle: [], quiz: [], missions: [], nodes: {}, start: '', category: '', ...m });
      }).catch((e) => setErr(e.message));
    }
  }, [moduleId, isNew]);

  async function save() {
    setErr(''); setSaving(true);
    try {
      // Prune the fields irrelevant to the chosen module kind before sending.
      const manifest: Draft = {
        id: d.id, module: d.module, executionTier: Number(d.executionTier),
        category: d.category || undefined, title: d.title, summary: d.summary,
      };
      if (d.module === 'appsec') {
        manifest.lifecycle = d.lifecycle;
        manifest.quiz = d.quiz;
        if (d.missions?.length) manifest.missions = d.missions;
      } else {
        manifest.start = d.start;
        manifest.nodes = d.nodes;
      }
      if (isNew) await api.admin.createModule(manifest);
      else await api.admin.updateModule(d.id, manifest);
      onClose();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={onClose}><ArrowLeft size={14} style={{ verticalAlign: '-2px' }} /> Back to modules</button>
        <button className="good" onClick={save} disabled={saving}><Save size={14} style={{ verticalAlign: '-2px' }} /> {saving ? 'Saving…' : (isNew ? 'Create module' : 'Save changes')}</button>
      </div>
      {err && <p className="result-bad">{err}</p>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Basics</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 8 }}>
          <div>
            <label className="muted" style={{ fontSize: 11 }}>id (kebab-case)</label>
            <input placeholder="my-new-lab" value={d.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
          </div>
          <div>
            <label className="muted" style={{ fontSize: 11 }}>module</label>
            <select value={d.module} onChange={(e) => set({ module: e.target.value })}>
              <option value="appsec">appsec</option><option value="awareness">awareness</option>
            </select>
          </div>
          <div>
            <label className="muted" style={{ fontSize: 11 }}>execution tier</label>
            <select value={d.executionTier} onChange={(e) => set({ executionTier: Number(e.target.value) })}>
              {[0, 1, 2, 3].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="muted" style={{ fontSize: 11 }}>category</label>
            <input placeholder="injection" value={d.category} onChange={(e) => set({ category: e.target.value })} />
          </div>
        </div>
        <Bi label="Title" value={d.title} onChange={(v) => set({ title: v })} />
        <Bi label="Summary" value={d.summary} onChange={(v) => set({ summary: v })} area />
      </div>

      {d.module === 'appsec'
        ? <AppSecContent d={d} set={set} />
        : <AwarenessContent d={d} set={set} />}
    </div>
  );
}

// ── AppSec: lifecycle sections + quiz + missions ─────────────────────────────
function AppSecContent({ d, set }: { d: Draft; set: (p: Draft) => void }) {
  const sections: Draft[] = d.lifecycle ?? [];
  const upd = (i: number, patch: Draft) => set({ lifecycle: sections.map((s, j) => j === i ? { ...s, ...patch } : s) });
  const add = (type: string) => set({ lifecycle: [...sections, { id: `s${sections.length + 1}`, type, title: LS(), body: LS(), items: [], hints: [] }] });
  const del = (i: number) => set({ lifecycle: sections.filter((_, j) => j !== i) });

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Lesson sections</h2>
          <div className="row">
            {['content', 'objectives', 'code', 'interactive'].map((t) => (
              <button key={t} onClick={() => add(t)}><Plus size={12} style={{ verticalAlign: '-2px' }} /> {t}</button>
            ))}
          </div>
        </div>
        {sections.map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="chip">{s.type}</span>
              <button className="bad" onClick={() => del(i)} style={{ padding: '3px 7px' }}><Trash2 size={12} /></button>
            </div>
            <Bi label="Section title" value={s.title ?? LS()} onChange={(v) => upd(i, { title: v })} />
            {(s.type === 'content') && <Bi label="Body" value={s.body ?? LS()} onChange={(v) => upd(i, { body: v })} area />}
            {(s.type === 'objectives') && <ListEditor label="Objectives" items={s.items ?? []} onChange={(items) => upd(i, { items })} />}
            {(s.type === 'code') && (
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label className="muted" style={{ fontSize: 11 }}>insecure</label><textarea rows={4} value={s.insecure ?? ''} onChange={(e) => upd(i, { insecure: e.target.value })} /></div>
                <div><label className="muted" style={{ fontSize: 11 }}>secure</label><textarea rows={4} value={s.secure ?? ''} onChange={(e) => upd(i, { secure: e.target.value })} /></div>
              </div>
            )}
            {(s.type === 'interactive') && (
              <div><label className="muted" style={{ fontSize: 11 }}>exploit widget</label>
                <select value={s.widget ?? ''} onChange={(e) => upd(i, { widget: e.target.value })}>
                  <option value="">— none —</option>
                  {APPSEC_WIDGETS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      <QuizEditor quiz={d.quiz ?? []} onChange={(quiz) => set({ quiz })} />
      <MissionsEditor missions={d.missions ?? []} onChange={(missions) => set({ missions })} />
    </>
  );
}

// ── Awareness: scenario-node graph ───────────────────────────────────────────
function AwarenessContent({ d, set }: { d: Draft; set: (p: Draft) => void }) {
  const nodes: Record<string, Draft> = d.nodes ?? {};
  const ids = Object.keys(nodes);
  const setNode = (id: string, patch: Draft) => set({ nodes: { ...nodes, [id]: { ...nodes[id], ...patch } } });
  const addNode = () => { const id = `n${ids.length + 1}`; set({ nodes: { ...nodes, [id]: { type: 'narration', content: LS(), choices: [] } }, start: d.start || id }); };
  const delNode = (id: string) => { const n = { ...nodes }; delete n[id]; set({ nodes: n }); };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Scenario nodes</h2>
        <button onClick={addNode}><Plus size={12} style={{ verticalAlign: '-2px' }} /> node</button>
      </div>
      <div className="row" style={{ margin: '10px 0' }}>
        <label className="muted" style={{ fontSize: 11 }}>start node</label>
        <select value={d.start ?? ''} onChange={(e) => set({ start: e.target.value })}>
          <option value="">—</option>{ids.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
      {ids.map((id) => {
        const n = nodes[id];
        return (
          <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <strong>{id}</strong>
                <select value={n.type} onChange={(e) => setNode(id, { type: e.target.value })}>
                  {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button className="bad" onClick={() => delNode(id)} style={{ padding: '3px 7px' }}><Trash2 size={12} /></button>
            </div>
            <Bi label="Content / prompt" value={n.content ?? LS()} onChange={(v) => setNode(id, { content: v })} area />
            {n.type === 'decision' ? (
              <ChoicesEditor choices={n.choices ?? []} nodeIds={ids} onChange={(choices) => setNode(id, { choices })} />
            ) : (
              <div className="row"><label className="muted" style={{ fontSize: 11 }}>next node</label>
                <select value={n.next ?? ''} onChange={(e) => setNode(id, { next: e.target.value })}>
                  <option value="">— end —</option>{ids.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChoicesEditor({ choices, nodeIds, onChange }: { choices: Draft[]; nodeIds: string[]; onChange: (c: Draft[]) => void }) {
  return (
    <div>
      <label className="muted" style={{ fontSize: 11 }}>choices</label>
      {choices.map((c, i) => (
        <div key={i} className="row" style={{ gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}><Bi label={`choice ${i + 1}`} value={c.label ?? LS()} onChange={(v) => onChange(choices.map((x, j) => j === i ? { ...x, label: v } : x))} /></div>
          <select value={c.goto ?? ''} onChange={(e) => onChange(choices.map((x, j) => j === i ? { ...x, goto: e.target.value } : x))}>
            <option value="">goto…</option>{nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
          <button className="bad" onClick={() => onChange(choices.filter((_, j) => j !== i))} style={{ padding: '3px 7px' }}><Trash2 size={12} /></button>
        </div>
      ))}
      <button style={{ marginTop: 6 }} onClick={() => onChange([...choices, { label: LS(), goto: '' }])}><Plus size={12} style={{ verticalAlign: '-2px' }} /> choice</button>
    </div>
  );
}

function ListEditor({ label, items, onChange }: { label: string; items: LocalizedString[]; onChange: (i: LocalizedString[]) => void }) {
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}><Bi label={`${label} ${i + 1}`} value={it} onChange={(v) => onChange(items.map((x, j) => j === i ? v : x))} /></div>
          <button className="bad" onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ padding: '3px 7px', marginTop: 20 }}><Trash2 size={12} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, LS()])}><Plus size={12} style={{ verticalAlign: '-2px' }} /> {label.toLowerCase()}</button>
    </div>
  );
}

function QuizEditor({ quiz, onChange }: { quiz: Draft[]; onChange: (q: Draft[]) => void }) {
  const upd = (i: number, patch: Draft) => onChange(quiz.map((q, j) => j === i ? { ...q, ...patch } : q));
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Quiz</h2>
        <button onClick={() => onChange([...quiz, { id: `q${quiz.length + 1}`, prompt: LS(), choices: [], correct: '' }])}><Plus size={12} style={{ verticalAlign: '-2px' }} /> question</button>
      </div>
      {quiz.map((q, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Q{i + 1}</strong>
            <button className="bad" onClick={() => onChange(quiz.filter((_, j) => j !== i))} style={{ padding: '3px 7px' }}><Trash2 size={12} /></button>
          </div>
          <Bi label="Prompt" value={q.prompt ?? LS()} onChange={(v) => upd(i, { prompt: v })} />
          <label className="muted" style={{ fontSize: 11 }}>choices (select the correct one)</label>
          {(q.choices ?? []).map((c: Draft, ci: number) => (
            <div key={ci} className="row" style={{ gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
              <input type="radio" name={`correct-${i}`} checked={q.correct === c.id} onChange={() => upd(i, { correct: c.id })} style={{ marginTop: 22 }} />
              <div style={{ flex: 1 }}><Bi label={`choice ${c.id}`} value={c.label ?? LS()} onChange={(v) => upd(i, { choices: q.choices.map((x: Draft, j: number) => j === ci ? { ...x, label: v } : x) })} /></div>
              <button className="bad" onClick={() => upd(i, { choices: q.choices.filter((_: Draft, j: number) => j !== ci) })} style={{ padding: '3px 7px', marginTop: 20 }}><Trash2 size={12} /></button>
            </div>
          ))}
          <button style={{ marginTop: 6 }} onClick={() => { const id = String.fromCharCode(97 + (q.choices?.length ?? 0)); upd(i, { choices: [...(q.choices ?? []), { id, label: LS() }] }); }}><Plus size={12} style={{ verticalAlign: '-2px' }} /> choice</button>
        </div>
      ))}
    </div>
  );
}

function MissionsEditor({ missions, onChange }: { missions: Draft[]; onChange: (m: Draft[]) => void }) {
  const upd = (i: number, patch: Draft) => onChange(missions.map((m, j) => j === i ? { ...m, ...patch } : m));
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Missions <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>(optional guided objectives)</span></h2>
        <button onClick={() => onChange([...missions, { id: `m${missions.length + 1}`, title: LS(), hint: LS() }])}><Plus size={12} style={{ verticalAlign: '-2px' }} /> mission</button>
      </div>
      {missions.map((m, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Mission {i + 1}</strong>
            <button className="bad" onClick={() => onChange(missions.filter((_, j) => j !== i))} style={{ padding: '3px 7px' }}><Trash2 size={12} /></button>
          </div>
          <Bi label="Title" value={m.title ?? LS()} onChange={(v) => upd(i, { title: v })} />
          <Bi label="Hint" value={m.hint ?? LS()} onChange={(v) => upd(i, { hint: v })} />
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label className="muted" style={{ fontSize: 11 }}>signal (auto-tick token, optional)</label><input value={m.signal ?? ''} onChange={(e) => upd(i, { signal: e.target.value })} /></div>
            <div><label className="muted" style={{ fontSize: 11 }}>detect regex (terminal, optional)</label><input value={m.detect ?? ''} onChange={(e) => upd(i, { detect: e.target.value })} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}
