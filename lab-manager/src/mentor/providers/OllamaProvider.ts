// Ollama provider (Profile B off-VM / C in-VM). ONE shared instance — never
// per-user. The widget talks to YOUR backend, never localhost:11434 directly.
import { config } from '../../config.js';
import type { MentorProvider } from './types.js';

export class OllamaProvider implements MentorProvider {
  readonly name = 'ollama';

  async *stream(systemPrompt: string, userMessage: string): AsyncIterable<string> {
    let res: Response;
    try {
      res = await fetch(`${config.mentor.ollama.base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: config.mentor.ollama.model,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });
    } catch {
      yield '[mentor] cannot reach Ollama — check MENTOR_OLLAMA_BASE / the local-llm profile.';
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
