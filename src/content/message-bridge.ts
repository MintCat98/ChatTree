// Wraps chrome.runtime messaging between Content Script and Background SW.
// Handles MV3 Service Worker restart: sendToBackground retries on connection failure.

import type { BridgeMessage } from '@shared/message-types';

// Retry delays in ms: immediate → 100ms → 200ms (3 attempts total)
const RETRY_DELAYS = [0, 100, 200] as const;

function isBridgeMessage(value: unknown): value is BridgeMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).type === 'string'
  );
}

/**
 * Always await this call or attach .catch() — rejects after 3 failed attempts.
 * Callers that fire-and-forget risk UnhandledPromiseRejection.
 */
export async function sendToBackground(message: BridgeMessage): Promise<void> {
  let lastError: unknown;

  for (const delay of RETRY_DELAYS) {
    if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
    try {
      await chrome.runtime.sendMessage(message);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export function onMessageFromBackground(
  handler: (message: BridgeMessage) => void,
): () => void {
  const listener = (message: unknown): void => {
    if (isBridgeMessage(message)) {
      handler(message);
    }
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
