// Real auth flow: credential check → issue signed session. Password hashing via
// bcrypt. Identity thereafter derives from the signed cookie (auth/session.ts).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one } from '../db.js';
import { issueSession, clearSession, requireAuth } from '../auth/session.js';
import { loadRolesAndPermissions } from '../authz/permissions.js';
import { audit } from '../authz/audit.js';
import { ah } from '../middleware/asyncHandler.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { config } from '../config.js';

export const authRouter = Router();

// Throttle login attempts per client (security review #4 — brute-force / no-lockout).
authRouter.post('/login', rateLimit('login', config.rateLimits.loginPerMin), ah(async (req, res) => {
  // `email` accepts either the email address or the login username (the import
  // "unique id"). Keep the field name for backwards compatibility with the client.
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password required' });
  }
  const ident = email.trim();
  const user = await one<{
    id: string; email: string; username: string | null; password_hash: string;
    display_name: string; locale: string; status: string;
    password_expires_at: string | null; must_change_password: boolean;
  }>(
    `SELECT id, email, username, password_hash, display_name, locale, status,
            password_expires_at, must_change_password
       FROM users
      WHERE email = $1 OR (username IS NOT NULL AND lower(username) = lower($2))`,
    [ident.toLowerCase(), ident],
  );
  // Constant-ish response: same error whether user missing or password wrong (no enum).
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok) {
    await audit(user?.id ?? null, 'auth.login.fail', ident, {});
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (user.status === 'deactivated') {
    await audit(user.id, 'auth.login.deactivated', ident, {});
    return res.status(403).json({ error: 'this account has been deactivated' });
  }
  // A temporary (emailed) password stops working once its window elapses.
  if (user.password_expires_at && new Date(user.password_expires_at).getTime() < Date.now()) {
    await audit(user.id, 'auth.login.expired', ident, {});
    return res.status(403).json({ error: 'this temporary password has expired — ask your administrator to re-send your invitation' });
  }
  issueSession(res, user.id, user.email);
  await audit(user.id, 'auth.login.ok', user.email, {});
  // Return the FULL authed user (roles + permissions), same shape as /auth/me, so the
  // client can gate admin UI immediately without a second round-trip.
  const { roles, permissions } = await loadRolesAndPermissions(user.id);
  res.json({
    id: user.id, email: user.email, username: user.username, displayName: user.display_name,
    locale: user.locale, roles, permissions, mustChangePassword: user.must_change_password,
  });
}));

authRouter.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});
