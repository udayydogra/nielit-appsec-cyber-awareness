// Identity is derived from a SIGNED session, never a client header. A student
// sending someone else's id would break every check — so we never read one.
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { loadRolesAndPermissions } from '../authz/permissions.js';
import { one } from '../db.js';
import type { AuthedUser } from '../types.js';

interface SessionClaims {
  sub: string; // user id
  email: string;
}

export function issueSession(res: Response, userId: string, email: string): string {
  const token = jwt.sign({ sub: userId, email } satisfies SessionClaims, config.jwtSecret, {
    expiresIn: '12h',
  });
  res.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  });
  return token;
}

export function clearSession(res: Response): void {
  res.clearCookie(config.sessionCookieName);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

// Attaches req.user from the signed cookie (or Bearer token). Never trusts a raw id.
export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = req.cookies?.[config.sessionCookieName] ?? bearer;
  if (!token) return next();
  try {
    const claims = jwt.verify(token, config.jwtSecret) as SessionClaims;
    const row = await one<{ id: string; email: string; display_name: string; locale: string }>(
      `SELECT id, email, display_name, locale FROM users WHERE id = $1`,
      [claims.sub],
    );
    if (!row) return next();
    const { roles, permissions } = await loadRolesAndPermissions(row.id);
    req.user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      locale: (row.locale === 'hi' ? 'hi' : 'en'),
      roles,
      permissions,
    };
  } catch {
    // invalid/expired token → treated as anonymous
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'authentication required' });
  next();
}
