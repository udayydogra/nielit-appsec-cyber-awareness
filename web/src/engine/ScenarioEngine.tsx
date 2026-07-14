import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, ChevronRight, ChevronLeft, MoreVertical, AlertTriangle, ShieldCheck, Signal, Wifi, BatteryFull } from 'lucide-react';
import { api, type LocalizedString } from '../api/client';
import { L, useLang, useT } from '../i18n';
import { Quiz, type QuizQuestion } from '../components/Quiz';

// One graph engine, N content files. Rendered as a widescreen "simulation console":
// a realistic phone DEVICE on the left shows the channel scene (sms/chat/payment/
// video-call); the situation / decision / consequence / red-flag panel is on the right.
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

type CallPhase = 'ringing' | 'connecting' | 'connected';

export function ScenarioEngine({ labId }: { labId: string }) {
  const { locale } = useLang();
  const t = useT();
  const [m, setM] = useState<ScenarioManifest | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [scene, setScene] = useState<ScenarioNode | null>(null); // persistent device scene
  const [phase, setPhase] = useState<CallPhase>('ringing');
  const [declines, setDeclines] = useState(0);
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let alive = true;
    api.start(labId).catch(() => {});
    api.manifest<ScenarioManifest>(labId).then((x) => {
      if (!alive) return;
      setM(x); setNodeId(x.start);
      const s = x.nodes[x.start];
      if (s?.type === 'narration') setScene(s);
    });
    return () => { alive = false; };
  }, [labId]);

  // Entering a narration node updates the device scene; a video-call scene resets the call.
  useEffect(() => {
    if (!m || !nodeId) return;
    const node = m.nodes[nodeId];
    if (node?.type === 'narration') {
      setScene(node);
      if (node.channel === 'videocall') { setPhase('ringing'); setDeclines(0); setFlags([]); setElapsed(0); }
    }
  }, [nodeId, m]);

  // connecting → connected handshake
  useEffect(() => {
    if (phase !== 'connecting') return;
    const id = window.setTimeout(() => setPhase('connected'), 900);
    return () => clearTimeout(id);
  }, [phase]);

  // during a connected call: stream red flags on their timestamps + tick the timer
  useEffect(() => {
    if (phase !== 'connected' || scene?.channel !== 'videocall') return;
    (scene.redFlags ?? []).forEach((f) => {
      timers.current.push(window.setTimeout(() => setFlags((p) => (p.includes(f) ? p : [...p, f])), f.at * 700));
    });
    const tick = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { timers.current.forEach(clearTimeout); timers.current = []; clearInterval(tick); };
  }, [phase, scene]);

  if (!m || !nodeId) return <div className="card"><p className="muted">Loading…</p></div>;
  if (nodeId === 'quiz') return <Quiz labId={m.id} questions={m.quiz} />;

  const node = m.nodes[nodeId];
  if (!node) return <p className="result-bad">Broken graph: node “{nodeId}” missing.</p>;

  const go = (to?: string) => setNodeId(to ?? 'quiz');
  async function choose(c: Choice) {
    await api.decision(labId, c.goto).catch(() => {});
    go(c.goto);
  }
  const allFlags = phase === 'connected' && flags.length >= (scene?.redFlags?.length ?? 0);

  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{L(m.title, locale)}</h2>
          <span className="tier-badge">{t('tier')} 0 · content only</span>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>{L(m.summary, locale)}</p>
      </div>

      <div className="sim-stage">
        <Device dark={scene?.channel === 'videocall' || scene?.channel === 'payment'}>
          <SceneView
            scene={scene} phase={phase} elapsed={elapsed} declines={declines}
            onAccept={() => setPhase('connecting')} onDecline={() => setDeclines((d) => d + 1)}
            onHangup={() => go(scene?.next)}
          />
        </Device>
        <div className="sim-right">
          <Panel
            node={node} phase={phase} flags={flags} allFlags={allFlags}
            reporting={m.reportingResources} onNext={go} onChoose={choose}
          />
        </div>
      </div>
    </div>
  );
}

// ── Device frame ──────────────────────────────────────────────────────────────
function Device({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`device${dark ? ' dark-screen' : ''}`}>
      <div className="island" />
      <div className="glare" />
      <div className="statusbar">
        <span>9:41</span>
        <span className="bars"><Signal size={15} /><Wifi size={15} /><BatteryFull size={18} /></span>
      </div>
      <div className="screen">{children}</div>
      <div className="home" />
    </div>
  );
}

