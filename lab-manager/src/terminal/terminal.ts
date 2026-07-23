// Browser-terminal transport: xterm.js ↔ WebSocket ↔ `docker exec`. The WS upgrade
// is authenticated from the SAME signed session cookie (never a client header), and
// authorised by container OWNERSHIP — a student cannot attach to another student's
// Tier-3 container (infra-level IDOR). We allocate a real pty (node-pty) and run
// `docker exec -it`, so the in-container shell is fully interactive: Tab-completion,
// history, arrow keys and Ctrl-C are handled by the shell itself, not faked client-side.
import type { Server } from 'node:http';
import * as pty from 'node-pty';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getSlotRecord } from '../redis.js';
import { slotId, slotOwner } from '../containers/ContainerManager.js';
import { emit } from '../telemetry/pipeline.js';

const PATH_RE = /^\/labs\/([a-z0-9-]+)\/terminal$/;

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function attachTerminal(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const m = PATH_RE.exec(url.pathname);
      if (!m) return socket.destroy();
      const labId = m[1];

      // Authenticate from the signed session cookie.
      const token = parseCookie(req.headers.cookie, config.sessionCookieName);
      if (!token) return socket.destroy();
      let userId: string;
      try { userId = (jwt.verify(token, config.jwtSecret) as { sub: string }).sub; }
      catch { return socket.destroy(); }

      // Authorise by ownership of the running Tier-3 slot.
      const slot = slotId(userId, labId);
      const owner = await slotOwner(slot);
      if (owner !== userId) return socket.destroy();
      const rec = await getSlotRecord(slot);
      const containerId = rec.containerId;
      if (!containerId || containerId === 'unavailable') return socket.destroy();

      wss.handleUpgrade(req, socket, head, (ws) => {
        bridge(ws, containerId, userId, labId);
      });
    } catch {
      socket.destroy();
    }
  });
}

function bridge(ws: WebSocket, containerId: string, userId: string, labId: string): void {
  // A real pty around `docker exec -it` → the container's shell runs interactively.
  // Exec as root (-u 0) so students can `apt install` tools on their own box; host
  // privilege-escalation is still blocked by cap-drop + no-new-privileges (+ gVisor
  // in prod). Prefer bash where present, fall back to sh for the minimal images.
  const proc = pty.spawn('docker', ['exec', '-it', '-u', '0', containerId, '/bin/sh', '-c', 'exec bash 2>/dev/null || exec sh'], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });
  emit({ userId, labId, type: 'lab_started', outcome: 'neutral', payload: { terminal: true } }).catch(() => {});

  const onData = proc.onData((d) => ws.readyState === WebSocket.OPEN && ws.send(d));
  const onExit = proc.onExit(() => ws.readyState === WebSocket.OPEN && ws.close());

  // Client → server is JSON-framed: {i:"keystrokes"} for input, {r:[cols,rows]} to resize.
  ws.on('message', (data) => {
    let msg: { i?: string; r?: [number, number] };
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (typeof msg.i === 'string') proc.write(msg.i);
    else if (Array.isArray(msg.r)) { try { proc.resize(msg.r[0], msg.r[1]); } catch { /* not ready */ } }
  });
  const cleanup = () => { try { onData.dispose(); onExit.dispose(); proc.kill(); } catch { /* gone */ } };
  ws.on('close', cleanup);
  ws.on('error', cleanup);

  // Greet with a hint so the terminal isn't a blank box; the shell prompt follows.
  ws.send('\x1b[36m# connected to your ephemeral container — try:  cat /challenge/README\x1b[0m\r\n');
}
