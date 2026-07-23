// Admin console API — user lifecycle, batches (cohorts), and module authoring.
// Every route is permission-gated (deny-by-default) and every privileged write is
// audited. Identity is always from the session, never the URL.
import { Router, json } from 'express';
import bcrypt from 'bcryptjs';
import { query, one } from '../db.js';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../authz/requirePermission.js';
import { ah } from '../middleware/asyncHandler.js';
import { audit } from '../authz/audit.js';
import {
  listCatalogue, getEditable, createModule, updateModule, deleteModule, setSettings,
} from '../modules/store.js';
import { importUsers } from '../admin/bulkImport.js';
import { mailEnabled } from '../mail/mailer.js';
import type { LabManifest } from '../types.js';

export const adminRouter = Router();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const bad = (res: import('express').Response, msg: string) => res.status(400).json({ error: msg });

// ── Roles (for the create-user form) ─────────────────────────────────────────
adminRouter.get('/roles', requireAuth, requirePermission('user:manage'), ah(async (_req, res) => {
  const rows = await query<{ name: string }>(`SELECT name FROM roles ORDER BY id`);
  res.json(rows.rows.map((r) => r.name));
}));

// Whether outbound email is configured (so the UI can warn the admin to distribute
// credentials manually when it isn't).
adminRouter.get('/mail-status', requireAuth, requirePermission('user:manage'), (_req, res) => {
  res.json({ mailConfigured: mailEnabled });
});

// ── Bulk import (CSV / Excel) ──────────────────────────────────────────────────
// The file arrives base64-encoded in a JSON body (a few MB max — its own body limit,
// larger than the 256kb app-wide default). Creates users, optionally into a batch,
// generates temporary passwords, and emails credentials.
adminRouter.post('/users/import', json({ limit: '8mb' }), requireAuth, requirePermission('user:manage'), ah(async (req, res) => {
  const { filename, contentBase64, cohortName, cohortId, sendEmail } = req.body ?? {};
  if (typeof filename !== 'string' || typeof contentBase64 !== 'string' || !contentBase64) {
    return bad(res, 'filename and contentBase64 are required');
  }
  let buffer: Buffer;
  try { buffer = Buffer.from(contentBase64, 'base64'); } catch { return bad(res, 'contentBase64 is not valid base64'); }
  if (!buffer.length) return bad(res, 'file is empty');
  if (buffer.length > 6 * 1024 * 1024) return bad(res, 'file too large (max 6 MB)');
  try {
    const summary = await importUsers(req.user!.id, { filename, buffer }, {
      cohortName: typeof cohortName === 'string' ? cohortName : undefined,
      cohortId: typeof cohortId === 'string' ? cohortId : undefined,
      sendEmail: sendEmail !== false,
    });
    res.json(summary);
  } catch (e) { return bad(res, (e as Error).message); }
}));

// ── Users ────────────────────────────────────────────────────────────────────
adminRouter.get('/users', requireAuth, requirePermission('user:manage'), ah(async (_req, res) => {
  const rows = await query<{
    id: string; email: string; username: string | null; display_name: string; locale: string;
    status: string; created_at: string; roles: string[]; cohorts: string[];
  }>(
    `SELECT u.id, u.email, u.username, u.display_name, u.locale, u.status, u.created_at,
            COALESCE(ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
            COALESCE(ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '{}') AS cohorts
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN cohort_members cm ON cm.user_id = u.id
       LEFT JOIN cohorts c ON c.id = cm.cohort_id
      GROUP BY u.id
      ORDER BY u.created_at DESC`,
  );
  res.json(rows.rows.map((u) => ({
    id: u.id, email: u.email, username: u.username, displayName: u.display_name, locale: u.locale,
    status: u.status, createdAt: u.created_at, roles: u.roles, cohorts: u.cohorts,
  })));
}));

