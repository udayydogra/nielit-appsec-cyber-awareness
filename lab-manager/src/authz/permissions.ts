// Roles + Permissions. Grants live in the DB (role_permissions) so they are DATA,
// not code — this file names the vocabulary and loads a user's effective set.
import { query } from '../db.js';

export type Role = 'student' | 'trainee' | 'instructor' | 'admin';

export type Permission =
  | 'lab:access' | 'mentor:chat' | 'quiz:submit' | 'score:self' | 'cert:self' | 'progress:self'
  | 'cohort:assign' | 'cohort:monitor' | 'cohort:review' | 'cohort:report'
  | 'module:edit' | 'scam-sim:create' | 'dataset:upload' | 'localization:manage'
  | 'prompt:tune' | 'user:manage' | 'role:assign' | 'provider:switch' | 'cert:issue' | 'audit:view';

// Resolve a user's roles + effective permissions from the DB (deny-by-default).
export async function loadRolesAndPermissions(
  userId: string,
): Promise<{ roles: string[]; permissions: string[] }> {
  const roleRows = await query<{ name: string }>(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
    [userId],
  );
  const permRows = await query<{ name: string }>(
    `SELECT DISTINCT p.name
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = $1`,
    [userId],
  );
  return {
    roles: roleRows.rows.map((r) => r.name),
    permissions: permRows.rows.map((r) => r.name),
  };
}
