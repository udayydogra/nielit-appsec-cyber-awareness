// Browser-terminal transport: xterm.js ↔ WebSocket ↔ `docker exec`. The WS upgrade
// is authenticated from the SAME signed session cookie (never a client header), and
// authorised by container OWNERSHIP — a student cannot attach to another student's
// Tier-3 container (infra-level IDOR). We use `docker exec -i sh` (no pty; the
// client does line editing) so no native pty dependency is needed.
import type { Server } from 'node:http';
import { spawn } from 'node:child_process';
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
  // Interactive shell inside the already-hardened container.
  const proc = spawn('docker', ['exec', '-i', containerId, '/bin/sh'], { stdio: ['pipe', 'pipe', 'pipe'] });
  emit({ userId, labId, type: 'lab_started', outcome: 'neutral', payload: { terminal: true } }).catch(() => {});

  proc.stdout.on('data', (d) => ws.readyState === WebSocket.OPEN && ws.send(d.toString()));
  proc.stderr.on('data', (d) => ws.readyState === WebSocket.OPEN && ws.send(d.toString()));
  proc.on('exit', () => ws.readyState === WebSocket.OPEN && ws.close());

  ws.on('message', (data) => {
    if (proc.stdin.writable) proc.stdin.write(data.toString());
  });
  ws.on('close', () => { try { proc.stdin.end(); proc.kill('SIGKILL'); } catch { /* gone */ } });
  ws.on('error', () => { try { proc.kill('SIGKILL'); } catch { /* gone */ } });

  // Greet with the challenge README so the terminal isn't a blank box.
  ws.send('\x1b[36m# connected to your ephemeral container — try:  cat /challenge/README\x1b[0m\r\n');
}
