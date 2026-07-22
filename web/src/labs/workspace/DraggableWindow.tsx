import { useRef, type ReactNode } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { useWM } from './wm';

// Adapted from the prototype: pointer-drag, focus/z-order, minimize/maximize/close.
export function DraggableWindow({ id, icon, dark, children }: {
  id: string; icon?: ReactNode; dark?: boolean; children: ReactNode;
}) {
  const wm = useWM();
  const w = wm.windows.find((x) => x.id === id);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const off = useRef({ x: 0, y: 0 });
  if (!w) return null;
  const active = wm.activeId === id;

  function down(e: React.PointerEvent) {
    wm.dispatch({ t: 'focus', id });
    if ((e.target as HTMLElement).closest('.ws-win-ctrls')) return;
    if (w!.maximized) return;
    dragging.current = true;
    const r = ref.current!.getBoundingClientRect();
    off.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!dragging.current) return;
    wm.dispatch({ t: 'move', id, x: e.clientX - off.current.x, y: Math.max(0, e.clientY - off.current.y) });
  }
  function up(e: React.PointerEvent) { dragging.current = false; (e.target as HTMLElement).releasePointerCapture(e.pointerId); }

  const style: React.CSSProperties = w.maximized
    ? { display: w.minimized ? 'none' : 'flex', top: 0, left: 0, width: '100vw', height: 'calc(100vh - 48px)', zIndex: w.z }
    : { display: w.minimized ? 'none' : 'flex', top: w.y, left: w.x, width: w.width, height: w.height, zIndex: w.z };

  return (
    <div ref={ref} className={`ws-win ${active ? 'active' : ''}`} style={style} onPointerDown={() => wm.dispatch({ t: 'focus', id })}>
      <div className="ws-win-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={() => wm.dispatch({ t: 'max', id })}>
        <span className="t">{icon}{w.title}</span>
        <span className="ws-win-ctrls">
          <button onClick={() => wm.dispatch({ t: 'min', id })}><Minus size={14} /></button>
          <button onClick={() => wm.dispatch({ t: 'max', id })}><Square size={12} /></button>
          <button className="close" onClick={() => wm.dispatch({ t: 'close', id })}><X size={14} /></button>
        </span>
      </div>
      <div className={`ws-win-body ${dark ? 'dark' : ''}`}>{children}</div>
    </div>
  );
}
