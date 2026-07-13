// :self-scoped routes. The id comes from the SESSION, never the URL — this
// structurally removes IDOR (there is no :userId to tamper with).
import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../authz/requirePermission.js';
import { ah } from '../middleware/asyncHandler.js';
import { getScore } from '../scoring/scoring.js';
import { getUserCertificate } from '../certs/certificates.js';
import { query } from '../db.js';

export const meRouter = Router();

meRouter.get('/scores/:labId', requireAuth, requirePermission('score:self'), ah(async (req, res) => {
  const row = await getScore(req.user!.id, req.params.labId);
  res.json(row ?? { score: 0, max_score: 0 });
}));

meRouter.get('/certificates/:labId', requireAuth, requirePermission('cert:self'), ah(async (req, res) => {
  const cert = await getUserCertificate(req.user!.id, req.params.labId);
  if (!cert) return res.status(404).json({ error: 'no certificate' });
  res.json(cert);
}));

meRouter.get('/progress', requireAuth, requirePermission('progress:self'), ah(async (req, res) => {
  const rows = await query<{ lab_id: string; completed: boolean; state: unknown }>(
    `SELECT lab_id, completed, state FROM progress WHERE user_id = $1`,
    [req.user!.id],
  );
  res.json(rows.rows);
}));
