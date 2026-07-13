// Provider abstraction: (system, user) → async token stream. Local Ollama vs
// hosted API is ONE env var, decided at deploy time, invisible to the frontend.
export interface MentorProvider {
  readonly name: string;
  stream(systemPrompt: string, userMessage: string): AsyncIterable<string>;
}
