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

  pg: {
    host: str('PGHOST', 'localhost'),
    port: num('PGPORT', 5432),
    user: str('PGUSER', 'nielit'),
    password: str('PGPASSWORD', 'nielit'),
    database: str('PGDATABASE', 'nielit'),
  },

  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),

  containers: {
    maxConcurrent: num('MAX_CONCURRENT_CONTAINERS', 12),
    memoryMb: num('CONTAINER_MEMORY_MB', 128),
    cpus: str('CONTAINER_CPUS', '0.5'),
    idleTimeoutSec: num('CONTAINER_IDLE_TIMEOUT_SEC', 360),
    maxLifetimeSec: num('CONTAINER_MAX_LIFETIME_SEC', 1800),
    runtime: str('CONTAINER_RUNTIME', 'runc'), // "runsc" for gVisor on escape labs
  },

  rateLimits: {
    labStartPerMin: num('RATE_LAB_START_PER_MIN', 10),
    mentorPerMin: num('RATE_MENTOR_PER_MIN', 20),
  },

  mentor: {
    provider: str('MENTOR_PROVIDER', 'api'), // api | ollama
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
  },
};

export type Config = typeof config;
