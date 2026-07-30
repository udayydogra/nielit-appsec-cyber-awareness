// MentorService: (context, question, locale) → answer stream. One shared instance,
// QUEUED via a semaphore (never per-user, never per-lab). Hybrid answer path:
// known beat → pre-authored LocalizedString (instant, grounded); genuine freeform
// → LLM under the semaphore, with locale + context.
import { config } from '../config.js';
import { getManifest } from '../manifests.js';
import { lastActionContext } from '../telemetry/pipeline.js';
import { findPreAuthored } from './preauthored.js';
import { buildSystemPrompt, buildUserMessage } from './prompt.js';
import type { MentorProvider } from './providers/types.js';
import { ApiProvider } from './providers/ApiProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';

// Minimal counting semaphore — caps concurrent LLM calls to protect RAM/budget.
class Semaphore {
  private queue: Array<() => void> = [];
  private available: number;
  constructor(max: number) { this.available = max; }
  async acquire(): Promise<() => void> {
    if (this.available > 0) { this.available--; return () => this.release(); }
    return new Promise((resolve) => this.queue.push(() => { this.available--; resolve(() => this.release()); }));
  }
  private release(): void {
    this.available++;
    const next = this.queue.shift();
    if (next) next();
  }
}

// Provider selection: MENTOR_PROVIDER=jetson points the Ollama-protocol client at
// the Jetson Nano endpoint; =ollama uses the local/LAN Ollama. Otherwise use the
// hosted API only when an API key is present; with no key, fall back to a local
// Ollama so the mentor works out-of-the-box.
function pickProvider(): MentorProvider {
  if (config.mentor.provider === 'jetson') {
    return new OllamaProvider(config.mentor.jetson.base, config.mentor.jetson.model, 'jetson');
  }
  if (config.mentor.provider === 'ollama') return new OllamaProvider();
  if (config.mentor.api.key) return new ApiProvider();
  return new OllamaProvider();
}

export class MentorService {
  private provider: MentorProvider;
  private sem: Semaphore;

  constructor() {
    this.provider = pickProvider();
    this.sem = new Semaphore(config.mentor.maxConcurrent);
    console.log(`[mentor] provider = ${this.provider.name}` +
      (config.mentor.provider === 'api' && !config.mentor.api.key ? ' (no API key → fell back to ollama)' : ''));
  }

  get providerName(): string { return this.provider.name; }

  // Returns a token stream. Pre-authored answers stream instantly (no model load);
  // freeform questions acquire the shared semaphore first.
  async *ask(userId: string, labId: string, question: string, locale: 'en' | 'hi'): AsyncIterable<string> {
    const manifest = getManifest(labId);
    const ctx = await lastActionContext(userId, labId);

    // Hybrid path 1: known beat. For AppSec, key off the exploit the student asks
    // about; for awareness, key off the last verified outcome (positive/negative).
    const preKey = manifest?.module === 'appsec'
      ? (question.toLowerCase().includes('union') ? 'union' : 'auth-bypass')
      : (ctx?.outcome ?? null);
    const pre = findPreAuthored(labId, preKey ?? undefined);

    if (pre && isKnownBeatQuestion(question)) {
      yield locale === 'hi' ? pre.hi : pre.en;
      return;
    }

    // Hybrid path 2: genuine freeform → LLM, under the semaphore.
    const release = await this.sem.acquire();
    try {
      const system = buildSystemPrompt({
        labId,
        labTitle: manifest ? (locale === 'hi' ? manifest.title.hi : manifest.title.en) : labId,
        nodeId: ctx?.nodeId,
        lastAction: ctx?.type,
        lastOutcome: ctx?.outcome,
        locale,
      });
      const user = buildUserMessage(question);
      for await (const token of this.provider.stream(system, user)) {
        yield token;
      }
    } finally {
      release();
    }
  }
}

function isKnownBeatQuestion(q: string): boolean {
  const s = q.toLowerCase();
  return /why|kaise|kyun|kyu|how did|explain|samjh/.test(s);
}

export const mentorService = new MentorService();
