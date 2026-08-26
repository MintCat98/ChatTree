type LanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageModelPromptOptions {
  responseConstraint?: object;
  signal?: AbortSignal;
}

interface LanguageModelSession {
  prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
  // Copies the session (system prompt + context) without re-initializing the
  // model. Used to give each summarize attempt a clean session — see summary.ts.
  clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  destroy(): void;
}

interface LanguageModelCreateOptions {
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  topK?: number;
  monitor?: (m: EventTarget) => void;
}

declare const LanguageModel: {
  availability(): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
};
