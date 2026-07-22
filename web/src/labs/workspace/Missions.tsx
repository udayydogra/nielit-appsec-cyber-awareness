import { useEffect, useRef, useState } from 'react';
import { Check, Target, Trophy, Sparkles } from 'lucide-react';
import { L, useLang } from '../../i18n';
import type { LocalizedString } from '../../api/client';

export interface Mission {
  id: string;
  title: LocalizedString;
  hint?: LocalizedString;
  signal?: string; // auto-completes when a matching `lab-signal` fires (exploit, flag…)
  detect?: string; // auto-completes when this regex matches accumulated terminal output
}

// Strip ANSI/control noise so `detect` regexes match the plain text the shell printed.
function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC ... BEL/ST
    .replace(/\x1b[@-Z\\-_]/g, '')                     // 2-char Fe escapes
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')         // CSI sequences
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\r]/g, '');   // stray control chars + CR (keep \t \n)
}

// Guided objectives. A mission auto-ticks when a matching lab-signal fires (an exploit
// succeeds, a flag is read) OR when its `detect` regex matches what the learner has
// actually run in the terminal — no manual marking for anything the student can *do*.
// Purely reflective steps (no signal/detect) keep a self-check button.
export function Missions({ missions }: { missions: Mission[] }) {
  const { locale } = useLang();
  const [done, setDone] = useState<Set<string>>(new Set());
  const buf = useRef('');

  useEffect(() => {
    // Precompile detect regexes once.
    const detectors = missions
      .filter((m) => m.detect)
      .map((m) => {
        try { return { id: m.id, re: new RegExp(m.detect!, 'i') }; } catch { return null; }
      })
      .filter((x): x is { id: string; re: RegExp } => x !== null);

    function tick(match: (m: Mission) => boolean) {
      setDone((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const m of missions) {
          if (!next.has(m.id) && match(m)) { next.add(m.id); changed = true; }
        }
        return changed ? next : prev;
      });
    }

    function onSignal(e: Event) {
      const d = (e as CustomEvent).detail ?? {};
      if (d.type === 'term') {
        // Terminal output chunk → grow buffer (capped) and re-run detectors.
        buf.current = (buf.current + stripAnsi(String(d.chunk ?? ''))).slice(-20000);
        const text = buf.current;
        setDone((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const det of detectors) {
            if (!next.has(det.id) && det.re.test(text)) { next.add(det.id); changed = true; }
          }
          return changed ? next : prev;
        });
        return;
      }
      const tokens = [d.type, d.kind, d.value, d.op].filter(Boolean).map(String);
      tick((m) => !!m.signal && tokens.some((tk) => tk.includes(m.signal!) || m.signal!.includes(tk)));
    }
    window.addEventListener('lab-signal', onSignal);
    return () => window.removeEventListener('lab-signal', onSignal);
  }, [missions]);

  const complete = done.size >= missions.length && missions.length > 0;
  const pct = missions.length ? Math.round((done.size / missions.length) * 100) : 0;

  return (
    <div className="ws-missions">
      <h3><Target size={16} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--ws-accent)' }} />Missions</h3>
      <div style={{ fontSize: 12, color: '#64748b' }}>{done.size}/{missions.length} objectives · complete them, don't read the answer</div>
      <div className="ws-mprogress"><i style={{ width: `${pct}%` }} /></div>

      {missions.map((m) => {
        const isDone = done.has(m.id);
        const auto = !!(m.signal || m.detect);
        return (
          <div key={m.id} className={`ws-mission ${isDone ? 'done' : ''}`}>
            <span className="dot">{isDone ? <Check size={13} /> : ''}</span>
            <div style={{ flex: 1 }}>
              <div className="mt">{L(m.title, locale)}</div>
              {m.hint && <div className="mh">{L(m.hint, locale)}</div>}
              {!isDone && auto && (
                <div className="mauto"><Sparkles size={11} style={{ verticalAlign: '-1px' }} /> auto-checks when you do it</div>
              )}
            </div>
            {!isDone && !auto && (
              <button className="mark" onClick={() => setDone((p) => new Set(p).add(m.id))}>Mark done</button>
            )}
          </div>
        );
      })}

      {complete && (
        <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 12, background: 'hsla(142,71%,45%,.1)', border: '1px solid hsla(142,71%,45%,.4)', color: '#0f5132', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
          <Trophy size={18} /> All objectives complete — exit the lab to record your progress.
        </div>
      )}
    </div>
  );
}
