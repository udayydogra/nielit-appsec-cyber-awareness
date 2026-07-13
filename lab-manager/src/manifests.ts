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

function validate(m: LabManifest, file: string): void {
  if (!m.id) throw new Error(`${file}: missing id`);
  if (m.module !== 'appsec' && m.module !== 'awareness') throw new Error(`${file}: bad module`);
  if (![0, 1, 2, 3].includes(m.executionTier)) throw new Error(`${file}: bad executionTier`);
  if (!m.title?.en || !m.title?.hi) throw new Error(`${file}: title needs en+hi`);
  if (m.module === 'awareness' && (!m.start || !m.nodes)) throw new Error(`${file}: awareness needs start+nodes`);
}

export function loadAllManifests(): LabManifest[] {
  const files = readdirSync(MANIFEST_DIR).filter((f) => f.endsWith('.json'));
  const out: LabManifest[] = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(path.join(MANIFEST_DIR, f), 'utf8')) as LabManifest;
    validate(raw, f);
    cache.set(raw.id, raw);
    out.push(raw);
  }
  return out;
}

export function getManifest(id: string): LabManifest | null {
  if (cache.size === 0) loadAllManifests();
  return cache.get(id) ?? null;
}

// The client never receives quiz answer keys (they live in quiz_keys). Manifests
// as authored carry only choices, so they are safe to ship as-is.
export function publicManifest(m: LabManifest): LabManifest {
  return m;
}
