// Real auth flow: credential check → issue signed session. Password hashing via
// bcrypt. Identity thereafter derives from the signed cookie (auth/session.ts).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one } from '../db.js';
import { issueSession, clearSession, requireAuth } from '../auth/session.js';
import { loadRolesAndPermissions } from '../authz/permissions.js';
import { audit } from '../authz/audit.js';
import { ah } from '../middleware/asyncHandler.js';

export const authRouter = Router();

authRouter.post('/login', ah(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password required' });
  }
  const user = await one<{ id: string; email: string; password_hash: string; display_name: string; locale: string; status: string }>(
    `SELECT id, email, password_hash, display_name, locale, status FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  // Constant-ish response: same error whether user missing or password wrong (no enum).
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) {
    await audit(user?.id ?? null, 'auth.login.fail', email, {});
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (user.status === 'deactivated') {
    await audit(user.id, 'auth.login.deactivated', email, {});
    return res.status(403).json({ error: 'this account has been deactivated' });
  }
  issueSession(res, user.id, user.email);
  await audit(user.id, 'auth.login.ok', user.email, {});
  // Return the FULL authed user (roles + permissions), same shape as /auth/me, so the
  // client can gate admin UI immediately without a second round-trip.
  const { roles, permissions } = await loadRolesAndPermissions(user.id);
  res.json({
    id: user.id, email: user.email, displayName: user.display_name, locale: user.locale,
    roles, permissions,
  });
}));

authRouter.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});
