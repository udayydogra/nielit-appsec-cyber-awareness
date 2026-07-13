// Thin API client. All requests are credentialed (session cookie). Base is /api in
// prod (nginx proxies) and dev (vite proxies) — see VITE_API_BASE.
const BASE = (import.meta.env.VITE_API_BASE as string) || '/api';

export interface LocalizedString { en: string; hi: string; }
export type Locale = 'en' | 'hi';

export interface AuthedUser {
  id: string; email: string; displayName: string; locale: Locale;
  roles: string[]; permissions: string[];
}

export interface CatalogueEntry {
  id: string; module: 'appsec' | 'awareness'; executionTier: 0 | 1 | 2 | 3;
  category: string; title: LocalizedString; summary: LocalizedString;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText, body);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
  }
}

export const api = {
  login: (email: string, password: string) =>
    req<AuthedUser>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => req<AuthedUser>('/auth/me'),

  catalogue: () => req<CatalogueEntry[]>('/labs'),
  manifest: <T = unknown>(id: string) => req<T>(`/labs/${id}`),
  start: (id: string) => req<{ tier: number; mode?: string; status?: string; containerId?: string }>(`/labs/${id}/start`, { method: 'POST' }),
  heartbeat: (id: string) => req<{ ok: true }>(`/labs/${id}/heartbeat`, { method: 'POST' }),
  stop: (id: string) => req<{ ok: true }>(`/labs/${id}/stop`, { method: 'POST' }),

  sqliLogin: (username: string, password: string) =>
    req<{ ok: boolean; rows: { username: string; role: string; secret_note: string | null }[]; query: string; error?: string; exploit?: string | null }>(
      '/labs/sqli/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  sqliReset: () => req<{ ok: true }>('/labs/sqli/reset', { method: 'POST' }),

  idorFetch: (id: number) =>
    req<{ found: boolean; idor: boolean; persona: string; invoice?: { invoiceId: number; belongsTo: string; amount: number; secret: string | null } }>(
      `/labs/idor/invoice/${id}`),
  idorReset: () => req<{ ok: true; persona: string }>('/labs/idor/reset', { method: 'POST' }),

  // Stored XSS
  xssComments: () => req<{ id: number; author: string; body: string }[]>('/labs/xss/comments'),
  xssPost: (author: string, body: string) =>
    req<{ ok: true; xss: boolean }>('/labs/xss/comment', { method: 'POST', body: JSON.stringify({ author, body }) }),
  xssReset: () => req<{ ok: true }>('/labs/xss/reset', { method: 'POST' }),

  // CSRF
  csrfState: () => req<{ email: string }>('/labs/csrf/state'),
  csrfReset: () => req<{ email: string }>('/labs/csrf/reset', { method: 'POST' }),
  csrfChange: (email: string, forged: boolean) =>
    req<{ email: string; protected: boolean }>('/labs/csrf/change-email', { method: 'POST', body: JSON.stringify({ email, forged }) }),
  csrfChangeSecure: (email: string, token?: string) =>
    req<{ email: string; protected: boolean }>('/labs/csrf/change-email-secure', {
      method: 'POST', headers: token ? { 'x-csrf-token': token } : {}, body: JSON.stringify({ email }),
    }),

  // Broken auth
  authAttempt: (username: string, pin: string) =>
    req<{ status: 'ok' | 'wrong_pin' | 'no_user'; secret?: string }>('/labs/auth/attempt', {
      method: 'POST', body: JSON.stringify({ username, pin }),
    }),
  authReset: () => req<{ ok: true }>('/labs/auth/reset', { method: 'POST' }),

  // Session management
  sessionState: () => req<{ token: string; decoded: string }>('/labs/session/state'),
  sessionWhoami: (token: string) =>
    req<{ valid: boolean; persona?: string; secret?: string; hijack: boolean }>(`/labs/session/whoami?token=${encodeURIComponent(token)}`),

  // BOLA
  bolaReset: () => req<{ ok: true }>('/labs/bola/reset', { method: 'POST' }),
  bolaGet: (id: number) =>
    req<{ found: boolean; bola: boolean; order?: { orderId: number; belongsTo: string; item: string; status: string; secret: string | null } }>(`/labs/bola/order/${id}`),
  bolaCancel: (id: number) =>
    req<{ found: boolean; bola: boolean; order?: { orderId: number; belongsTo: string; item: string; status: string; secret: string | null } }>(`/labs/bola/order/${id}/cancel`, { method: 'POST' }),

  // Business logic
  bizCheckout: (quantity: number, coupons: string[]) =>
    req<{ unitPrice: number; quantity: number; discount: number; total: number; exploit: boolean; reasons: string[] }>(
      '/labs/business-logic/checkout', { method: 'POST', body: JSON.stringify({ quantity, coupons }) }),

  // Race condition
  raceReset: () => req<{ balance: number }>('/labs/race-condition/reset', { method: 'POST' }),
  raceBalance: () => req<{ balance: number }>('/labs/race-condition/balance'),
  raceWithdraw: () => req<{ success: boolean; balance: number }>('/labs/race-condition/withdraw', { method: 'POST' }),

  // API security
  apiProfile: () => req<{ display_name: string; role: string; is_admin: boolean; password_hash: string; internal_note: string }>('/labs/api-security/profile'),
  apiReset: () => req<{ display_name: string; role: string; is_admin: boolean; password_hash: string; internal_note: string }>('/labs/api-security/reset', { method: 'POST' }),
  apiPatch: (patch: Record<string, unknown>) =>
    req<{ profile: { display_name: string; role: string; is_admin: boolean; password_hash: string; internal_note: string }; escalated: boolean; changed: string[] }>(
      '/labs/api-security/profile', { method: 'PATCH', body: JSON.stringify(patch) }),

  // LLM security
  llmChat: (message: string, hardened: boolean) =>
    req<{ reply: string; leaked: boolean }>('/labs/llm-security/chat', { method: 'POST', body: JSON.stringify({ message, hardened }) }),

  // Cloud security (simulated)
  cloudRun: (command: string) =>
    req<{ output: string; exploit: boolean }>('/labs/cloud-security/run', { method: 'POST', body: JSON.stringify({ command }) }),

  // File upload
  fileUpload: (filename: string, contentType: string, trueType: string) =>
    req<{ accepted: boolean; reason: string; dangerous: boolean; bypass: boolean; note: string }>(
      '/labs/file-upload/upload', { method: 'POST', body: JSON.stringify({ filename, contentType, trueType }) }),

  // nodeId = the destination node navigated to; the server derives the outcome.
  decision: (id: string, nodeId: string) =>
    req<{ ok: true; outcome: string | null }>(`/labs/${id}/decision`, {
      method: 'POST', body: JSON.stringify({ nodeId }),
    }),

  quiz: (id: string, answers: Record<string, string>) =>
    req<{ score: number; maxScore: number; passed: boolean; correct: Record<string, boolean>; certificate: { id: string } | null }>(
      `/labs/${id}/quiz`, { method: 'POST', body: JSON.stringify({ answers }) }),

  score: (id: string) => req<{ score: number; max_score: number }>(`/me/scores/${id}`),
  certificate: (id: string) => req<{ id: string; score: number; issuedAt: string }>(`/me/certificates/${id}`),
  mentorProvider: () => req<{ provider: string }>('/mentor/provider'),
};

// Mentor SSE — streams tokens. Returns an async iterator of text chunks.
export async function* mentorAsk(labId: string, question: string, locale: Locale): AsyncGenerator<string> {
  const res = await fetch(`${BASE}/mentor/ask`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ labId, question, locale }),
  });
  if (!res.ok || !res.body) { yield `[error ${res.status}]`; return; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const evt = JSON.parse(data);
        if (evt.token) yield evt.token as string;
        if (evt.error) yield `\n[error: ${evt.error}]`;
      } catch { /* skip */ }
    }
  }
}
