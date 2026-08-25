// Runs the sentence-embedding model for #161. Lives in an offscreen document
// because the MV3 service worker has no DOM and too short a lifetime to host
// inference. Created on demand by @background/embed; closes itself when idle.

import {
    pipeline,
    env,
    type FeatureExtractionPipeline,
    type PreTrainedTokenizer,
} from '@huggingface/transformers'
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

// The model reads at most `model_max_length` tokens (512). That is roughly
// 2,300 characters of English but only ~930 of Korean — this tokenizer spends
// 1.8 chars/token on Hangul against 4.5 on Latin — so a full answer routinely
// overflows and everything past the cut is silently dropped.
//
// Measured on long single-topic sections: a follow-up quoting content from the
// END of a section never once retrieved that section (0/4) when the source was
// plainly truncated; chunking recovered 3/4. Chunks are averaged UNWEIGHTED on
// purpose — weighting by token count re-biases the vector toward the opening
// chunk, which is exactly what truncation was doing, and scored worse (2/4).
const MAX_CHUNKS = 8;

// Splits on token ids rather than characters so the budget is exact for any
// script. Beyond MAX_CHUNKS the tail is dropped: that bounds a pathological
// turn to 8 forward passes, and ~4,000 tokens already covers far more than
// truncation ever did.
function chunkToBudget(tokenizer: PreTrainedTokenizer, text: string): string[] {
    const budget = tokenizer.model_max_length - 2; // room for [CLS] / [SEP]
    const ids = tokenizer.encode(text).slice(1, -1);
    if (ids.length <= budget) return [text];

    const chunks: string[] = [];
    for (let i = 0; i < ids.length && chunks.length < MAX_CHUNKS; i += budget) {
        chunks.push(tokenizer.decode(ids.slice(i, i + budget), { skip_special_tokens: true }));
    }
    return chunks;
}

async function embed(text: string): Promise<number[]> {
    const extractor = await getExtractor();
    const chunks = chunkToBudget(extractor.tokenizer, text);

    const vectors: Float32Array[] = [];
    for (const chunk of chunks) {
        const out = await extractor(chunk, { pooling: 'mean', normalize: true });
        vectors.push(out.data as Float32Array);
    }
    if (vectors.length === 1) return Array.from(vectors[0]);

    // Each chunk vector is already L2-normalized; average, then renormalize so
    // the result stays on the unit sphere and cosine stays comparable.
    const mean = new Array<number>(vectors[0].length).fill(0);
    for (const v of vectors) {
        for (let i = 0; i < mean.length; i++) mean[i] += v[i] / vectors.length;
    }
    const norm = Math.hypot(...mean);
    return norm === 0 ? mean : mean.map((x) => x / norm);
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
