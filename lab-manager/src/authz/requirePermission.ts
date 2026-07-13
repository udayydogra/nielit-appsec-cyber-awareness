// Deny-by-default middleware. Check PERMISSIONS, not roles (§10 rule 1), then run
// the scope resolver (§10 rule 2). BOTH must pass. This is the single enforcement
// point every protected route flows through.
import type { Request, Response, NextFunction } from 'express';
import type { Permission } from './permissions.js';
import { selfScope, cohortScope, containerOwnerScope, type ScopeContext } from './scopes.js';
import { audit } from './audit.js';

type ScopeKind = 'self' | 'cohort' | 'none';

interface Options {
  scope?: ScopeKind;
  // extracts the cross-user target id from the request (URL param, body, etc.)
  targetUserId?: (req: Request) => string | undefined;
}

export function requirePermission(permission: Permission, opts: Options = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'authentication required' });

    if (!user.permissions.includes(permission)) {
      await audit(user.id, 'authz.deny.permission', permission, { path: req.path });
      return res.status(403).json({ error: 'forbidden', missing: permission });
    }

    const scope = opts.scope ?? 'none';
    if (scope !== 'none') {
      const ctx: ScopeContext = { targetUserId: opts.targetUserId?.(req) };
      const ok = scope === 'self' ? selfScope(user, ctx) : await cohortScope(user, ctx);
      if (!ok) {
        await audit(user.id, 'authz.deny.scope', permission, {
          path: req.path,
          scope,
          target: ctx.targetUserId,
        });
        return res.status(403).json({ error: 'forbidden', scope });
      }
      // cross-user read/write that passed scope → audit it
      if (ctx.targetUserId && ctx.targetUserId !== user.id) {
        await audit(user.id, 'authz.cross_user', permission, { target: ctx.targetUserId });
      }
    }
    next();
  };
}

export { containerOwnerScope };
