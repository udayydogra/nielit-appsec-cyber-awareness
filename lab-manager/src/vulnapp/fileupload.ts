// Tier-2 File-Upload target. A naive validator that (a) trusts the client-supplied
// Content-Type and (b) only checks the LAST extension against a blocklist. Both are
// bypassable: a Content-Type of image/* is accepted regardless of contents, and a
// double extension (shell.php.jpg) sails past the blocklist. Stateless — no table.
import { emit } from '../telemetry/pipeline.js';

const BLOCKED_EXT = ['php', 'jsp', 'asp', 'aspx', 'exe', 'sh'];

// `trueType` is what the file ACTUALLY is (the lab tells us, since we don't store
// bytes): 'benign' | 'webshell' | 'script' | 'svg-xss'.
export type TrueType = 'benign' | 'webshell' | 'script' | 'svg-xss';

export interface UploadResult {
  accepted: boolean;
  reason: string;
  dangerous: boolean;
  bypass: boolean;
  note: string;
}

export async function validateUpload(
  userId: string,
  filename: string,
  contentType: string,
  trueType: TrueType,
): Promise<UploadResult> {
  await emit({ userId, labId: 'file-upload', type: 'exploit_attempt', payload: { filename, contentType, trueType }, outcome: 'neutral' });

  const lastExt = (filename.split('.').pop() ?? '').toLowerCase();
  let accepted: boolean;
  let reason: string;
  if (contentType.toLowerCase().startsWith('image/')) {
    accepted = true; // ⚠️ trusts a client-controlled header
    reason = `Content-Type is "${contentType}" (image/*) → accepted without inspecting bytes`;
  } else if (!BLOCKED_EXT.includes(lastExt)) {
    accepted = true; // ⚠️ only the LAST extension is checked
    reason = `.${lastExt} is not on the extension blocklist → accepted`;
  } else {
    accepted = false;
    reason = `.${lastExt} is blocklisted → rejected`;
  }

  const dangerous = trueType !== 'benign';
  const bypass = accepted && dangerous;
  if (bypass) {
    await emit({ userId, labId: 'file-upload', type: 'exploit_success', payload: { filename, trueType }, outcome: 'success' });
  }

  const notes: Record<TrueType, string> = {
    benign: 'A real image — harmless.',
    webshell: 'Actually server-side code. A misconfigured server may execute it → RCE.',
    script: 'Executable script content disguised by extension/Content-Type.',
    'svg-xss': 'SVGs are XML and can carry <script> — served inline, this is stored XSS.',
  };
  return { accepted, reason, dangerous, bypass, note: notes[trueType] };
}
