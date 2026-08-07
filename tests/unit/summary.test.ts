// Unit tests for the summarization contract (issue #160): per-attempt session
// isolation, retry → truncated fallback, and prompt-input clamping.
// No LanguageModel global needed — summarizeConversation takes a session object.

import {
  summarizeConversation,
  buildConversationInput,
  KEYWORD_MAX_LENGTH,
  QUESTION_MAX_CHARS,
  ANSWER_MAX_CHARS,
} from '@shared/summary';

const VALID = JSON.stringify({ keyword: 'kw', question: 'q?', answer: 'a.' });

// --- fake session ---
// `clone()` hands out a fresh child each call; the base session must never be
// prompted directly (that is the QuotaExceededError pattern from spike #158).
type Child = { prompt: jest.Mock; destroy: jest.Mock };

function makeSession(replies: Array<string | Error>) {
  const children: Child[] = [];
  let next = 0;
  const base = {
    prompt: jest.fn(async () => 'BASE SESSION MUST NOT BE PROMPTED'),
    destroy: jest.fn(),
    clone: jest.fn(async () => {
      const reply = replies[next++];
      const child: Child = {
        prompt: jest.fn(async () => {
          if (reply instanceof Error) throw reply;
          return reply;
        }),
        destroy: jest.fn(),
      };
      children.push(child);
      return child as unknown as LanguageModelSession;
    }),
  };
  return { base: base as unknown as LanguageModelSession, spy: base, children };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('summarizeConversation — session isolation', () => {
  it('prompts a clone, never the session it was given', async () => {
    const { base, spy, children } = makeSession([VALID]);

    const result = await summarizeConversation(base, 'q', 'a');

    expect(result.ok).toBe(true);
    expect(spy.prompt).not.toHaveBeenCalled();
    expect(spy.clone).toHaveBeenCalledTimes(1);
    expect(children[0].prompt).toHaveBeenCalledTimes(1);
  });

  it('gives the retry a fresh clone and destroys each one', async () => {
    // Reusing the session that just produced a runaway generation is what
    // triggered the sporadic QuotaExceededError (spike #158, it#5).
    const { base, spy, children } = makeSession([new Error('QuotaExceededError'), VALID]);

    const result = await summarizeConversation(base, 'q', 'a');

    expect(result.ok).toBe(true);
    expect(spy.clone).toHaveBeenCalledTimes(2);
    expect(children).toHaveLength(2);
    expect(children[0]).not.toBe(children[1]);
    children.forEach((c) => expect(c.destroy).toHaveBeenCalled());
  });

  it('passes the abort signal to both clone and prompt', async () => {
    const { base, spy, children } = makeSession([VALID]);
    const signal = new AbortController().signal;

    await summarizeConversation(base, 'q', 'a', signal);

    expect(spy.clone).toHaveBeenCalledWith({ signal });
    expect(children[0].prompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal }),
    );
  });
});

describe('summarizeConversation — result shape', () => {
  it('retries once, then falls back to truncated text', async () => {
    const { base, spy } = makeSession([new Error('boom'), new Error('boom')]);

    const result = await summarizeConversation(base, 'What is a LUT?', 'A lookup table.');

    expect(spy.clone).toHaveBeenCalledTimes(2); // initial + one retry, no more
    expect(result.ok).toBe(false);
    expect(result.summary).toEqual({
      keyword: 'What is a LUT?',
      question: 'What is a LUT?',
      answer: 'A lookup table.',
    });
  });

  it('falls back when the JSON parses but has the wrong shape', async () => {
    const { base } = makeSession([JSON.stringify({ keyword: '' }), JSON.stringify({ nope: 1 })]);

    const result = await summarizeConversation(base, 'q', 'a');

    expect(result.ok).toBe(false);
  });

  it('extracts the JSON object out of surrounding prose', async () => {
    const { base } = makeSession([`Sure! ${VALID} Hope that helps.`]);

    const result = await summarizeConversation(base, 'q', 'a');

    expect(result.ok).toBe(true);
    expect(result.summary?.keyword).toBe('kw');
  });

  it('clamps an over-long keyword to the node-label budget', async () => {
    const long = JSON.stringify({ keyword: 'k'.repeat(50), question: 'q', answer: 'a' });
    const { base } = makeSession([long]);

    const result = await summarizeConversation(base, 'q', 'a');

    expect(result.summary?.keyword).toHaveLength(KEYWORD_MAX_LENGTH);
  });
});

describe('buildConversationInput — prompt-input clamp', () => {
  it('clamps a long answer so it cannot blow the context window', async () => {
    const answer = 'a'.repeat(ANSWER_MAX_CHARS * 3);
    const { base, children } = makeSession([VALID]);

    await summarizeConversation(base, 'q', answer);

    const input = children[0].prompt.mock.calls[0][0] as string;
    expect(input).toContain('...');
    expect(input.length).toBeLessThan(ANSWER_MAX_CHARS + QUESTION_MAX_CHARS + 500);
  });

  it('clamps a long question too', () => {
    const input = buildConversationInput('q'.repeat(QUESTION_MAX_CHARS * 2), 'short answer');

    expect(input).toContain('short answer');
    expect(input.length).toBeLessThan(QUESTION_MAX_CHARS + 200);
  });

  it('leaves short turns untouched', () => {
    const input = buildConversationInput('What is a LUT?', 'A lookup table.');

    expect(input).toContain('[User] What is a LUT?');
    expect(input).toContain('[Assistant] A lookup table.');
    expect(input).not.toContain('...');
  });

  it('detects the language from the full text, not the clamped prefix', () => {
    // Latin-heavy head, Hangul-heavy tail past the clamp point. Whole answer
    // is Korean by ratio; the clamped prefix alone would read as English —
    // so this only passes while detectLanguage runs before the clamp.
    const answer = 'a'.repeat(3_000) + '한'.repeat(8_000);
    expect(answer.length).toBeGreaterThan(ANSWER_MAX_CHARS);

    expect(buildConversationInput('...', answer)).toContain('Target language: Korean');
  });
});
