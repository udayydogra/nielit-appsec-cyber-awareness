// Every memory / auth / cert / mentor knob, env-driven. Nothing hard-coded.
function num(name: string, def: number): number {
  const v = process.env[name];
  return v === undefined || v === '' ? def : Number(v);
}
function str(name: string, def = ''): string {
  return process.env[name] ?? def;
}

export const config = {
  env: str('NODE_ENV', 'development'),
  port: num('API_PORT', 4000),

  jwtSecret: str('JWT_SECRET', 'dev-only-change-me'),
  certSigningSecret: str('CERT_SIGNING_SECRET', 'dev-only-change-me'),
  sessionCookieName: str('SESSION_COOKIE_NAME', 'nielit_sid'),

  frontendOrigin: str('FRONTEND_ORIGIN', 'http://localhost:8080'),

  pg: {
    host: str('PGHOST', 'localhost'),
    port: num('PGPORT', 5432),
    user: str('PGUSER', 'nielit'),
    password: str('PGPASSWORD', 'nielit'),
    database: str('PGDATABASE', 'nielit'),
  },

  // Locked-down role used ONLY to run the deliberately-injectable lab query. It has
  // no privileges on any application table, so an injection cannot escape the lab.
  pgLab: {
    user: str('PGUSER_LAB', 'nielit_lab'),
    password: str('PGPASSWORD_LAB', ''),
  },

  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),

  containers: {
    maxConcurrent: num('MAX_CONCURRENT_CONTAINERS', 12),
    memoryMb: num('CONTAINER_MEMORY_MB', 192),
    cpus: str('CONTAINER_CPUS', '0.5'),
    idleTimeoutSec: num('CONTAINER_IDLE_TIMEOUT_SEC', 360),
    maxLifetimeSec: num('CONTAINER_MAX_LIFETIME_SEC', 1800),
    runtime: str('CONTAINER_RUNTIME', 'runc'), // "runsc" for gVisor on escape labs
    // Internal network reaching only the apt proxy (set to 'none' to fully isolate).
    network: str('CONTAINER_NETWORK', 'nielit-labnet'),
  },

  rateLimits: {
    loginPerMin: num('RATE_LOGIN_PER_MIN', 10),
    labStartPerMin: num('RATE_LAB_START_PER_MIN', 10),
    mentorPerMin: num('RATE_MENTOR_PER_MIN', 20),
  },

  // Bulk-import: how long an emailed temporary password stays valid. Requested at
  // 8 minutes; keep it env-tunable because email delivery can exceed a tight window.
  tempPasswordTtlMin: num('TEMP_PASSWORD_TTL_MIN', 8),

  // Outbound email (nodemailer). If SMTP_HOST is unset, the mailer falls back to a
  // no-send transport and the import endpoint returns the generated credentials so
  // an admin can distribute them manually — offline-friendly, nothing is lost.
  smtp: {
    host: str('SMTP_HOST', ''),
    port: num('SMTP_PORT', 587),
    secure: str('SMTP_SECURE', 'false') === 'true', // true for port 465
    user: str('SMTP_USER', ''),
    pass: str('SMTP_PASS', ''),
    from: str('SMTP_FROM', 'NIELIT Training <no-reply@nielit.gov.in>'),
  },

  mentor: {
    provider: str('MENTOR_PROVIDER', 'api'), // api | ollama | jetson
    maxConcurrent: num('MENTOR_MAX_CONCURRENT', 2),
    api: {
      base: str('MENTOR_API_BASE', 'https://api.anthropic.com'),
      key: str('MENTOR_API_KEY', ''),
      model: str('MENTOR_API_MODEL', 'claude-haiku-4-5-20251001'),
    },
    ollama: {
      base: str('MENTOR_OLLAMA_BASE', 'http://localhost:11434'),
      model: str('MENTOR_OLLAMA_MODEL', 'qwen2.5:3b'),
    },
    // Profile D: a Jetson Nano (or any LAN device) running Ollama. Same wire
    // protocol as `ollama`, just a different endpoint — offloads the LLM off the VM
    // onto edge hardware. `.local` needs mDNS; prefer the Nano's static IP in prod.
    jetson: {
      base: str('MENTOR_JETSON_BASE', 'http://jetson-nano.local:11434'),
      model: str('MENTOR_JETSON_MODEL', 'qwen2.5:3b'),
    },
  },
};

export type Config = typeof config;

// Fail fast in production if a signing secret was left at its dev default — an
// unrotated secret means anyone with the source can forge sessions and certificates.
const DEV_DEFAULT = 'dev-only-change-me';
if (config.env === 'production') {
  const weak: string[] = [];
  if (config.jwtSecret === DEV_DEFAULT || config.jwtSecret.length < 24) weak.push('JWT_SECRET');
  if (config.certSigningSecret === DEV_DEFAULT || config.certSigningSecret.length < 24) weak.push('CERT_SIGNING_SECRET');
  if (!config.pgLab.password) weak.push('PGPASSWORD_LAB');
  if (weak.length) {
    throw new Error(
      `[config] refusing to start in production with unset/weak secrets: ${weak.join(', ')}. ` +
      `Set strong random values (e.g. \`openssl rand -hex 32\`).`,
    );
  }
}
