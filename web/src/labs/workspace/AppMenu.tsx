import { type ReactNode, useEffect } from 'react';
import { ShieldCheck, Power } from 'lucide-react';
import { useWM } from './wm';
import type { AppDef } from './Taskbar';

// The "start" / app menu: a launcher grid of every app, opened from the taskbar
// shield. Clicking an app opens or focuses its window and closes the menu.
export function AppMenu({ apps, labTitle, onClose, onExit }: {
  apps: AppDef[]; labTitle: string; onClose: () => void; onExit: () => void;
}) {
  const wm = useWM();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  function launch(a: AppDef) {
    wm.dispatch({ t: 'open', id: a.id, title: a.title, w: a.w, h: a.h });
    onClose();
  }

  return (
    <>
      <div className="ws-appmenu-scrim" onClick={onClose} />
      <div className="ws-appmenu" role="menu">
        <div className="ws-appmenu-head">
          <ShieldCheck size={18} />
          <div>
            <div className="am-title">NIELIT AppSec Lab</div>
            <div className="am-sub">{labTitle}</div>
          </div>
        </div>
        <div className="ws-appmenu-grid">
          {apps.map((a) => (
            <button key={a.id} className="am-app" onClick={() => launch(a)}>
              <span className="am-ico">{a.icon as ReactNode}</span>
              <span className="am-lbl">{a.title}</span>
            </button>
          ))}
        </div>
        <div className="ws-appmenu-foot">
          <button className="am-power" onClick={() => { onClose(); onExit(); }}><Power size={14} /> Exit Lab</button>
        </div>
      </div>
    </>
  );
}
