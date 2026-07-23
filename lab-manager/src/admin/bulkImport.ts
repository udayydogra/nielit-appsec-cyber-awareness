// Bulk user import from a CSV or Excel (.xlsx) file. The file carries three columns
// — email, name, and a unique id (the login username). For each new row we create a
// user with a randomly-generated temporary password (valid for a short, configurable
// window), optionally add them to a batch (cohort), and email them their credentials.
// Existing emails/usernames are skipped, never overwritten.
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { randomBytes } from 'node:crypto';
import { query, one } from '../db.js';
import { config } from '../config.js';
import { audit } from '../authz/audit.js';
import { sendCredentials, mailEnabled } from '../mail/mailer.js';

export interface ImportRow { email: string; name: string; username: string; }
export interface ImportResultRow {
  email: string; username: string;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
  emailed?: boolean;
  tempPassword?: string; // returned ONLY when email was not actually sent, so nothing is lost
}
export interface ImportSummary {
  created: number; skipped: number; errored: number;
  emailsSent: number; mailConfigured: boolean;
  cohort?: { id: string; name: string };
  rows: ImportResultRow[];
}

// ── Parsing ──────────────────────────────────────────────────────────────────

// A small RFC-4180-ish CSV parser: handles quoted fields, embedded commas/newlines
// and doubled quotes. Good enough for admin-provided rosters.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQuotes = false;
  const s = text.replace(/^﻿/, ''); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

async function parseXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  // exceljs's Buffer typing is narrower than Node's; the runtime accepts a Buffer.
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const cells: string[] = [];
    // row.values is 1-indexed with a leading hole; normalise to plain strings.
    const vals = row.values as unknown[];
    for (let i = 1; i < vals.length; i++) {
      const v = vals[i];
      cells.push(v == null ? '' : (typeof v === 'object' && 'text' in (v as any) ? String((v as any).text) : String(v)).trim());
    }
    if (cells.some((c) => c !== '')) rows.push(cells);
  });
  return rows;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HEADERS = {
  email: ['email', 'e-mail', 'mail', 'email address'],
  name: ['name', 'full name', 'fullname', 'display name', 'student name'],
  username: ['username', 'user name', 'unique id', 'uniqueid', 'id', 'user id', 'userid', 'login', 'roll no', 'roll number', 'rollno'],
};

// Map the header row to column indices, then extract the data rows.
function toRows(grid: string[][]): { rows: ImportRow[]; error?: string } {
  if (grid.length < 2) return { rows: [], error: 'file has no data rows' };
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const ei = find(HEADERS.email), ni = find(HEADERS.name), ui = find(HEADERS.username);
  if (ei < 0 || ni < 0) return { rows: [], error: 'file must have "email" and "name" columns' };
  const rows: ImportRow[] = [];
  for (const r of grid.slice(1)) {
    const email = (r[ei] ?? '').trim().toLowerCase();
    const name = (r[ni] ?? '').trim();
    // Unique id defaults to the local-part of the email when no id column is present.
    const username = (ui >= 0 ? (r[ui] ?? '').trim() : '') || email.split('@')[0];
    if (!email && !name) continue;
    rows.push({ email, name, username });
  }
  return { rows };
}

// Readable temp password: no ambiguous chars, mixed case + digits.
function genPassword(len = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// ── Import ───────────────────────────────────────────────────────────────────

export async function importUsers(
  actorId: string,
  file: { filename: string; buffer: Buffer },
  opts: { cohortName?: string; cohortId?: string; sendEmail?: boolean },
): Promise<ImportSummary> {
  const isXlsx = /\.xlsx?$/i.test(file.filename) || file.filename.toLowerCase().endsWith('xlsx');
  const grid = isXlsx ? await parseXlsx(file.buffer) : parseCsv(file.buffer.toString('utf8'));
  const { rows, error } = toRows(grid);
  if (error) throw new Error(error);
  if (!rows.length) throw new Error('no valid rows found in the file');

  // Resolve the target cohort (create by name, or use an existing id) if requested.
  let cohort: { id: string; name: string } | undefined;
  if (opts.cohortId) {
    const c = await one<{ id: string; name: string }>(`SELECT id, name FROM cohorts WHERE id = $1`, [opts.cohortId]);
    if (!c) throw new Error('batch not found');
    cohort = c;
  } else if (opts.cohortName?.trim()) {
    const c = await one<{ id: string; name: string }>(
      `INSERT INTO cohorts (name) VALUES ($1) RETURNING id, name`, [opts.cohortName.trim()],
    );
    cohort = c!;
  }

  const ttl = config.tempPasswordTtlMin;
  const sendEmail = opts.sendEmail !== false;
  const results: ImportResultRow[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const res: ImportResultRow = { email: r.email, username: r.username, status: 'skipped' };
    try {
      if (!EMAIL_RE.test(r.email)) { res.status = 'error'; res.reason = 'invalid email'; results.push(res); continue; }
      if (!r.name) { res.status = 'error'; res.reason = 'missing name'; results.push(res); continue; }
      if (seen.has(r.email) || seen.has(`u:${r.username.toLowerCase()}`)) { res.reason = 'duplicate row in file'; results.push(res); continue; }
      seen.add(r.email); seen.add(`u:${r.username.toLowerCase()}`);

      const clash = await one<{ id: string }>(
        `SELECT id FROM users WHERE email = $1 OR (username IS NOT NULL AND lower(username) = lower($2))`,
        [r.email, r.username],
      );
      if (clash) { res.reason = 'email or username already exists'; results.push(res); continue; }

      const tempPassword = genPassword();
      const hash = await bcrypt.hash(tempPassword, 10);
      const created = await one<{ id: string }>(
        `INSERT INTO users (email, username, password_hash, display_name, password_expires_at, must_change_password)
         VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval, true) RETURNING id`,
        [r.email, r.username, hash, r.name, String(ttl)],
      );
      // Every imported learner gets the student role.
      await query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'student'`, [created!.id]);
      if (cohort) {
        await query(
          `INSERT INTO cohort_members (cohort_id, user_id, role) VALUES ($1, $2, 'learner')
           ON CONFLICT (cohort_id, user_id) DO NOTHING`,
          [cohort.id, created!.id],
        );
      }

      res.status = 'created';
      if (sendEmail) {
        const sent = await sendCredentials({ to: r.email, name: r.name, username: r.username, tempPassword, ttlMin: ttl });
        res.emailed = sent.sent;
        if (!sent.sent) res.tempPassword = tempPassword; // surface it so it isn't lost
        if (sent.error) res.reason = `email failed: ${sent.error}`;
      } else {
        res.emailed = false;
        res.tempPassword = tempPassword;
      }
    } catch (e) {
      res.status = 'error'; res.reason = (e as Error).message;
    }
    results.push(res);
  }

  const summary: ImportSummary = {
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errored: results.filter((r) => r.status === 'error').length,
    emailsSent: results.filter((r) => r.emailed).length,
    mailConfigured: mailEnabled,
    cohort,
    rows: results,
  };
  await audit(actorId, 'user.import', cohort?.id ?? null, {
    filename: file.filename, created: summary.created, skipped: summary.skipped, errored: summary.errored,
  });
  return summary;
}