function SceneView({ scene, phase, elapsed, declines, onAccept, onDecline, onHangup }: {
  scene: ScenarioNode | null; phase: CallPhase; elapsed: number; declines: number;
  onAccept: () => void; onDecline: () => void; onHangup: () => void;
}) {
  const { locale } = useLang();
  const t = useT();
  if (!scene) return <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#334155' }}><ShieldCheck size={40} /></div>;
  const text = L(scene.content, locale);

  if (scene.channel === 'videocall') {
    return <CallScreen scene={scene} phase={phase} elapsed={elapsed} declines={declines} onAccept={onAccept} onDecline={onDecline} onHangup={onHangup} />;
  }
  if (scene.channel === 'payment') return <PaymentScreen text={text} />;
  if (scene.channel === 'chat') {
    return (
      <div className="chat-screen">
        <div className="chat-header">
          <ChevronLeft size={20} />
          <div className="av">👤</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{t('unknownCaller')}</div><div style={{ fontSize: 11, opacity: .85 }}>online</div></div>
          <Video size={18} /><Phone size={17} />
        </div>
        <div className="chat-thread"><div className="chat-bubble">{text}<div className="time">now ✓✓</div></div></div>
        <div className="sms-replybar"><span className="fakeinput">{t('tapReply')}</span><span>➤</span></div>
      </div>
    );
  }
  // default: sms
  return (
    <div className="sms-app">
      <div className="sms-header">
        <ChevronLeft size={20} color="#94a3b8" />
        <div className="sender-avatar">⚠️</div>
        <div style={{ flex: 1 }}><div className="sender-id">VM-GOVUPD</div><div className="sender-sub">{t('unknownSender')}</div></div>
        <MoreVertical size={18} color="#94a3b8" />
      </div>
      <div className="sms-thread">
        <div className="sms-daysep">Today</div>
        <div className="sms-in"><div className="body">{text}</div><div className="stamp">now · SMS</div></div>
      </div>
      <div className="sms-replybar"><span className="fakeinput">{t('tapReply')}</span><span>➤</span></div>
    </div>
  );
}

function CallScreen({ scene, phase, elapsed, declines, onAccept, onDecline, onHangup }: {
  scene: ScenarioNode; phase: CallPhase; elapsed: number; declines: number;
  onAccept: () => void; onDecline: () => void; onHangup: () => void;
}) {
  const { locale } = useLang();
  const t = useT();
  const number = `+91 98${String(10000 + declines * 137).padStart(5, '0').slice(0, 3)}•••`;
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="vc-screen">
      <div className="vc-video"><div className="vc-avatar">👮</div></div>
      <div className="vc-topbar">
        <span className="sim-marker">{t('simulation')}</span>
        {phase === 'connected'
          ? <span className="vc-timer"><span className="vc-rec"><span className="rec-dot" /> </span>{mmss}</span>
          : <span className="vc-timer">{phase === 'connecting' ? t('connecting') : ''}</span>}
      </div>
      {phase === 'connecting' && <div className="vc-connecting"><div className="pulse muted">📡 {t('connecting')}</div></div>}
      <div className="vc-caption">
        <div style={{ fontWeight: 700 }}>{t('unknownCaller')} <span style={{ opacity: .7, fontWeight: 400 }}>· {number}</span></div>
        {phase === 'connected'
          ? <div style={{ marginTop: 4 }}>{L(scene.content, locale)}</div>
          : <div className="muted" style={{ marginTop: 2 }}>{t('incomingCall')}{declines > 0 ? ` · ${t('calledBack')}` : ''}</div>}
      </div>
      <div className="vc-controls">
        {phase === 'ringing' ? (
          <>
            <button className="vc-btn hangup" title={t('decline')} onClick={onDecline}><PhoneOff size={22} /></button>
            <button className="vc-btn accept ring" title={t('pickUp')} onClick={onAccept}><Video size={22} /></button>
          </>
        ) : (
          <button className="vc-btn hangup" title={t('endCall')} onClick={onHangup}><PhoneOff size={22} /></button>
        )}
      </div>
    </div>
  );
}

function PaymentScreen({ text }: { text: string }) {
  const t = useT();
  const amount = text.match(/₹\s?[\d,]+/)?.[0].replace(/₹\s?/, '') ?? null;
  return (
    <div className="pay-app">
      <div className="pay-topbar"><span className="dot">₹</span> UPI</div>
      <div style={{ flex: 1 }} />
      <div className="pay-sheet" style={{ marginTop: 0 }}>
        <div className="pay-label">⬇ {t('collectRequest')}</div>
        <div className="pay-requester">
          <div className="pay-avatar">👤</div>
          <div><div style={{ fontWeight: 600 }}>{t('paymentRequest')}</div>{amount && <div className="pay-amount"><span className="cur">₹</span>{amount}</div>}</div>
        </div>
        <div className="pay-note">{text}</div>
        <div className="pay-pinbtn">🔒 {t('enterPin')}{amount ? ` · PAY ₹${amount}` : ''}</div>
      </div>
    </div>
  );
}

