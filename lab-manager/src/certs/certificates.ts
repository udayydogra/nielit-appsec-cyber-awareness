// Certificates = integrity artifact. System-issued on RE-VERIFIED completion,
// HMAC-signed, public GET /verify/:certId. One per (user, lab). Idempotent.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { query, one } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

function sign(payload: string): string {
  return crypto.createHmac('sha256', config.certSigningSecret).update(payload).digest('hex');
}

function canonical(userId: string, labId: string, score: number): string {
  return `${userId}|${labId}|${score}`;
}

export interface Certificate {
  id: string;
  userId: string;
  labId: string;
  score: number;
  signature: string;
  issuedAt: string;
}

// Issued ONLY after the server re-verifies the completion condition itself.
// The caller passes a verified score; we do not trust any client-supplied grade.
export async function issueCertificate(
  userId: string,
  labId: string,
  verifiedScore: number,
): Promise<Certificate> {
  const signature = sign(canonical(userId, labId, verifiedScore));

  const row = await one<{
    id: string; user_id: string; lab_id: string; score: number; signature: string; issued_at: string;
  }>(
    `INSERT INTO certificates (user_id, lab_id, score, signature)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, lab_id) DO UPDATE SET score = certificates.score
     RETURNING id, user_id, lab_id, score, signature, issued_at`,
    [userId, labId, verifiedScore, signature],
  );

  await emit({ userId, labId, type: 'lab_completed', outcome: 'success', payload: { certId: row!.id } });

  return {
    id: row!.id, userId: row!.user_id, labId: row!.lab_id,
    score: row!.score, signature: row!.signature, issuedAt: row!.issued_at,
  };
}

export async function getUserCertificate(userId: string, labId: string): Promise<Certificate | null> {
  const row = await one<{
    id: string; user_id: string; lab_id: string; score: number; signature: string; issued_at: string;
  }>(
    `SELECT id, user_id, lab_id, score, signature, issued_at
       FROM certificates WHERE user_id = $1 AND lab_id = $2`,
    [userId, labId],
  );
  if (!row) return null;
  return { id: row.id, userId: row.user_id, labId: row.lab_id, score: row.score, signature: row.signature, issuedAt: row.issued_at };
}

// Public verification: recompute the HMAC and compare. Tampering breaks the signature.
export async function verifyCertificate(certId: string) {
  const row = await one<{
    id: string; user_id: string; lab_id: string; score: number; signature: string; issued_at: string; display_name: string;
  }>(
    `SELECT c.id, c.user_id, c.lab_id, c.score, c.signature, c.issued_at, u.display_name
       FROM certificates c JOIN users u ON u.id = c.user_id
      WHERE c.id = $1`,
    [certId],
  );
  if (!row) return { valid: false as const };
  const expected = sign(canonical(row.user_id, row.lab_id, row.score));
  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(row.signature));
  return {
    valid,
    certId: row.id,
    holder: row.display_name,
    labId: row.lab_id,
    score: row.score,
    issuedAt: row.issued_at,
  };
}
