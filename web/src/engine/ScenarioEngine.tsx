import { useEffect, useRef, useState } from 'react';
import { api, type LocalizedString } from '../api/client';
import { L, useLang, useT } from '../i18n';
import { Quiz, type QuizQuestion } from '../components/Quiz';

// One graph engine, N content files. Five node types cover every scenario.
type NodeType = 'narration' | 'decision' | 'consequence' | 'feedback' | 'checklist';
interface RedFlag { at: number; flag: string; note?: LocalizedString; }
interface Choice { label: LocalizedString; goto: string; }
interface ScenarioNode {
  type: NodeType; channel?: string; anim?: string;
  content?: LocalizedString; prompt?: LocalizedString; title?: LocalizedString;
  choices?: Choice[]; media?: { clip: string; poster?: string }; redFlags?: RedFlag[];
  outcome?: 'positive' | 'negative' | 'neutral'; technique?: LocalizedString;
  items?: LocalizedString[]; next?: string;
}
interface ScenarioManifest {
  id: string; title: LocalizedString; summary: LocalizedString; start: string;
  nodes: Record<string, ScenarioNode>; quiz: QuizQuestion[];
  reportingResources?: { label: LocalizedString; value: string }[];
}

export function ScenarioEngine({ labId }: { labId: string }) {
  const { locale } = useLang();
  const t = useT();
  const [m, setM] = useState<ScenarioManifest | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.start(labId).catch(() => {});
    api.manifest<ScenarioManifest>(labId).then((x) => { if (alive) { setM(x); setNodeId(x.start); } });
    return () => { alive = false; };
  }, [labId]);

  if (!m || !nodeId) return <div className="content"><p className="muted">Loading…</p></div>;
  if (nodeId === 'quiz') return <ScenarioQuizWrap m={m} />;

  const node = m.nodes[nodeId];
  if (!node) return <p className="result-bad">Broken graph: node “{nodeId}” missing.</p>;

  const go = (to?: string) => setNodeId(to ?? 'quiz');
  async function choose(c: Choice) {
    // Send the destination node; the server reads its outcome from the manifest.
    await api.decision(labId, c.goto).catch(() => {});
    go(c.goto);
  }

  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{L(m.title, locale)}</h2>
          <span className="tier-badge">{t('tier')} 0 · content only</span>
        </div>
        <p className="muted">{L(m.summary, locale)}</p>
      </div>
      <NodeView key={nodeId} node={node} onNext={go} onChoose={choose} reporting={m.reportingResources} />
    </div>
  );
}

