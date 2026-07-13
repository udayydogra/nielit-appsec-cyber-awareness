import { useEffect, useRef, useState } from 'react';
import { api, mentorAsk } from '../api/client';
import { useLang, useT } from '../i18n';

interface Msg { role: 'user' | 'bot'; text: string; }

// Bottom-right mentor. Talks to OUR backend (never the model host). Context-aware:
// the backend injects current node + last verified action + outcome from telemetry.
export function MentorWidget({ labId }: { labId: string | null }) {
  const { locale } = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.mentorProvider().then((p) => setProvider(p.provider)).catch(() => {}); }, []);
  useEffect(() => { bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight); }, [msgs]);

  async function send() {
    const q = input.trim();
    if (!q || !labId || busy) return;
    setInput(''); setBusy(true);
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

  return (
    <>
      <button className="mentor-fab" title={t('mentor')} onClick={() => setOpen((o) => !o)}>🎓</button>
      {open && (
        <div className="mentor-panel">
          <div className="mentor-head">
            🎓 {t('mentor')}
            <span className="chip" style={{ marginLeft: 'auto' }}>{provider || '…'}</span>
          </div>
          <div className="mentor-body" ref={bodyRef}>
            {msgs.length === 0 && <p className="muted">{labId ? t('askMentor') : 'Open a lab to get context-aware help.'}</p>}
            {msgs.map((m, i) => <div key={i} className={`mentor-msg ${m.role}`}>{m.text || '…'}</div>)}
          </div>
          <div className="mentor-foot">
            <input
              value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('askMentor')}
              onKeyDown={(e) => e.key === 'Enter' && send()} disabled={!labId || busy}
            />
            <button className="primary" onClick={send} disabled={!labId || busy}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}
