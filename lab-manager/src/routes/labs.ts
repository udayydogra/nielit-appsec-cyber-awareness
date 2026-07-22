// Lab routes. The backend routes on executionTier: Tier 0/1 are content-only,
// Tier 2 hits the shared vulnerable app, Tier 3 lazily spawns a capped container
// (queues at capacity). Quizzes are server-graded; completion is server-verified.
import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { requirePermission, containerOwnerScope } from '../authz/requirePermission.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ah } from '../middleware/asyncHandler.js';
import { getManifest, publicManifest } from '../manifests.js';
import { listCatalogue } from '../modules/store.js';
import { emit } from '../telemetry/pipeline.js';
import { gradeQuiz } from '../scoring/scoring.js';
import { issueCertificate } from '../certs/certificates.js';
import { resetSqli, sqliLogin } from '../vulnapp/sqli.js';
import { resetIdor, fetchInvoice, SESSION_PERSONA } from '../vulnapp/idor.js';
import { resetXss, addComment, listComments } from '../vulnapp/xss.js';
import { resetCsrf, getProfile, changeEmail, changeEmailSecure, issueCsrfToken } from '../vulnapp/csrf.js';
import { resetAuth, labLogin } from '../vulnapp/authlab.js';
import { issuedToken, decodeToken, whoami } from '../vulnapp/session.js';
import { resetBola, getOrder, cancelOrder } from '../vulnapp/bola.js';
import { checkout } from '../vulnapp/bizlogic.js';
import { resetRace, getBalance, withdraw } from '../vulnapp/race.js';
import { resetApi, getProfile as getApiProfile, patchProfile } from '../vulnapp/apisec.js';
import { chat as llmChat } from '../vulnapp/llm.js';
import { validateUpload, type TrueType } from '../vulnapp/fileupload.js';
import { runCloud } from '../vulnapp/cloud.js';
import { startContainer, heartbeat, stopContainer, slotOwner, slotId } from '../containers/ContainerManager.js';
import { config } from '../config.js';

export const labsRouter = Router();

// Catalogue — public metadata for both modules.
labsRouter.get('/', ah(async (_req, res) => {
  // Enabled built-in + authored modules, in admin-defined order.
  const all = (await listCatalogue(true)).map((m) => ({
    id: m.id, module: m.module, executionTier: m.executionTier,
    category: m.category, title: m.title, summary: m.summary,
  }));
  res.json(all);
}));

// Full manifest (safe to ship — answer keys live only in quiz_keys).
labsRouter.get('/:id', requireAuth, requirePermission('lab:access'), (req, res) => {
  const m = getManifest(req.params.id);
  if (!m) return res.status(404).json({ error: 'unknown lab' });
  res.json(publicManifest(m));
});

// Start — routes on tier. Tier 3 lazily spawns (queues at capacity).
labsRouter.post(
  '/:id/start',
  requireAuth,
  requirePermission('lab:access'),
  rateLimit('lab_start', config.rateLimits.labStartPerMin),
  ah(async (req, res) => {
    const m = getManifest(req.params.id);
    if (!m) return res.status(404).json({ error: 'unknown lab' });
    const user = req.user!;
    await emit({ userId: user.id, labId: m.id, type: 'lab_started', outcome: 'neutral' });

    if (m.executionTier <= 1) {
      return res.json({ tier: m.executionTier, mode: 'content' });
    }
    if (m.executionTier === 2) {
      if (m.id === 'sqli') await resetSqli(user.id); // fresh per-user rows
      if (m.id === 'idor') await resetIdor(user.id);
      if (m.id === 'xss') await resetXss(user.id);
      if (m.id === 'csrf') await resetCsrf(user.id);
      if (m.id === 'auth') await resetAuth(user.id);
      if (m.id === 'bola') await resetBola(user.id);
      if (m.id === 'race-condition') await resetRace(user.id);
      if (m.id === 'api-security') await resetApi(user.id);
      return res.json({ tier: 2, mode: 'shared-app', reset: true });
    }
    // Tier 3
    const image = `nielit/${m.id}:latest`;
    const result = await startContainer(user.id, m.id, image);
    if (result.status === 'queued') {
      return res.status(202).json({ tier: 3, status: 'queued' });
    }
    return res.json({ tier: 3, status: result.status, containerId: result.containerId });
  }),
);

