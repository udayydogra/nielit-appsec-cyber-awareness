import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useWM } from './wm';

export interface AppDef { id: string; title: string; icon: ReactNode; w?: number; h?: number; }

export function Taskbar({ apps }: { apps: AppDef[] }) {
  const wm = useWM();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div className="ws-taskbar">
      <button className="tb-start" title="NIELIT AppSec Lab"><ShieldCheck size={19} /></button>
      <div className="tb-apps">
        {apps.map((a) => (
          <button key={a.id} className="tb-app" title={a.title}
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
      <div className="tb-clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}