adminRouter.post('/users', requireAuth, requirePermission('user:manage'), ah(async (req, res) => {
  const { email, displayName, password, locale, roles } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) return bad(res, 'valid email required');
  if (typeof displayName !== 'string' || !displayName.trim()) return bad(res, 'display name required');
  if (typeof password !== 'string' || password.length < 8) return bad(res, 'password must be at least 8 characters');
  const roleNames: string[] = Array.isArray(roles) && roles.length ? roles : ['student'];

  const exists = await one(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (exists) return res.status(409).json({ error: 'a user with that email already exists' });
  // Assigning roles requires role:assign (beyond the default 'student').
  if (roleNames.some((r) => r !== 'student') && !req.user!.permissions.includes('role:assign')) {
    return res.status(403).json({ error: 'role:assign required to grant non-student roles' });
  }

  const hash = await bcrypt.hash(password, 10);
  const created = await one<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name, locale)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [email.toLowerCase(), hash, displayName.trim(), locale === 'hi' ? 'hi' : 'en'],
  );
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, r.id FROM roles r WHERE r.name = ANY($2)`,
    [created!.id, roleNames],
  );
  await audit(req.user!.id, 'user.create', created!.id, { email: email.toLowerCase(), roles: roleNames });
  res.status(201).json({ id: created!.id });
}));

adminRouter.patch('/users/:id', requireAuth, requirePermission('user:manage'), ah(async (req, res) => {
  const { id } = req.params;
  const { displayName, locale, roles } = req.body ?? {};
  const target = await one<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [id]);
  if (!target) return res.status(404).json({ error: 'user not found' });

  if (typeof displayName === 'string' && displayName.trim()) {
    await query(`UPDATE users SET display_name = $2 WHERE id = $1`, [id, displayName.trim()]);
  }
  if (locale === 'en' || locale === 'hi') {
    await query(`UPDATE users SET locale = $2 WHERE id = $1`, [id, locale]);
  }
  if (Array.isArray(roles)) {
    if (!req.user!.permissions.includes('role:assign')) {
      return res.status(403).json({ error: 'role:assign required to change roles' });
    }
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
    await query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, r.id FROM roles r WHERE r.name = ANY($2)`,
      [id, roles.length ? roles : ['student']],
    );
    await audit(req.user!.id, 'user.roles', id, { roles });
  }
  await audit(req.user!.id, 'user.update', id, {});
  res.json({ ok: true });
}));

adminRouter.post('/users/:id/deactivate', requireAuth, requirePermission('user:manage'), ah(async (req, res) => {
  const { id } = req.params;
  if (id === req.user!.id) return bad(res, 'you cannot deactivate your own account');
  const r = await query(`UPDATE users SET status = 'deactivated', deactivated_at = now() WHERE id = $1 AND status = 'active'`, [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'user not found or already deactivated' });
  await audit(req.user!.id, 'user.deactivate', id, {});
  res.json({ ok: true });
}));

adminRouter.post('/users/:id/reactivate', requireAuth, requirePermission('user:manage'), ah(async (req, res) => {
  const { id } = req.params;
  const r = await query(`UPDATE users SET status = 'active', deactivated_at = NULL WHERE id = $1`, [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'user not found' });
  await audit(req.user!.id, 'user.reactivate', id, {});
  res.json({ ok: true });
}));

// Hard-delete — only permitted once the account is deactivated (deactivate → delete).
adminRouter.delete('/users/:id', requireAuth, requirePermission('user:manage'), ah(async (req, res) => {
  const { id } = req.params;
  if (id === req.user!.id) return bad(res, 'you cannot delete your own account');
  const u = await one<{ status: string; email: string }>(`SELECT status, email FROM users WHERE id = $1`, [id]);
  if (!u) return res.status(404).json({ error: 'user not found' });
  if (u.status !== 'deactivated') return res.status(409).json({ error: 'deactivate the account before deleting it' });
  await query(`DELETE FROM users WHERE id = $1`, [id]); // ON DELETE CASCADE clears their data
  await audit(req.user!.id, 'user.delete', id, { email: u.email });
  res.json({ ok: true });
}));

// ── Batches (cohorts) ────────────────────────────────────────────────────────
adminRouter.get('/cohorts', requireAuth, requirePermission('cohort:assign'), ah(async (_req, res) => {
  const cohorts = await query<{ id: string; name: string; status: string; created_at: string }>(
    `SELECT id, name, status, created_at FROM cohorts ORDER BY created_at DESC`,
  );
  const members = await query<{ cohort_id: string; user_id: string; display_name: string; email: string; role: string; status: string }>(
    `SELECT cm.cohort_id, cm.user_id, u.display_name, u.email, cm.role, u.status
       FROM cohort_members cm JOIN users u ON u.id = cm.user_id`,
  );
  const byId = new Map<string, unknown[]>();
  for (const m of members.rows) {
    const arr = byId.get(m.cohort_id) ?? [];
    arr.push({ userId: m.user_id, displayName: m.display_name, email: m.email, role: m.role, status: m.status });
    byId.set(m.cohort_id, arr);
  }
  res.json(cohorts.rows.map((c) => ({
    id: c.id, name: c.name, status: c.status, createdAt: c.created_at,
    members: byId.get(c.id) ?? [],
  })));
}));

adminRouter.post('/cohorts', requireAuth, requirePermission('cohort:assign'), ah(async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) return bad(res, 'batch name required');
  const c = await one<{ id: string }>(`INSERT INTO cohorts (name) VALUES ($1) RETURNING id`, [name.trim()]);
  await audit(req.user!.id, 'cohort.create', c!.id, { name: name.trim() });
  res.status(201).json({ id: c!.id });
}));

