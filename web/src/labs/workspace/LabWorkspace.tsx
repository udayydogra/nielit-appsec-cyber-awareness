import { useEffect, useRef, type ReactNode } from 'react';
import { LogOut, Target, TerminalSquare, Bug } from 'lucide-react';
import { api } from '../../api/client';
import { WindowManager, useWM, type Win } from './wm';
import { DraggableWindow } from './DraggableWindow';
import { Taskbar, type AppDef } from './Taskbar';
import { LabTerminal } from './LabTerminal';
import { Missions, type Mission } from './Missions';
import './workspace.css';

// The immersive lab workspace launched by "Go to Lab". A windowed desktop with a
// Missions panel and either the live container terminal (Tier 3) or the exploit
// console (Tier 2). Spawns / reaps the Tier-3 container; the global mentor FAB
// floats above (z 40 > 36) so Sathi stays reachable for hints.
export function LabWorkspace({ labId, title, tier, widget, missions, onExit }: {
  labId: string; title: string; tier: number; widget: ReactNode | null; missions: Mission[]; onExit: () => void;
}) {
  const isContainer = tier === 3;
  // One logical "lab session" that survives a StrictMode unmount→remount. We must
  // dedupe start(): the backend slot claim is a global concurrency counter, not a
  // per-slot mutex, so two racing start()s each `docker run` and orphan a container.
  const session = useRef<{ started: Promise<unknown> } | null>(null);
  const pendingStop = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Cancel a teardown queued by a just-prior unmount (StrictMode double-mount, or a
    // student who exits then immediately re-enters) — we're keeping this session.
    if (pendingStop.current) { clearTimeout(pendingStop.current); pendingStop.current = null; }

    // Start exactly once per session. Keep the promise so stop can chain AFTER it and
    // never race ahead of the container being recorded (which would orphan it).
    if (!session.current) session.current = { started: api.start(labId).catch(() => {}) };

    const hb = isContainer
      ? setInterval(() => api.heartbeat(labId).catch(() => {}), 45000)
      : null;

    return () => {
      if (hb) clearInterval(hb);
      if (!isContainer) return; // Tier<3 start() just resets a shared sandbox — nothing to reap.
      const s = session.current;
      // Defer the kill: a StrictMode remount fires synchronously and cancels it; a real
      // exit lets it run, stopping the container once start() has finished recording it.
      pendingStop.current = setTimeout(() => {
        s?.started.finally(() => api.stop(labId).catch(() => {}));
        session.current = null;
      }, 400);
    };
  }, [labId, isContainer]);

  const panes: Record<string, { icon: ReactNode; dark?: boolean; node: ReactNode }> = {
    missions: { icon: <Target size={13} />, node: <Missions missions={missions} /> },
    ...(isContainer
      ? { terminal: { icon: <TerminalSquare size={13} />, dark: true, node: <LabTerminal labId={labId} /> } }
      : { exploit: { icon: <Bug size={13} />, node: widget } }),
  };
  const apps: AppDef[] = [
    { id: 'missions', title: 'Missions', icon: <Target size={17} />, w: 400, h: 540 },
    isContainer
      ? { id: 'terminal', title: 'Terminal', icon: <TerminalSquare size={17} />, w: 780, h: 520 }
      : { id: 'exploit', title: 'Exploit Console', icon: <Bug size={17} />, w: 780, h: 560 },
  ];
  const initial = [
    { t: 'open' as const, id: apps[1].id, title: apps[1].title, w: apps[1].w, h: apps[1].h },
    { t: 'open' as const, id: 'missions', title: 'Missions', w: 400, h: 540 },
  ];

  return (
    <div className="lab-workspace">
      <div className="ws-bg"><span className="ws-glow g1" /><span className="ws-glow g2" /></div>
      <div className="ws-topbar">
        <span className="title">{title}</span>
        <span className="badge">{isContainer ? '● live container' : 'shared target'}</span>
        <button className="ws-exit" onClick={onExit}><LogOut size={14} /> Exit Lab</button>
      </div>
      <WindowManager initial={initial}>
        <Desktop panes={panes} apps={apps} />
      </WindowManager>
    </div>
  );
}

function Desktop({ panes, apps }: { panes: Record<string, { icon: ReactNode; dark?: boolean; node: ReactNode }>; apps: AppDef[] }) {
  const wm = useWM();
  return (
    <>
      <div className="ws-windows">
        {wm.windows.map((w: Win) => (
          <DraggableWindow key={w.id} id={w.id} icon={panes[w.id]?.icon} dark={panes[w.id]?.dark}>
            {panes[w.id]?.node ?? null}
          </DraggableWindow>
        ))}
      </div>
      <Taskbar apps={apps} />
    </>
  );
}
