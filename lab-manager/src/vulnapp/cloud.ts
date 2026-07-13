// Tier-1 Cloud-Security lab — fully SIMULATED (mock S3/IAM, no real AWS, no
// LocalStack; §15 scope discipline). A deterministic mock CLI whose responses
// encode two classic misconfigurations: a public S3 bucket and an over-permissive
// IAM policy. No per-user state — the mock is identical for everyone.
import { emit } from '../telemetry/pipeline.js';

const HELP = [
  'simulated cloud CLI — try:',
  '  s3 ls',
  '  s3 ls s3://nielit-public-assets',
  '  s3 cat s3://nielit-public-assets/flag.txt',
  '  iam get-policy labrole',
].join('\n');

export interface CloudResult { output: string; exploit: boolean; }

export async function runCloud(userId: string, command: string): Promise<CloudResult> {
  const c = command.trim().replace(/\s+/g, ' ').toLowerCase();
  await emit({ userId, labId: 'cloud-security', type: 'exploit_attempt', payload: { command }, outcome: 'neutral' });

  let output: string;
  let exploit = false;

  if (c === 's3 ls' || c === 'aws s3 ls') {
    output = [
      '2026-01-04 10:22:31  nielit-private-backups   (ACL: private)',
      '2026-01-04 10:23:02  nielit-public-assets     (ACL: public-read  ⚠ world-readable)',
    ].join('\n');
  } else if (c.includes('s3 ls s3://nielit-public-assets')) {
    output = [
      'PRE images/',
      '2026-01-05 09:10:00     512  flag.txt',
      '2026-01-05 09:10:44  4194304 backup.sql   (contains customer PII)',
    ].join('\n');
  } else if (c.includes('nielit-public-assets/flag.txt') && /(cat|cp|get)/.test(c)) {
    output = 'flag{cloud_s3_public_bucket_exposed}';
    exploit = true;
  } else if (c.includes('nielit-public-assets/backup.sql') && /(cat|cp|get)/.test(c)) {
    output = 'downloaded backup.sql (4 MB) — no credentials required (public-read).';
    exploit = true;
  } else if (c.startsWith('iam')) {
    output = [
      'PolicyName: labrole',
      'PolicyDocument:',
      '  { "Effect": "Allow", "Action": "*", "Resource": "*" }   ⚠ over-permissive (admin-equivalent)',
    ].join('\n');
    exploit = /get-policy|get-user|list/.test(c);
  } else if (c.includes('help') || c === '') {
    output = HELP;
  } else {
    output = `unknown command: ${command}\n${HELP}`;
  }

  if (exploit) {
    await emit({ userId, labId: 'cloud-security', type: 'exploit_success', payload: { command }, outcome: 'success' });
  }
  return { output, exploit };
}
