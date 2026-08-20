// Bridge from the service worker to the offscreen embedding document (#161).
// The SW cannot host the model itself (no DOM, short lifetime), so inference
// runs in an offscreen document and this module owns its lifecycle.

import { MessageType } from '@shared/message-types';
import { EMBEDDING_STORED_DECIMALS, TIMING } from '@shared/constants';

async function ensureOffscreen() {
    if (await chrome.offscreen.hasDocument?.()) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'On-device embedding inference (transformers.js / ONNX Runtime Web).',
    });
}

// Drops a document that stopped answering. Without this, a wedged model would
// burn the full timeout on every remaining turn instead of once; a fresh
// document at least gets to reload the model.
async function closeOffscreen(): Promise<void> {
    try {
        if (await chrome.offscreen.hasDocument?.()) await chrome.offscreen.closeDocument();
    } catch {
        // Already gone, or never created — nothing left to recover.
    }
}

// Rounded here rather than at the cache so no producer can forget: a vector
// only ever leaves this module on its way to storage, and one representation
// beats two. See EMBEDDING_STORED_DECIMALS for the size/accuracy tradeoff.
function toStoredPrecision(vector: number[]): number[] {
    const scale = 10 ** EMBEDDING_STORED_DECIMALS;
    return vector.map((x) => Math.round(x * scale) / scale);
}

// Resolves with a storage-precision vector (see toStoredPrecision).
export async function embedViaOffscreen(text: string): Promise<number[]> {
    await ensureOffscreen();

    const request = chrome.runtime.sendMessage({ target: 'offscreen', type: MessageType.OFFSCREEN_EMBED, text });
    // The losing side of the race below is never awaited. Mark it handled so a
    // timeout cannot surface as an unhandled rejection; the race still sees the
    // original promise, so this does not swallow a real error.
    void request.catch(() => {});

    // The offscreen listener holds the channel open (`return true`) and replies
    // only once inference resolves, so a model that never finishes loading
    // leaves this await pending forever. That would pin the embedding drain's
    // re-entrancy guard and silently stop every later turn — bound it.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
        const res = await Promise.race([
            request,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    timedOut = true;
                    reject(new Error('offscreen embed timed out'));
                }, TIMING.EMBED_TIMEOUT_MS);
            }),
        ]);

        if (!res || res.error) throw new Error(res?.error ?? 'no response');
        return toStoredPrecision(res.vector);
    } finally {
        // Always clear: a pending timer keeps the service worker awake.
        clearTimeout(timer);
        if (timedOut) await closeOffscreen();
    }
}
