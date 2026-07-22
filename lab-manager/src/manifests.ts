// Loads lab manifests by id. Adding a lab = dropping a validated JSON file into
// labs/manifests/ — never writing new code (the golden rule of scope).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { LabManifest } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/manifests.js and src/manifests.ts both sit two levels under the repo root's
// lab-manager dir; manifests live at <repo>/labs/manifests.
const MANIFEST_DIR =
  process.env.MANIFEST_DIR ?? path.resolve(__dirname, '..', '..', 'labs', 'manifests');

const cache = new Map<string, LabManifest>();
// Ids that came from JSON files on disk (vs. admin-authored rows in the DB).
const builtinIds = new Set<string>();

// Validate a manifest regardless of where it came from (file or authoring UI).
export function assertValidManifest(m: LabManifest, ctx = m?.id ?? 'manifest'): void {
  if (!m || typeof m !== 'object') throw new Error(`${ctx}: not an object`);
  if (!m.id || !/^[a-z0-9-]+$/.test(m.id)) throw new Error(`${ctx}: id must be lowercase kebab-case`);
  if (m.module !== 'appsec' && m.module !== 'awareness') throw new Error(`${ctx}: module must be appsec|awareness`);
  if (![0, 1, 2, 3].includes(m.executionTier)) throw new Error(`${ctx}: bad executionTier`);
  if (!m.title?.en || !m.title?.hi) throw new Error(`${ctx}: title needs en+hi`);
  if (!m.summary?.en || !m.summary?.hi) throw new Error(`${ctx}: summary needs en+hi`);
  if (m.module === 'awareness' && (!m.start || !m.nodes)) throw new Error(`${ctx}: awareness needs start+nodes`);
}

export function loadAllManifests(): LabManifest[] {
  const files = readdirSync(MANIFEST_DIR).filter((f) => f.endsWith('.json'));
  const out: LabManifest[] = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(path.join(MANIFEST_DIR, f), 'utf8')) as LabManifest;
    assertValidManifest(raw, f);
    cache.set(raw.id, raw);
    builtinIds.add(raw.id);
    out.push(raw);
  }
  return out;
}

export function getManifest(id: string): LabManifest | null {
  if (cache.size === 0) loadAllManifests();
  return cache.get(id) ?? null;
}

// All manifests currently in the cache (built-in files + authored, once synced).
export function allCachedManifests(): LabManifest[] {
  if (cache.size === 0) loadAllManifests();
  return [...cache.values()];
}

export function isBuiltin(id: string): boolean {
  return builtinIds.has(id);
}

// Authored modules are injected into the same cache so getManifest() serves them too.
export function cachePut(m: LabManifest): void {
  cache.set(m.id, m);
}
export function cacheDelete(id: string): void {
  if (!builtinIds.has(id)) cache.delete(id);
}

// The client never receives quiz answer keys (they live in quiz_keys). Manifests
// as authored carry only choices, so they are safe to ship as-is.
export function publicManifest(m: LabManifest): LabManifest {
  return m;
}