function NodeView({ node, onNext, onChoose, reporting }: {
  node: ScenarioNode; onNext: (to?: string) => void; onChoose: (c: Choice) => void;
  reporting?: { label: LocalizedString; value: string }[];
}) {
  const { locale } = useLang();
  const t = useT();

  if (node.type === 'narration' && node.channel === 'videocall') {
    return <VideoCall node={node} onNext={onNext} />;
  }

  if (node.type === 'narration') {
    const text = L(node.content, locale);
    return (
      <div className="card">
        <div className="phone">
          {node.channel === 'sms' && <SmsScreen text={text} />}
          {node.channel === 'chat' && (
            <div className="chat-bubble">
              <div className="who">WhatsApp · unknown number</div>
              <div>{text}</div>
              <div className="time">now ✓✓</div>
            </div>
          )}
          {node.channel === 'payment' && <PaymentSheet text={text} />}
          {!['sms', 'chat', 'payment'].includes(node.channel ?? '') && <p>{text}</p>}
        </div>
        <div className="row" style={{ marginTop: 12 }}><button className="primary" onClick={() => onNext(node.next)}>{t('next')}</button></div>
      </div>
    );
  }

  if (node.type === 'decision') {
    return (
      <div className="card">
        <p style={{ fontWeight: 600 }}>{L(node.prompt, locale)}</p>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {node.choices?.map((c, i) => (
            <button key={i} style={{ textAlign: 'left' }} onClick={() => onChoose(c)}>{L(c.label, locale)}</button>
          ))}
        </div>
      </div>
    );
  }

  if (node.type === 'consequence') {
    const cls = node.outcome === 'positive' ? 'result-good' : node.outcome === 'negative' ? 'result-bad' : 'result-neutral';
    return (
      <div className={`card ${node.anim === 'shake' ? 'shake' : node.anim === 'check-pop' ? 'check-pop' : ''}`}>
        <p className={cls} style={{ fontWeight: 600 }}>
          {node.outcome === 'positive' ? '✓ ' : node.outcome === 'negative' ? '✗ ' : '• '}
          {L(node.content, locale)}
        </p>
        {node.technique && (
          <div className="card" style={{ background: '#0b0f14' }}>
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Fraud technique</div>
            <p style={{ margin: 0 }}>{L(node.technique, locale)}</p>
          </div>
        )}
        <button className="primary" onClick={() => onNext(node.next)}>{t('next')}</button>
      </div>
    );
  }

  // checklist / feedback
  return (
    <div className="card">
      <h2>{L(node.title, locale)}</h2>
      <ul>{node.items?.map((it, i) => <li key={i}>{L(it, locale)}</li>)}</ul>
      {reporting && (
        <div className="row" style={{ fontSize: 13 }}>
          <span className="muted">{t('report')}:</span>
          {reporting.map((r) => <span key={r.value} className="chip">{L(r.label, locale)}: <b>{r.value}</b></span>)}
        </div>
      )}
      <div style={{ marginTop: 12 }}><button className="primary" onClick={() => onNext(node.next)}>{t('quiz')} →</button></div>
    </div>
  );
}

