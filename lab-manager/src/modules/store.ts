// Module store — unifies built-in JSON manifests with admin-authored modules kept
// in the DB. Authored modules are injected into the manifest cache so getManifest()
// (used by labs/mentor/terminal) serves them transparently. A settings overlay
// (module_settings) lets admins enable/disable/reorder ANY module by id.
import { query, one } from '../db.js';
import { audit } from '../authz/audit.js';
import {
  assertValidManifest, allCachedManifests, getManifest, isBuiltin,
  cachePut, cacheDelete,
} from '../manifests.js';
import type { LabManifest } from '../types.js';

export interface CatalogueRow {
  id: string;
  module: 'appsec' | 'awareness';
  executionTier: 0 | 1 | 2 | 3;
  category?: string;
  title: LabManifest['title'];
  summary: LabManifest['summary'];
  enabled: boolean;
  sortOrder: number;
  source: 'builtin' | 'authored';
}

// Pull every authored module out of the DB and into the shared manifest cache.
export async function syncAuthored(): Promise<number> {
  const rows = await query<{ id: string; manifest: LabManifest }>(
    `SELECT id, manifest FROM modules`,
  );
  for (const r of rows.rows) {
    try { assertValidManifest(r.manifest); cachePut(r.manifest); }
    catch (e) { console.error(`[modules] skipping invalid authored module ${r.id}:`, (e as Error).message); }
  }
  return rows.rows.length;
}

async function settingsMap(): Promise<Map<string, { enabled: boolean; sortOrder: number }>> {
  const rows = await query<{ module_id: string; enabled: boolean; sort_order: number }>(
    `SELECT module_id, enabled, sort_order FROM module_settings`,
  );
  const m = new Map<string, { enabled: boolean; sortOrder: number }>();
  for (const r of rows.rows) m.set(r.module_id, { enabled: r.enabled, sortOrder: r.sort_order });
  return m;
}

// Full catalogue (admins see all; pass onlyEnabled for the learner-facing list).
export async function listCatalogue(onlyEnabled = false): Promise<CatalogueRow[]> {
  const settings = await settingsMap();
  const rows: CatalogueRow[] = allCachedManifests().map((m) => {
    const s = settings.get(m.id);
    return {
      id: m.id, module: m.module, executionTier: m.executionTier,
      category: m.category, title: m.title, summary: m.summary,
      enabled: s ? s.enabled : true,
      sortOrder: s ? s.sortOrder : 100,
      source: isBuiltin(m.id) ? 'builtin' : 'authored',
    };
  });
  const filtered = onlyEnabled ? rows.filter((r) => r.enabled) : rows;
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

// The authoring editor marks a `correct` choice per quiz question; the answer key
// is never shipped to learners (it lives in quiz_keys). Split it out on save…
async function storeQuizKeys(id: string, quiz: any[]): Promise<any[]> {
  const clean: any[] = [];
  await query(`DELETE FROM quiz_keys WHERE lab_id = $1`, [id]);
  for (const q of quiz ?? []) {
    const { correct, points, ...rest } = q ?? {};
    if (correct !== undefined && correct !== '' && q?.id) {
      await query(
        `INSERT INTO quiz_keys (lab_id, question_id, correct, points) VALUES ($1, $2, $3, $4)`,
        [id, q.id, JSON.stringify(correct), typeof points === 'number' ? points : 10],
      );
    }
    clean.push(rest);
  }
  return clean;
}

// …and re-attach it (admin-only) when the editor loads an authored module.
async function attachQuizKeys(m: LabManifest): Promise<LabManifest> {
  if (!m.quiz?.length) return m;
  const keys = await query<{ question_id: string; correct: unknown }>(
    `SELECT question_id, correct FROM quiz_keys WHERE lab_id = $1`, [m.id],
  );
  const byQ = new Map(keys.rows.map((k) => [k.question_id, k.correct]));
  return { ...m, quiz: m.quiz.map((q) => byQ.has(q.id) ? { ...q, correct: byQ.get(q.id) } : q) };
}

// The full manifest for the editor, with provenance and answer keys re-attached.
export async function getEditable(id: string): Promise<{ manifest: LabManifest; source: 'builtin' | 'authored' } | null> {
  const m = getManifest(id);
  if (!m) return null;
  return { manifest: await attachQuizKeys(m), source: isBuiltin(id) ? 'builtin' : 'authored' };
}

export async function createModule(actorId: string, raw: LabManifest): Promise<LabManifest> {
  assertValidManifest(raw);
  if (getManifest(raw.id)) throw new Error(`a module with id "${raw.id}" already exists`);
  const cleanQuiz = await storeQuizKeys(raw.id, (raw as any).quiz ?? []);
  const manifest: LabManifest = { ...raw, ...(raw.quiz ? { quiz: cleanQuiz } : {}) };
  await query(
    `INSERT INTO modules (id, module, manifest, created_by) VALUES ($1, $2, $3, $4)`,
    [manifest.id, manifest.module, JSON.stringify(manifest), actorId],
  );
  cachePut(manifest);
  await audit(actorId, 'module.create', manifest.id, { module: manifest.module });
  return manifest;
}

export async function updateModule(actorId: string, id: string, raw: LabManifest): Promise<LabManifest> {
  if (isBuiltin(id)) throw new Error('built-in modules cannot be edited (create a new module instead)');
  assertValidManifest(raw);
  if (raw.id !== id) throw new Error('module id cannot change');
  const existing = await one(`SELECT id FROM modules WHERE id = $1`, [id]);
  if (!existing) throw new Error('module not found');
  const cleanQuiz = await storeQuizKeys(id, (raw as any).quiz ?? []);
  const manifest: LabManifest = { ...raw, ...(raw.quiz ? { quiz: cleanQuiz } : {}) };
  await query(
    `UPDATE modules SET manifest = $2, module = $3, updated_at = now() WHERE id = $1`,
    [id, JSON.stringify(manifest), manifest.module],
  );
  cachePut(manifest);
  await audit(actorId, 'module.update', id, {});
  return manifest;
}

export async function deleteModule(actorId: string, id: string): Promise<void> {
  if (isBuiltin(id)) throw new Error('built-in modules cannot be deleted (disable it instead)');
  await query(`DELETE FROM modules WHERE id = $1`, [id]);
  await query(`DELETE FROM module_settings WHERE module_id = $1`, [id]);
  await query(`DELETE FROM quiz_keys WHERE lab_id = $1`, [id]);
  cacheDelete(id);
  await audit(actorId, 'module.delete', id, {});
}

export async function setSettings(
  actorId: string, id: string, patch: { enabled?: boolean; sortOrder?: number },
): Promise<void> {
  if (!getManifest(id)) throw new Error('module not found');
  const cur = await one<{ enabled: boolean; sort_order: number }>(
    `SELECT enabled, sort_order FROM module_settings WHERE module_id = $1`, [id],
  );
  const enabled = patch.enabled ?? cur?.enabled ?? true;
  const sortOrder = patch.sortOrder ?? cur?.sort_order ?? 100;
  await query(
    `INSERT INTO module_settings (module_id, enabled, sort_order, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (module_id) DO UPDATE SET enabled = $2, sort_order = $3, updated_at = now()`,
    [id, enabled, sortOrder],
  );
  await audit(actorId, 'module.settings', id, { enabled, sortOrder });
}
