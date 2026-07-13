// Scope resolvers are the anti-BOLA layer. A permission says "can generate reports";
// the resolver says "…only for a learner in a cohort I own." BOTH must pass (§10).
import { one } from '../db.js';
import type { AuthedUser } from '../types.js';

export interface ScopeContext {
  // the target resource owner, when the action is about another user's data
  targetUserId?: string;
  // the container id, for containerOwnerScope
  containerId?: string;
}

// selfScope — students. Structurally removes IDOR: the id comes from the session,
// never the URL. A route using selfScope must resolve its target from req.user.id.
export function selfScope(user: AuthedUser, ctx: ScopeContext): boolean {
  if (!ctx.targetUserId) return true; // no cross-user target → self by construction
  return ctx.targetUserId === user.id;
}

// cohortScope — instructors/trainees. Target learner must be in a cohort the caller
// is assigned to as an instructor. Cohort = the NIELIT batch, the boundary object.
export async function cohortScope(user: AuthedUser, ctx: ScopeContext): Promise<boolean> {
  if (!ctx.targetUserId) return false;
  if (ctx.targetUserId === user.id) return true;
  const row = await one<{ ok: boolean }>(
    `SELECT true AS ok
       FROM cohort_members me
       JOIN cohort_members target ON target.cohort_id = me.cohort_id
      WHERE me.user_id = $1 AND me.role = 'instructor'
        AND target.user_id = $2 AND target.role = 'learner'
      LIMIT 1`,
    [user.id, ctx.targetUserId],
  );
  return !!row;
}

// containerOwnerScope — a student can't reach/kill another student's Tier-3
// container (infra-level IDOR / authz-gap DoS). Ownership is checked against the
// container record's owner tag.
export async function containerOwnerScope(
  user: AuthedUser,
  ownerId: string | undefined,
): Promise<boolean> {
  if (!ownerId) return false;
  if (ownerId === user.id) return true;
  // admins may manage any container (for reaping/ops)
  return user.roles.includes('admin');
}
