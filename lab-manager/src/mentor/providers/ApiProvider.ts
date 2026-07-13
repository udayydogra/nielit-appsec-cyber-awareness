// Hosted API provider (Profile A). ~0 MB in the VM — hitting an API for the mentor
// saves more RAM than all the container tricks combined. Uses the Anthropic
// Messages API with streaming; the system prompt goes in the top-level `system`
// field (never mixed with untrusted user text).
import { config } from '../../config.js';
import type { MentorProvider } from './types.js';

export class ApiProvider implements MentorProvider {
  readonly name = 'api';

  async *stream(systemPrompt: string, userMessage: string): AsyncIterable<string> {
    if (!config.mentor.api.key) {
      yield '[mentor] MENTOR_API_KEY is not set — configure Profile A or switch MENTOR_PROVIDER.';
      return;
    }
    const res = await fetch(`${config.mentor.api.base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.mentor.api.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.mentor.api.model,
        max_tokens: 512,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

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
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            yield evt.delta.text as string;
          }
        } catch {
          /* skip keep-alive / non-JSON lines */
        }
      }
    }
  }
}
