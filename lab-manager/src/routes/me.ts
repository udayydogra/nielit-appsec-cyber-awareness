// :self-scoped routes. The id comes from the SESSION, never the URL — this
// structurally removes IDOR (there is no :userId to tamper with).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../authz/requirePermission.js';
import { ah } from '../middleware/asyncHandler.js';
import { getScore } from '../scoring/scoring.js';
import { getUserCertificate } from '../certs/certificates.js';
import { query, one } from '../db.js';
import { audit } from '../authz/audit.js';

export const meRouter = Router();

// ── Self-service profile & password (id from the session, never the URL) ───────
meRouter.patch('/profile', requireAuth, ah(async (req, res) => {
  const { displayName, locale } = req.body ?? {};
  if (typeof displayName === 'string' && displayName.trim()) {
    await query(`UPDATE users SET display_name = $2 WHERE id = $1`, [req.user!.id, displayName.trim()]);
  }
  if (locale === 'en' || locale === 'hi') {
    await query(`UPDATE users SET locale = $2 WHERE id = $1`, [req.user!.id, locale]);
  }
  const row = await one<{ display_name: string; locale: string }>(
    `SELECT display_name, locale FROM users WHERE id = $1`, [req.user!.id],
  );
  res.json({ displayName: row!.display_name, locale: row!.locale });
}));

meRouter.post('/password', requireAuth, ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'new password must be at least 8 characters' });
  }
  const row = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]);
  const ok = row ? await bcrypt.compare(String(currentPassword ?? ''), row.password_hash) : false;
  if (!ok) return res.status(403).json({ error: 'current password is incorrect' });
  // Setting a real password clears any temporary-password expiry and the change prompt.
  await query(
    `UPDATE users SET password_hash = $2, password_expires_at = NULL, must_change_password = false WHERE id = $1`,
    [req.user!.id, await bcrypt.hash(newPassword, 10)],
  );
  await audit(req.user!.id, 'user.password_change', req.user!.id, {});
  res.json({ ok: true });
}));

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