labsRouter.post('/:id/heartbeat', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await heartbeat(req.user!.id, req.params.id);
  res.json({ ok: true });
}));

// Stop — ownership-scoped: a student can't kill another student's container.
labsRouter.post('/:id/stop', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const slot = slotId(req.user!.id, req.params.id);
  const owner = await slotOwner(slot);
  if (!(await containerOwnerScope(req.user!, owner))) {
    return res.status(403).json({ error: 'not your container' });
  }
  await stopContainer(slot);
  res.json({ ok: true });
}));

// ── Tier-2 SQLi vulnerable endpoints ─────────────────────────────────────────
labsRouter.post('/sqli/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetSqli(req.user!.id);
  res.json({ ok: true });
}));

labsRouter.post('/sqli/login', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { username, password } = req.body ?? {};
  const result = await sqliLogin(req.user!.id, String(username ?? ''), String(password ?? ''));
  res.json(result);
}));

// ── Tier-2 IDOR vulnerable endpoints ─────────────────────────────────────────
labsRouter.post('/idor/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetIdor(req.user!.id);
  res.json({ ok: true, persona: SESSION_PERSONA });
}));

// GET an invoice by id — deliberately missing the object-level ownership check.
labsRouter.get('/idor/invoice/:invoiceId', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const id = Number(req.params.invoiceId);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invoice id must be an integer' });
  const result = await fetchInvoice(req.user!.id, id);
  if (!result.found) return res.status(404).json({ found: false, persona: SESSION_PERSONA });
  res.json({ ...result, persona: SESSION_PERSONA });
}));

// ── Tier-2 Stored-XSS vulnerable endpoints ───────────────────────────────────
labsRouter.post('/xss/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetXss(req.user!.id);
  res.json({ ok: true });
}));
labsRouter.get('/xss/comments', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json(await listComments(req.user!.id)); // bodies returned RAW (rendered sandboxed on client)
}));
labsRouter.post('/xss/comment', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { author, body } = req.body ?? {};
  if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'body required' });
  const result = await addComment(req.user!.id, String(author ?? 'anon'), body);
  res.json({ ok: true, ...result });
}));

// ── Tier-2 CSRF vulnerable endpoints ─────────────────────────────────────────
labsRouter.post('/csrf/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetCsrf(req.user!.id);
  res.json(await getProfile(req.user!.id));
}));
labsRouter.get('/csrf/state', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json(await getProfile(req.user!.id));
}));
labsRouter.get('/csrf/token', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json({ token: await issueCsrfToken(req.user!.id) });
}));
// VULNERABLE: no token check. `forged` simulates the attacker-page request.
labsRouter.post('/csrf/change-email', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { email, forged } = req.body ?? {};
  if (typeof email !== 'string') return res.status(400).json({ error: 'email required' });
  const out = await changeEmail(req.user!.id, email, !!forged);
  res.json({ ...out, protected: false });
}));
// SECURE: requires the anti-CSRF token in a custom header.
labsRouter.post('/csrf/change-email-secure', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string') return res.status(400).json({ error: 'email required' });
  const ok = await changeEmailSecure(req.user!.id, email, req.header('x-csrf-token') ?? undefined);
  if (!ok) return res.status(403).json({ protected: true, error: 'missing/invalid CSRF token' });
  res.json({ ...(await getProfile(req.user!.id)), protected: true });
}));

// ── Tier-2 Broken-Auth vulnerable endpoints ──────────────────────────────────
labsRouter.post('/auth/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetAuth(req.user!.id);
  res.json({ ok: true });
}));
labsRouter.post('/auth/attempt', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { username, pin } = req.body ?? {};
  const result = await labLogin(req.user!.id, String(username ?? ''), String(pin ?? ''));
  res.json(result);
}));

// ── Tier-2 Session-Management endpoints ──────────────────────────────────────
labsRouter.get('/session/state', requireAuth, requirePermission('lab:access'), ah(async (_req, res) => {
  const token = issuedToken();
  res.json({ token, decoded: decodeToken(token) });
}));
labsRouter.get('/session/whoami', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json(await whoami(req.user!.id, String(req.query.token ?? '')));
}));