adminRouter.post('/cohorts/:id/members', requireAuth, requirePermission('cohort:assign'), ah(async (req, res) => {
  const { id } = req.params;
  const { userId, role } = req.body ?? {};
  if (typeof userId !== 'string') return bad(res, 'userId required');
  const c = await one(`SELECT id FROM cohorts WHERE id = $1`, [id]);
  if (!c) return res.status(404).json({ error: 'batch not found' });
  const u = await one(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!u) return res.status(404).json({ error: 'user not found' });
  await query(
    `INSERT INTO cohort_members (cohort_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (cohort_id, user_id) DO UPDATE SET role = $3`,
    [id, userId, role === 'instructor' ? 'instructor' : 'learner'],
  );
  await audit(req.user!.id, 'cohort.member.add', id, { userId, role });
  res.json({ ok: true });
}));

adminRouter.delete('/cohorts/:id/members/:userId', requireAuth, requirePermission('cohort:assign'), ah(async (req, res) => {
  const { id, userId } = req.params;
  await query(`DELETE FROM cohort_members WHERE cohort_id = $1 AND user_id = $2`, [id, userId]);
  await audit(req.user!.id, 'cohort.member.remove', id, { userId });
  res.json({ ok: true });
}));

adminRouter.post('/cohorts/:id/suspend', requireAuth, requirePermission('cohort:assign'), ah(async (req, res) => {
  const r = await query(`UPDATE cohorts SET status = 'suspended', suspended_at = now() WHERE id = $1`, [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'batch not found' });
  await audit(req.user!.id, 'cohort.suspend', req.params.id, {});
  res.json({ ok: true });
}));

adminRouter.post('/cohorts/:id/reactivate', requireAuth, requirePermission('cohort:assign'), ah(async (req, res) => {
  const r = await query(`UPDATE cohorts SET status = 'active', suspended_at = NULL WHERE id = $1`, [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'batch not found' });
  await audit(req.user!.id, 'cohort.reactivate', req.params.id, {});
  res.json({ ok: true });
}));

adminRouter.delete('/cohorts/:id', requireAuth, requirePermission('cohort:assign'), ah(async (req, res) => {
  await query(`DELETE FROM cohorts WHERE id = $1`, [req.params.id]);
  await audit(req.user!.id, 'cohort.delete', req.params.id, {});
  res.json({ ok: true });
}));

// ── Modules (authoring) ──────────────────────────────────────────────────────
adminRouter.get('/modules', requireAuth, requirePermission('module:edit'), ah(async (_req, res) => {
  res.json(await listCatalogue(false));
}));

adminRouter.get('/modules/:id', requireAuth, requirePermission('module:edit'), ah(async (req, res) => {
  const m = await getEditable(req.params.id);
  if (!m) return res.status(404).json({ error: 'module not found' });
  res.json(m);
}));

// A Tier-3 module spawns a container, so authoring one is a more privileged act than
// authoring content (security review #7): require an admin-level permission for it.
const tier3NeedsAdmin = (req: import('express').Request, res: import('express').Response): boolean => {
  if (Number(req.body?.executionTier) === 3 && !req.user!.permissions.includes('user:manage')) {
    res.status(403).json({ error: 'only administrators may author Tier-3 (container-backed) modules' });
    return true;
  }
  return false;
};

adminRouter.post('/modules', requireAuth, requirePermission('module:edit'), ah(async (req, res) => {
  if (tier3NeedsAdmin(req, res)) return;
  try {
    const created = await createModule(req.user!.id, req.body as LabManifest);
    res.status(201).json({ id: created.id });
  } catch (e) { return bad(res, (e as Error).message); }
}));

adminRouter.put('/modules/:id', requireAuth, requirePermission('module:edit'), ah(async (req, res) => {
  if (tier3NeedsAdmin(req, res)) return;
  try {
    await updateModule(req.user!.id, req.params.id, req.body as LabManifest);
    res.json({ ok: true });
  } catch (e) { return bad(res, (e as Error).message); }
}));

adminRouter.patch('/modules/:id/settings', requireAuth, requirePermission('module:edit'), ah(async (req, res) => {
  try {
    await setSettings(req.user!.id, req.params.id, {
      enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
      sortOrder: typeof req.body?.sortOrder === 'number' ? req.body.sortOrder : undefined,
    });
    res.json({ ok: true });
  } catch (e) { return bad(res, (e as Error).message); }
}));

adminRouter.delete('/modules/:id', requireAuth, requirePermission('module:edit'), ah(async (req, res) => {
  try {
    await deleteModule(req.user!.id, req.params.id);
    res.json({ ok: true });
  } catch (e) { return bad(res, (e as Error).message); }
}));
