import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogOut, Target, TerminalSquare, Bug, Globe, FolderClosed, StickyNote, FileText } from 'lucide-react';
import { api } from '../../api/client';
import { WindowManager, useWM, type Win } from './wm';
import { DraggableWindow } from './DraggableWindow';
import { Taskbar, type AppDef } from './Taskbar';
import { LabTerminal } from './LabTerminal';
import { Missions, type Mission } from './Missions';
import { Browser, FileManager, Notepad, TextViewer } from './DesktopApps';
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

  // The primary exercise window (id + label) depends on the tier.
  const primary: AppDef = isContainer
    ? { id: 'terminal', title: 'Terminal', icon: <TerminalSquare size={17} />, w: 780, h: 520, pinned: true }
    : { id: 'exploit', title: 'Exploit Console', icon: <Bug size={17} />, w: 780, h: 560, pinned: true };

  // The full app registry for this desktop — pinned apps sit on the taskbar, all of
  // them appear in the app (start) menu; the text viewer is opened on demand.
  const apps: AppDef[] = [
    primary,
    { id: 'missions', title: 'Missions', icon: <Target size={17} />, w: 400, h: 560, pinned: true },
    { id: 'browser', title: 'Browser', icon: <Globe size={17} />, w: 860, h: 580, pinned: true },
    { id: 'files', title: 'Files', icon: <FolderClosed size={17} />, w: 720, h: 460, pinned: true },
    { id: 'notes', title: 'Notepad', icon: <StickyNote size={17} />, w: 460, h: 420, pinned: true },
    { id: 'text', title: 'Text Viewer', icon: <FileText size={17} />, w: 560, h: 420, hidden: true },
  ];

  const initial = [
    { t: 'open' as const, id: primary.id, title: primary.title, w: primary.w, h: primary.h },
    { t: 'open' as const, id: 'missions', title: 'Missions', w: 400, h: 560 },
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
        <Desktop labId={labId} labTitle={title} isContainer={isContainer} widget={widget} missions={missions} apps={apps} onExit={onExit} />
      </WindowManager>
    </div>
  );
}

function Desktop({ labId, labTitle, isContainer, widget, missions, apps, onExit }: {
  labId: string; labTitle: string; isContainer: boolean; widget: ReactNode | null;
  missions: Mission[]; apps: AppDef[]; onExit: () => void;
}) {
  const wm = useWM();
  const [text, setText] = useState<{ title: string; content: string } | null>(null);
  const openText = (fileTitle: string, content: string) => {
    setText({ title: fileTitle, content });
    wm.dispatch({ t: 'open', id: 'text', title: fileTitle, w: 560, h: 420 });
  };

  // The node + chrome for each window id.
  const panes: Record<string, { icon: ReactNode; dark?: boolean; node: ReactNode }> = {
    // All the "OS apps" share one dark theme matching the terminal + desktop.
    missions: { icon: <Target size={13} />, dark: true, node: <Missions missions={missions} /> },
    browser: { icon: <Globe size={13} />, dark: true, node: <Browser labTitle={labTitle} /> },
    files: { icon: <FolderClosed size={13} />, dark: true, node: <FileManager onOpenFile={openText} /> },
    notes: { icon: <StickyNote size={13} />, dark: true, node: <Notepad /> },
    text: { icon: <FileText size={13} />, dark: true, node: <TextViewer data={text} /> },
    ...(isContainer
      ? { terminal: { icon: <TerminalSquare size={13} />, dark: true, node: <LabTerminal labId={labId} /> } }
      : { exploit: { icon: <Bug size={13} />, node: widget } }),
  };

  return (
    <>
      <div className="ws-windows">
        {wm.windows.map((w: Win) => (
          <DraggableWindow key={w.id} id={w.id} icon={panes[w.id]?.icon} dark={panes[w.id]?.dark}>
            {panes[w.id]?.node ?? null}
          </DraggableWindow>
        ))}
      </div>
      <Taskbar apps={apps} labTitle={labTitle} onExit={onExit} />
    </>
  );
}
