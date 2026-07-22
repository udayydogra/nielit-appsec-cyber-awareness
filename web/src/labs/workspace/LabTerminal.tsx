import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// xterm wired to OUR backend terminal (xterm ↔ WebSocket ↔ a real pty around
// `docker exec -it` in the per-user Tier-3 container). The shell is interactive, so
// Tab-completion / history / arrows / Ctrl-C are handled server-side — the client is a
// raw passthrough (no faked line editing). Output is echoed back as `lab-signal`
// `term` chunks so Missions can auto-tick when the learner actually does each step,
// plus a dedicated `flag` signal when a flag{…} appears.
export function LabTerminal({ labId }: { labId: string }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mount.current) return;
    const term = new Terminal({
      cursorBlink: true, fontSize: 13.5,
      fontFamily: 'ui-monospace, Menlo, Monaco, "Courier New", monospace',
      theme: { background: '#0d1117', foreground: '#c9d1d9', cursor: '#58a6ff' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(mount.current);
    try { fit.fit(); } catch { /* not laid out */ }

    const base = (import.meta.env.VITE_API_BASE as string) || '/api';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}${base}/labs/${labId}/terminal`;

    // One xterm instance, but the socket may reconnect: a transient drop (or the
    // StrictMode dev double-mount churning the container) shouldn't strand the user.
    let ws: WebSocket | null = null;
    let disposed = false;   // set on unmount/exit — suppresses reconnects
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let seen = '';

    const sendResize = () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ r: [term.cols, term.rows] }));
    };

    function connect() {
      ws = new WebSocket(url);
      ws.onopen = () => sendResize();
      ws.onmessage = (e) => {
        attempts = 0; // a byte arrived — connection is healthy
        const data = typeof e.data === 'string' ? e.data : '';
        term.write(data);
        // Stream raw output to Missions for command-driven auto-completion.
        window.dispatchEvent(new CustomEvent('lab-signal', { detail: { labId, type: 'term', chunk: data } }));
        seen += data;
        const flag = seen.match(/flag\{[^}]*\}/);
        if (flag) window.dispatchEvent(new CustomEvent('lab-signal', { detail: { labId, type: 'flag', value: flag[0] } }));
      };
      ws.onclose = () => {
        if (disposed) return;
        if (attempts < 6) {
          attempts += 1;
          retryTimer = setTimeout(connect, 600);
        } else {
          term.write('\r\n\x1b[33m# session closed (container stopped or reaped)\x1b[0m\r\n');
        }
      };
      ws.onerror = () => { /* close handler drives the retry */ };
    }
    connect();

    // Raw passthrough: every keystroke (incl. Tab \t, arrows, Ctrl-C) goes to the pty,
    // which echoes and does its own line editing / completion.
    term.onData((d) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ i: d }));
    });

    const ro = new ResizeObserver(() => requestAnimationFrame(() => {
      try { fit.fit(); sendResize(); } catch { /* */ }
    }));
    ro.observe(mount.current);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ro.disconnect();
      ws?.close();
      term.dispose();
    };
  }, [labId]);

  return <div className="ws-term" ref={mount} />;
}
