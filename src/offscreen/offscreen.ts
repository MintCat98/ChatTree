import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { MessageType } from '@shared/message-types'

env.useBrowserCache = false;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL('models/');
env.backends.onnx.wasm!.wasmPaths = chrome.runtime.getURL('wasm/');

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
let extractorP: Promise<FeatureExtractionPipeline> | null = null;
const getExtractor = () =>
    (extractorP ??= pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' }) as Promise<FeatureExtractionPipeline>);

async function embed(text: string): Promise<number[]> {
    const extractor = await getExtractor();
    const out = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(out.data as Float32Array);
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    getExtractor(); // warm up the model on first message

    if (msg?.target !== 'offscreen' || msg.type !== MessageType.OFFSCREEN_EMBED) return;
    embed(msg.text)
        .then((vector) => sendResponse({ vector }))
        .catch((error) => sendResponse({ error: String(error) }));
    return true;
});