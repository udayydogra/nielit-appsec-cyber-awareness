import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck, Wifi, Volume2, BatteryFull } from 'lucide-react';
import { useWM } from './wm';
import { AppMenu } from './AppMenu';

export interface AppDef {
  id: string; title: string; icon: ReactNode; w?: number; h?: number;
  pinned?: boolean;   // shown as a quick-launch button on the taskbar
  hidden?: boolean;   // not shown in the app menu (opened on demand, e.g. the text viewer)
}

export function Taskbar({ apps, labTitle, onExit }: { apps: AppDef[]; labTitle: string; onExit: () => void }) {
  const wm = useWM();
  const [now, setNow] = useState(new Date());
  const [menu, setMenu] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const pinned = apps.filter((a) => a.pinned);
  const menuApps = apps.filter((a) => !a.hidden);

  return (
    <>
      {menu && <AppMenu apps={menuApps} labTitle={labTitle} onClose={() => setMenu(false)} onExit={onExit} />}
      <div className="ws-taskbar">
        <button className={`tb-start ${menu ? 'active' : ''}`} title="Applications" onClick={() => setMenu((m) => !m)}>
          <ShieldCheck size={19} />
        </button>
        <div className="tb-apps">
          {pinned.map((a) => (
            <button key={a.id} className={`tb-app ${wm.windows.some((w) => w.id === a.id && !w.minimized) ? 'running' : ''}`} title={a.title}
              onClick={() => wm.dispatch({ t: 'open', id: a.id, title: a.title, w: a.w, h: a.h })}>
              {a.icon}
            </button>
          ))}
        </div>
        <div className="tb-open">
          {wm.windows.map((w) => (
            <button key={w.id} className={`tb-win ${wm.activeId === w.id && !w.minimized ? 'active' : ''}`}
              onClick={() => (wm.activeId === w.id && !w.minimized ? wm.dispatch({ t: 'min', id: w.id }) : wm.dispatch({ t: 'focus', id: w.id }))}>
              {w.title}
            </button>
          ))}
        </div>
        <div className="tb-tray">
          <Wifi size={14} /><Volume2 size={14} /><BatteryFull size={15} />
        </div>
        <div className="tb-clock">
          <div>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="tb-date">{now.toLocaleDateString([], { day: '2-digit', month: 'short' })}</div>
        </div>
      </div>
    </>
  );
}