// Video-call scam scene: ringing → pickup/decline. Decline → callback from a NEW
// number (teaches scammer persistence). Pick up → clip (avatar+narration) → timed
// red flags stream on the right as the "officer" says the thing → Next.
function VideoCall({ node, onNext }: { node: ScenarioNode; onNext: (to?: string) => void }) {
  const { locale } = useLang();
  const t = useT();
  const [phase, setPhase] = useState<'ringing' | 'connecting' | 'connected'>('ringing');
  const [declines, setDeclines] = useState(0);
  const [shownFlags, setShownFlags] = useState<RedFlag[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timers = useRef<number[]>([]);
  const totalFlags = node.redFlags?.length ?? 0;
  const allFlagsShown = shownFlags.length >= totalFlags;

  // Brief "connecting…" beat before the clip, like a real call handshake.
  useEffect(() => {
    if (phase !== 'connecting') return;
    const id = window.setTimeout(() => setPhase('connected'), 900);
    return () => clearTimeout(id);
  }, [phase]);

  // Stream red flags on their `at` timestamps + tick the call timer. During the
  // clip ONLY the flags animate; the video area is a static texture (§7).
  useEffect(() => {
    if (phase !== 'connected') return;
    (node.redFlags ?? []).forEach((f) => {
      timers.current.push(window.setTimeout(() => setShownFlags((p) => [...p, f]), f.at * 700));
    });
    const tick = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { timers.current.forEach(clearTimeout); timers.current = []; clearInterval(tick); };
  }, [phase, node]);

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const number = `+91 98${String(10000 + declines * 137).padStart(5, '0').slice(0, 3)}•••`;

  if (phase === 'ringing') {
    return (
      <div className="card">
        <div className="phone">
          <div className="vc-screen">
            <div className="vc-video"><div className="vc-avatar">👮</div></div>
            <div className="vc-topbar">
              <span className="sim-marker">{t('simulation')}</span>
            </div>
            <div className="vc-caption">
              <div style={{ fontWeight: 600 }}>{t('unknownCaller')}</div>
              <div className="muted">{t('incomingCall')} · {number}</div>
              {declines > 0 && <div className="vc-callback">📞 {t('calledBack')}</div>}
            </div>
            <div className="vc-controls">
              <button className="vc-btn hangup" title={t('decline')} onClick={() => setDeclines((d) => d + 1)}>✕</button>
              <button className="vc-btn accept ring" title={t('pickUp')} onClick={() => setPhase('connecting')}>📹</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="grid" style={{ gridTemplateColumns: '1fr 260px', alignItems: 'start' }}>
        <div className="phone">
          <div className="vc-screen">
            <div className="vc-video"><div className="vc-avatar">👮</div></div>
            <div className="vc-topbar">
              <div className="vc-caller">
                <div><div className="name">{t('unknownCaller')}</div><div className="sub">{number}</div></div>
              </div>
              {phase === 'connected'
                ? <span className="vc-timer"><span className="vc-rec"><span className="rec-dot" /> </span>{mmss}</span>
                : <span className="vc-timer">{t('connecting')}</span>}
            </div>
            {phase === 'connected' && <div className="vc-caption">{L(node.content, locale)}</div>}
            {phase === 'connecting' && (
              <div className="vc-connecting"><div className="pulse muted">📡 {t('connecting')}</div></div>
            )}
            <div className="vc-controls">
              <span className="sim-marker">{t('simulation')}</span>
              <button className="vc-btn hangup" disabled={!allFlagsShown} title={t('endCall')} onClick={() => onNext(node.next)}>📞</button>
            </div>
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', marginBottom: 8 }}>
            🚩 {t('redFlags')} <span style={{ float: 'right' }}>{shownFlags.length}/{totalFlags}</span>
          </div>
          <ul className="flag-list">
            {shownFlags.map((f, i) => (
              <li key={i}>
                <span className="flag-name">{f.flag.replace(/_/g, ' ')}</span>
                {f.note && <div className="muted" style={{ fontSize: 13 }}>{L(f.note, locale)}</div>}
              </li>
            ))}
          </ul>
          {allFlagsShown && (
            <button className="primary" style={{ marginTop: 10 }} onClick={() => onNext(node.next)}>{t('next')}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Channel-realistic SMS: a messaging-app screen. The odd short-code sender ("not
// in contacts") is itself a red flag the student should learn to notice.
function SmsScreen({ text }: { text: string }) {
  const t = useT();
  return (
    <div className="sms-app">
      <div className="sms-statusbar"><span>9:41</span><span className="bars">▂▄▆ · 4G · 78%</span></div>
      <div className="sms-header">
        <div className="sender-avatar">✉️</div>
        <div>
          <div className="sender-id">VM-GOVUPD</div>
          <div className="sender-sub">{t('unknownSender')}</div>
        </div>
      </div>
      <div className="sms-thread">
        <div className="sms-in">
          <div className="body">{text}</div>
          <div className="stamp">now</div>
        </div>
      </div>
      <div className="sms-replybar"><span className="fakeinput">{t('tapReply')}</span><span>➤</span></div>
    </div>
  );
}

// Channel-realistic UPI collect-request sheet: slides UP like a real payment app.
// The amount is lifted from the narration text (locale-safe: '₹8,000' is identical
// in en/hi). The green "PAY" affordance is the authentic tell victims miss — a
// collect request is a PULL. It's decorative chrome; the real choice is the next
// decision node.
function PaymentSheet({ text }: { text: string }) {
  const t = useT();
  const amount = text.match(/₹\s?[\d,]+/)?.[0].replace(/₹\s?/, '') ?? null;
  return (
    <div className="pay-app">
      <div className="pay-topbar"><span className="dot">₹</span> UPI</div>
      <div className="pay-sheet">
        <div className="pay-label">⬇ {t('collectRequest')}</div>
        <div className="pay-requester">
          <div className="pay-avatar">👤</div>
          <div>
            <div style={{ fontWeight: 600 }}>{t('paymentRequest')}</div>
            {amount && <div className="pay-amount"><span className="cur">₹</span>{amount}</div>}
          </div>
        </div>
        <div className="pay-note">{text}</div>
        <div className="pay-pinbtn">🔒 {t('enterPin')}{amount ? ` · PAY ₹${amount}` : ''}</div>
      </div>
    </div>
  );
}

function ScenarioQuizWrap({ m }: { m: ScenarioManifest }) {
  return <Quiz labId={m.id} questions={m.quiz} />;
}
