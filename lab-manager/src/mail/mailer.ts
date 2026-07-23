// Outbound email via nodemailer. Provider-swappable and offline-friendly, in the
// same spirit as the AI mentor: if SMTP is configured we send for real; if not, we
// use a no-send JSON transport so the app never crashes and the caller can still
// distribute the credentials it generated. Credentials are the ONLY plaintext
// secret this module touches, and only in transit to the user's own inbox.
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

let transporter: Transporter | null = null;
export const mailEnabled = Boolean(config.smtp.host);

function getTransport(): Transporter {
  if (transporter) return transporter;
  transporter = mailEnabled
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
    // No SMTP configured → a transport that "sends" to nowhere (JSON), so callers
    // still succeed and simply learn the message was not actually delivered.
    : nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Send a learner their sign-in credentials. Returns whether it was actually sent
// (false when SMTP is not configured), never throws.
export async function sendCredentials(opts: {
  to: string; name: string; username: string; tempPassword: string; ttlMin: number; loginUrl?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const { to, name, username, tempPassword, ttlMin } = opts;
  const loginUrl = opts.loginUrl || config.frontendOrigin;
  const subject = 'Your NIELIT Cyber Security Training account';
  const text =
`Hello ${name},

An account has been created for you on the NIELIT Cyber Security Training platform.

  Sign in at : ${loginUrl}
  Username   : ${username}
  Email      : ${to}
  Temporary password : ${tempPassword}

This temporary password is valid for ${ttlMin} minutes. Please sign in and set a new
password right away. If it expires before you sign in, ask your administrator to
re-send your invitation.

— NIELIT, MeitY, Government of India`;

  const html =
`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
  <h2 style="color:#1e40af;margin:0 0 4px">NIELIT Cyber Security Training</h2>
  <p style="color:#64748b;margin:0 0 18px">National Institute of Electronics &amp; IT · MeitY, Govt. of India</p>
  <p>Hello ${esc(name)},</p>
  <p>An account has been created for you. Use the temporary credentials below to sign in.</p>
  <table style="border-collapse:collapse;margin:14px 0">
    <tr><td style="padding:6px 12px;color:#64748b">Sign in at</td><td style="padding:6px 12px"><a href="${esc(loginUrl)}">${esc(loginUrl)}</a></td></tr>
    <tr><td style="padding:6px 12px;color:#64748b">Username</td><td style="padding:6px 12px"><b>${esc(username)}</b></td></tr>
    <tr><td style="padding:6px 12px;color:#64748b">Email</td><td style="padding:6px 12px">${esc(to)}</td></tr>
    <tr><td style="padding:6px 12px;color:#64748b">Temporary password</td><td style="padding:6px 12px"><b style="font-family:monospace">${esc(tempPassword)}</b></td></tr>
  </table>
  <p style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 12px">
    This temporary password is valid for <b>${ttlMin} minutes</b>. Please sign in and set a new password right away.
  </p>
  <p style="color:#64748b;font-size:12px;margin-top:22px">If you did not expect this email, you can ignore it.</p>
</div>`;

  try {
    await getTransport().sendMail({ from: config.smtp.from, to, subject, text, html });
    return { sent: mailEnabled };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}
