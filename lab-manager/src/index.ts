// Wires session + routes + reaper + graceful shutdown.
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config.js';
import { sessionMiddleware } from './auth/session.js';
import { authRouter } from './routes/auth.js';
import { labsRouter } from './routes/labs.js';
import { meRouter } from './routes/me.js';
import { mentorRouter } from './routes/mentor.js';
import { verifyCertificate } from './certs/certificates.js';
import { mentorService } from './mentor/MentorService.js';
import { ah, errorHandler } from './middleware/asyncHandler.js';
import { loadAllManifests } from './manifests.js';
import { startReaper } from './containers/reaper.js';
import { attachTerminal } from './terminal/terminal.js';
import { redis } from './redis.js';
import { pool } from './db.js';

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.env === 'production' ? true : ['http://localhost:5173', 'http://localhost:8080'],
    credentials: true,
  }),
);
app.use(sessionMiddleware);

// Health — no auth.
app.get('/health', ah(async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ ok: true, mentor: mentorService.providerName });
  } catch (err) {
    res.status(503).json({ ok: false, error: (err as Error).message });
  }
}));

// Public certificate verification — no auth (§11).
app.get('/verify/:certId', ah(async (req, res) => {
  const result = await verifyCertificate(req.params.certId);
  if (!('valid' in result) || !result.valid) return res.status(404).json({ valid: false });
  res.json(result);
}));

app.use('/auth', authRouter);
app.use('/labs', labsRouter);
app.use('/me', meRouter);
app.use('/mentor', mentorRouter);

// Last-resort error handler — turns an uncaught async error into a 500, not a crash.
app.use(errorHandler);

// Validate all manifests at boot (fail fast on a bad content file).
const manifests = loadAllManifests();
console.log(`[boot] loaded ${manifests.length} lab manifest(s): ${manifests.map((m) => m.id).join(', ')}`);

const reaper = startReaper();

// Final safety net: a stray rejection (fire-and-forget telemetry, reaper, etc.)
// should be logged, never take the whole platform down.
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

const server = app.listen(config.port, () => {
  console.log(`[boot] lab-manager listening on :${config.port} (mentor=${config.mentor.provider})`);
});

// Tier-3 browser-terminal transport (xterm ↔ WS ↔ docker exec), ownership-scoped.
attachTerminal(server);

async function shutdown(signal: string) {
  console.log(`\n[shutdown] ${signal} — draining`);
  clearInterval(reaper);
  server.close();
  await redis.quit().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
