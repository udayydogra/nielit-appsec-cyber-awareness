import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { api, mentorAsk } from '../api/client';
import { useLang, useT } from '../i18n';

interface Msg { role: 'user' | 'bot'; text: string; }
type Tab = 'QA' | 'EXPLAIN' | 'HINT' | 'ANALYZE';

// "Sathi" — the AI Security Instructor (ported from the reference). Talks to OUR
// backend (never the model host); context-aware via server-side telemetry. The
// tabs send canned prompts; QA is freeform. Streams tokens over SSE.
const TAB_PROMPT: Record<Exclude<Tab, 'QA'>, string> = {
  EXPLAIN: 'Explain why this happened, at a student level.',
  HINT: 'Give me a hint for the next step without spoiling it.',
  ANALYZE: 'Analyze my last action and what it means.',
};

export function MentorWidget({ labId }: { labId: string | null }) {
  const { locale } = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('QA');
  const [provider, setProvider] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.mentorProvider().then((p) => setProvider(p.provider)).catch(() => {}); }, []);
  useEffect(() => { bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight); }, [msgs]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || !labId || busy) return;
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: '' }]);
    try {
      for await (const tok of mentorAsk(labId, q, locale)) {
        setMsgs((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: 'bot', text: copy[copy.length - 1].text + tok };
          return copy;
        });
      }
    } finally { setBusy(false); }
  }
  function pickTab(x: Tab) {
    setTab(x);
    if (x !== 'QA') ask(TAB_PROMPT[x]);
  }
  function send() { const q = input; setInput(''); ask(q); }

  return (
    <>
      <button className="mentor-fab" title="Sathi — AI Instructor" onClick={() => setOpen((o) => !o)}>
        {open ? <X size={22} /> : <Bot size={24} />}
      </button>
      {open && (
        <div className="mentor-panel">
          <div className="mentor-head">
            <div className="avatar"><Sparkles size={20} /></div>
            <div style={{ flex: 1 }}>
              <div className="t">Sathi</div>
              <div className="s">AI Security Instructor</div>
            </div>
            <span className="chip" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>{provider || '…'}</span>
          </div>
          <div className="mentor-tabs">
            {(['QA', 'EXPLAIN', 'HINT', 'ANALYZE'] as Tab[]).map((x) => (
              <button key={x} className={`mentor-tab ${tab === x ? 'active' : ''}`} disabled={!labId || busy} onClick={() => pickTab(x)}>{x}</button>
            ))}
          </div>
          <div className="mentor-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="mentor-msg bot">
                {labId ? 'Hello! I am Sathi, your AI Security Instructor. Ask a question, or tap EXPLAIN / HINT / ANALYZE.' : 'Open a lab and I can give you context-aware help.'}
              </div>
            )}
            {msgs.map((m, i) => <div key={i} className={`mentor-msg ${m.role}`}>{m.text || '…'}</div>)}
          </div>
          <div className="mentor-foot">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('askMentor')}
              onKeyDown={(e) => e.key === 'Enter' && send()} disabled={!labId || busy} />
            <button className="primary" onClick={send} disabled={!labId || busy} style={{ padding: '9px 12px' }}><Send size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
