// Runs the sentence-embedding model for #161. Lives in an offscreen document
// because the MV3 service worker has no DOM and too short a lifetime to host
// inference. Created on demand by @background/embed; closes itself when idle.

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { MessageType } from '@shared/message-types'
import { TIMING } from '@shared/constants'

env.useBrowserCache = false;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL('models/');
env.backends.onnx.wasm!.wasmPaths = chrome.runtime.getURL('wasm/');

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
let extractorP: Promise<FeatureExtractionPipeline> | null = null;

// The memoized promise is dropped when it rejects. Caching a rejection would
// poison the pipeline for the life of the document: every later turn would fail
// with the original error and nothing short of closing the document could
// recover, even if the failure was transient.
const getExtractor = (): Promise<FeatureExtractionPipeline> =>
    (extractorP ??= (
        pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' }) as Promise<FeatureExtractionPipeline>
    ).catch((err) => {
        extractorP = null; // the next call starts over
        throw err;
    }));

async function embed(text: string): Promise<number[]> {
    const extractor = await getExtractor();
    const out = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(out.data as Float32Array);
}

// Releases the loaded model (hundreds of MB) after a stretch with no work. The
// timer lives here rather than in the service worker on purpose: the SW is torn
// down when idle, so a timer there could not be trusted to fire. A plain
// setTimeout is fine in a document — the "use chrome.alarms" rule is about the
// service worker.
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function restartIdleTimer(): void {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => window.close(), TIMING.OFFSCREEN_IDLE_MS);
}

// Warm up once at load, NOT per message: this document receives every runtime
// message in the extension, so warming up inside the listener would load the
// model for traffic that has nothing to do with embedding. The rejection is
// absorbed here because nobody is waiting yet — a real caller triggers a fresh
// attempt through getExtractor() and sees the error then.
void getExtractor().catch(() => {});
restartIdleTimer();

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.target !== 'offscreen' || msg.type !== MessageType.OFFSCREEN_EMBED) return;

    restartIdleTimer();
    embed(msg.text)
        .then((vector) => sendResponse({ vector }))
        .catch((error) => sendResponse({ error: String(error) }))
        // Restart again on completion: a cold first call can take most of the
        // idle window on its own, and the document must not close right after
        // finally handing back its first vector.
        .finally(restartIdleTimer);
    return true;
});