// ── Tier-2 BOLA (API) endpoints ──────────────────────────────────────────────
labsRouter.post('/bola/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetBola(req.user!.id); res.json({ ok: true });
}));
labsRouter.get('/bola/order/:id', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'order id must be an integer' });
  const r = await getOrder(req.user!.id, id);
  if (!r.found) return res.status(404).json({ found: false });
  res.json(r);
}));
labsRouter.post('/bola/order/:id/cancel', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'order id must be an integer' });
  const r = await cancelOrder(req.user!.id, id);
  if (!r.found) return res.status(404).json({ found: false });
  res.json(r);
}));

// ── Tier-2 Business-Logic endpoint ───────────────────────────────────────────
labsRouter.post('/business-logic/checkout', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { quantity, coupons } = req.body ?? {};
  res.json(await checkout(req.user!.id, quantity, coupons));
}));

// ── Tier-2 Race-Condition endpoints ──────────────────────────────────────────
labsRouter.post('/race-condition/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetRace(req.user!.id); res.json({ balance: await getBalance(req.user!.id) });
}));
labsRouter.get('/race-condition/balance', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json({ balance: await getBalance(req.user!.id) });
}));
labsRouter.post('/race-condition/withdraw', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json(await withdraw(req.user!.id));
}));

// ── Tier-2 API-Security endpoints ────────────────────────────────────────────
labsRouter.post('/api-security/reset', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  await resetApi(req.user!.id); res.json(await getApiProfile(req.user!.id));
}));
labsRouter.get('/api-security/profile', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json(await getApiProfile(req.user!.id)); // over-exposes internal fields
}));
labsRouter.patch('/api-security/profile', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  res.json(await patchProfile(req.user!.id, (req.body ?? {}) as Record<string, unknown>));
}));

// ── Tier-2 LLM-Security endpoint ─────────────────────────────────────────────
labsRouter.post('/llm-security/chat', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { message, hardened } = req.body ?? {};
  if (typeof message !== 'string') return res.status(400).json({ error: 'message required' });
  res.json(await llmChat(req.user!.id, message, !!hardened));
}));

// ── Tier-2 File-Upload endpoint ──────────────────────────────────────────────
labsRouter.post('/file-upload/upload', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { filename, contentType, trueType } = req.body ?? {};
  if (typeof filename !== 'string' || typeof contentType !== 'string') {
    return res.status(400).json({ error: 'filename and contentType required' });
  }
  res.json(await validateUpload(req.user!.id, filename, contentType, (trueType ?? 'benign') as TrueType));
}));

// ── Tier-1 Cloud-Security (simulated) endpoint ───────────────────────────────
labsRouter.post('/cloud-security/run', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const { command } = req.body ?? {};
  if (typeof command !== 'string') return res.status(400).json({ error: 'command required' });
  res.json(await runCloud(req.user!.id, command));
}));

// ── Awareness: record a verified decision (server-emitted event) ─────────────
// The client sends the DESTINATION node it navigated to; the server reads that
// node's outcome from the manifest itself — it never trusts a client-sent outcome.
labsRouter.post('/:id/decision', requireAuth, requirePermission('lab:access'), ah(async (req, res) => {
  const m = getManifest(req.params.id);
  if (!m || m.module !== 'awareness') return res.status(404).json({ error: 'unknown scenario' });
  const { nodeId } = req.body ?? {};
  const node = m.nodes?.[String(nodeId)];
  if (!node) return res.status(400).json({ error: 'unknown node' });
  const outcome = node.outcome ?? 'neutral';
  await emit({
    userId: req.user!.id, labId: m.id, type: 'decision_made',
    nodeId: String(nodeId), outcome,
  });
  res.json({ ok: true, outcome });
}));

// ── Quiz — server-graded; passing (re-verified) issues a signed certificate ──
labsRouter.post(
  '/:id/quiz',
  requireAuth,
  requirePermission('quiz:submit'),
  ah(async (req, res) => {
    const m = getManifest(req.params.id);
    if (!m) return res.status(404).json({ error: 'unknown lab' });
    const answers = (req.body?.answers ?? {}) as Record<string, string>;
    const graded = await gradeQuiz(req.user!.id, m.id, answers);

    let certificate = null;
    if (graded.passed) {
      // Certificate issued only on the server's OWN verified grade.
      certificate = await issueCertificate(req.user!.id, m.id, graded.score);
    }
    // correct map is fine to return (it's the grade, not the key), but never the key.
    res.json({ score: graded.score, maxScore: graded.maxScore, passed: graded.passed, correct: graded.correct, certificate });
  }),
);