// ── Right-hand narrative / decision / red-flag panel ──────────────────────────
function Panel({ node, phase, flags, allFlags, reporting, onNext, onChoose }: {
  node: ScenarioNode; phase: CallPhase; flags: RedFlag[]; allFlags: boolean;
  reporting?: { label: LocalizedString; value: string }[]; onNext: (to?: string) => void; onChoose: (c: Choice) => void;
}) {
  const { locale } = useLang();
  const t = useT();
  const isHi = locale === 'hi';

  // A video-call narration: red flags stream here while the call plays on the device.
  if (node.type === 'narration' && node.channel === 'videocall') {
    const total = node.redFlags?.length ?? 0;
    if (phase !== 'connected') {
      return (
        <div className="panel-body center" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: 22, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}><Phone size={30} /></div>
          <p className="muted" style={{ maxWidth: 360, fontSize: 15 }}>{isHi ? 'ठग वीडियो कॉल कर रहा है। डिवाइस पर कॉल का उत्तर दें या अस्वीकार करें।' : 'The scammer is video-calling you. Answer or decline on the device to continue.'}</p>
        </div>
      );
    }
    return (
      <div className="panel-body">
        <div className="sit-label result-bad" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {t('redFlags')} <span style={{ marginLeft: 'auto', color: 'var(--muted-c)' }}>{flags.length}/{total}</span>
        </div>
        <ul className="flag-list" style={{ flex: 1, margin: 0 }}>
          {flags.map((f, i) => (
            <li key={i} style={{ padding: '14px 16px' }}><span className="flag-name" style={{ fontSize: 15 }}>{f.flag.replace(/_/g, ' ')}</span>{f.note && <div className="muted" style={{ fontSize: 14, marginTop: 3 }}>{L(f.note, locale)}</div>}</li>
          ))}
        </ul>
        <button className="primary" disabled={!allFlags} onClick={() => onNext(node.next)}>{t('next')} <ChevronRight size={15} style={{ verticalAlign: 'middle' }} /></button>
      </div>
    );
  }

  if (node.type === 'narration') {
    return (
      <div className="panel-body center">
        <div className="sit-label" style={{ color: 'var(--accent)' }}>{isHi ? 'स्थिति' : 'Situation'}</div>
        <p style={{ margin: 0, lineHeight: 1.6, fontSize: 17 }}>{L(node.content, locale)}</p>
        <button className="primary" style={{ alignSelf: 'flex-start', padding: '12px 22px' }} onClick={() => onNext(node.next)}>{t('next')} <ChevronRight size={15} style={{ verticalAlign: 'middle' }} /></button>
      </div>
    );
  }

  if (node.type === 'decision') {
    return (
      <div className="panel-body center">
        <div className="sit-label result-neutral">{isHi ? 'कार्रवाई आवश्यक' : 'Action Required'}</div>
        <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.55, fontSize: 19 }}>{L(node.prompt, locale)}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          {node.choices?.map((c, i) => (
            <button key={i} className="choice-btn" onClick={() => onChoose(c)}>{L(c.label, locale)}</button>
          ))}
        </div>
      </div>
    );
  }

  if (node.type === 'consequence') {
    const cls = node.outcome === 'positive' ? 'result-good' : node.outcome === 'negative' ? 'result-bad' : 'result-neutral';
    return (
      <div className={`panel-body center ${node.anim === 'shake' ? 'shake' : node.anim === 'check-pop' ? 'check-pop' : ''}`}>
        <div className={`sit-label ${cls}`}>{isHi ? 'परिणाम' : 'Outcome'}</div>
        <p className={cls} style={{ margin: 0, lineHeight: 1.6, fontSize: 17 }}>
          {node.outcome === 'positive' ? '✓ ' : node.outcome === 'negative' ? '✗ ' : '• '}{L(node.content, locale)}
        </p>
        {node.technique && (
          <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div className="muted sit-label">{isHi ? 'धोखाधड़ी तकनीक' : 'Fraud technique'}</div>
            <p style={{ margin: '8px 0 0', fontSize: 15 }}>{L(node.technique, locale)}</p>
          </div>
        )}
        <button className="primary" style={{ alignSelf: 'flex-start', padding: '12px 22px' }} onClick={() => onNext(node.next)}>{t('next')} <ChevronRight size={15} style={{ verticalAlign: 'middle' }} /></button>
      </div>
    );
  }

  // checklist / feedback
  return (
    <div className="panel-body center">
      <div className="sit-label result-good" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={16} /> {L(node.title, locale)}</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>{node.items?.map((it, i) => <li key={i} style={{ marginBottom: 10, fontSize: 15.5, lineHeight: 1.5 }}>{L(it, locale)}</li>)}</ul>
      {reporting && (
        <div className="row" style={{ fontSize: 13 }}>
          <span className="muted">{t('report')}:</span>
          {reporting.map((r) => <span key={r.value} className="chip">{L(r.label, locale)}: <b>{r.value}</b></span>)}
        </div>
      )}
      <button className="primary" style={{ alignSelf: 'flex-start', padding: '12px 22px' }} onClick={() => onNext(node.next)}>{t('quiz')} <ChevronRight size={15} style={{ verticalAlign: 'middle' }} /></button>
    </div>
  );
}
