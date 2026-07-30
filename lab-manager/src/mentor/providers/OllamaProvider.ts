// Ollama-protocol provider. ONE shared instance — never per-user. The widget talks
// to YOUR backend, never the model host directly. Reused for both a local/LAN Ollama
// (Profile B/C) and a Jetson Nano running Ollama (Profile D) — same wire protocol,
// different endpoint, chosen by MentorService at construction.
import { config } from '../../config.js';
import type { MentorProvider } from './types.js';

export class OllamaProvider implements MentorProvider {
  readonly name: string;
  private readonly base: string;
  private readonly model: string;
  private readonly envHint: string;

  // Defaults to the local/LAN Ollama config; MentorService passes the Jetson config
  // (base + model + name 'jetson') for Profile D.
  constructor(
    base: string = config.mentor.ollama.base,
    model: string = config.mentor.ollama.model,
    name = 'ollama',
  ) {
    this.base = base;
    this.model = model;
    this.name = name;
    this.envHint = name === 'jetson' ? 'MENTOR_JETSON_BASE (is the Nano reachable?)' : 'MENTOR_OLLAMA_BASE / the local-llm profile';
  }

  async *stream(systemPrompt: string, userMessage: string): AsyncIterable<string> {
    let res: Response;
    try {
      res = await fetch(`${this.base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });
    } catch {
      yield `[mentor] cannot reach ${this.name} — check ${this.envHint}.`;
      return;
    }
    if (!res.ok || !res.body) {
      yield `[mentor] provider error ${res.status}`;
      return;
    }
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
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.message?.content) yield evt.message.content as string;
        } catch {
          /* skip partial lines */
        }
      }
    }
  }
}
