// Unit tests for message-bridge — Content ↔ Background messaging layer.

import { sendToBackground, onMessageFromBackground } from '@content/message-bridge';
import type { BridgeMessage } from '@shared/message-types';
import { MessageType } from '@shared/message-types';

// ---------------------------------------------------------------------------
// chrome.runtime mock
// ---------------------------------------------------------------------------

type MessageListener = (message: unknown) => void;

let capturedListeners: MessageListener[] = [];
let mockSendMessage: jest.Mock;

beforeEach(() => {
  capturedListeners = [];
  mockSendMessage = jest.fn();
  jest.useFakeTimers();

  (global as unknown as { chrome: typeof chrome }).chrome = {
    runtime: {
      sendMessage: mockSendMessage,
      onMessage: {
        addListener: jest.fn((fn: MessageListener) => capturedListeners.push(fn)),
        removeListener: jest.fn((fn: MessageListener) => {
          capturedListeners = capturedListeners.filter((l) => l !== fn);
        }),
      },
    },
  } as unknown as typeof chrome;
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MSG: BridgeMessage = { type: MessageType.CHATBOX_ADDED };

function fireListeners(message: unknown): void {
  capturedListeners.forEach((l) => l(message));
}

// ---------------------------------------------------------------------------
// sendToBackground
// ---------------------------------------------------------------------------

describe('sendToBackground', () => {
  it('sends the message on the first attempt', async () => {
    mockSendMessage.mockResolvedValueOnce(undefined);

    await sendToBackground(MSG);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(MSG);
  });

  it('retries after the first failure and succeeds on the second attempt', async () => {
    mockSendMessage
      .mockRejectedValueOnce(new Error('SW not ready'))
      .mockResolvedValueOnce(undefined);

    const promise = sendToBackground(MSG);
    await jest.runAllTimersAsync();
    await promise;

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('retries twice and succeeds on the third attempt', async () => {
    mockSendMessage
      .mockRejectedValueOnce(new Error('SW not ready'))
      .mockRejectedValueOnce(new Error('SW not ready'))
      .mockResolvedValueOnce(undefined);

    const promise = sendToBackground(MSG);
    await jest.runAllTimersAsync();
    await promise;

    expect(mockSendMessage).toHaveBeenCalledTimes(3);
  });

  it('throws after all three attempts fail', async () => {
    const error = new Error('Could not establish connection');
    mockSendMessage.mockRejectedValue(error);

    // Attach the rejection handler before timers fire to avoid UnhandledPromiseRejection
    const assertion = expect(sendToBackground(MSG)).rejects.toThrow('Could not establish connection');
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockSendMessage).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// onMessageFromBackground
// ---------------------------------------------------------------------------

describe('onMessageFromBackground', () => {
  it('registers a listener on chrome.runtime.onMessage', () => {
    const handler = jest.fn();
    onMessageFromBackground(handler);

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it('calls the handler when a valid BridgeMessage arrives', () => {
    const handler = jest.fn();
    onMessageFromBackground(handler);

    const msg: BridgeMessage = { type: MessageType.TREE_READY, payload: { tree: {} } };
    fireListeners(msg);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it('does not call the handler for a non-BridgeMessage (no type field)', () => {
    const handler = jest.fn();
    onMessageFromBackground(handler);

    fireListeners({ payload: 'missing type' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the handler for null', () => {
    const handler = jest.fn();
    onMessageFromBackground(handler);

    fireListeners(null);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the handler for a plain string', () => {
    const handler = jest.fn();
    onMessageFromBackground(handler);

    fireListeners('TREE_READY');

    expect(handler).not.toHaveBeenCalled();
  });

  it('returns a cleanup function that removes the listener', () => {
    const handler = jest.fn();
    const unlisten = onMessageFromBackground(handler);

    unlisten();

    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);

    // Confirm the listener is no longer in the captured list
    fireListeners(MSG);
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple independent subscriptions', () => {
    const handlerA = jest.fn();
    const handlerB = jest.fn();
    onMessageFromBackground(handlerA);
    onMessageFromBackground(handlerB);

    fireListeners(MSG);

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
  });
});
