# Spike: On-device embeddings in an offscreen document (#161)

## Goal
Run multilingual (ko/en) sentence embeddings fully on-device in an MV3
offscreen document, bundled (no CDN), and validate embedding + cosine relevance.

## Decisions
- Model: Xenova/paraphrase-multilingual-MiniLM-L12-v2, dtype q8 (384-dim). Chosen for ko/en over English-only MiniLM.
- Delivery: model + onnxruntime wasm ship inside the built `dist/` (no runtime CDN → no host permission). The 113MB q8 model exceeds GitHub's 100MB limit, so it is **git-ignored and fetched at build time** by `scripts/fetch-model.mjs` (npm `prebuild`/`predev` hook), not committed. This is build-time only — the shipped extension stays fully offline. wasm/mjs loaders are copied from `node_modules/onnxruntime-web` by CopyPlugin.
- Runs in an offscreen document (SW has no DOM/WebGPU + short lifetime).

## Architecture
content → SUMMARIZE_TURNS → Background SW → (OFFSCREEN_EMBED) → offscreen
(transformers.js / onnxruntime-web wasm) → vector → setNodeCache({embedding}) (#189).

## Gotchas (hard-won)
- webpack shims transformers' `import.meta` → `__webpack_module__ is not defined`.
  Fix: `module.parser.javascript.importMeta = false` + HtmlWebpackPlugin `scriptLoading: 'module'` + `<script type="module">`.
- onnxruntime needs BOTH `ort-*.wasm` AND `ort-*.mjs` loaders copied to dist (wasmPaths dir).
- Browser context: `env.allowLocalModels = true` (default false!), `env.useBrowserCache = false` (chrome-extension:// cache unsupported), `localModelPath`/`wasmPaths` via `chrome.runtime.getURL`.
- Manifest: `offscreen` permission + CSP `script-src 'self' 'wasm-unsafe-eval'`.
- Model folder layout: `<id>/onnx/model_quantized.onnx` + tokenizer files.
- Messaging: warm up model on offscreen load; "message channel closed" is a benign first-call artifact (Port for robustness later).

## Eval results
|  | 고양이1(ko) | 고양이2(ko) | cat(en) | DB(ko) | DB(en) | 날씨(ko) |
|---|---|---|---|---|---|---|
| 고양이1(ko) |1.000|0.482|0.762|0.013|-0.026|-0.131|
| 고양이2(ko) |0.482|1.000|0.404|-0.005|-0.017|0.021|
| cat(en) |0.762|0.404|1.000|-0.101|-0.126|-0.186|
| DB(ko) |0.013|-0.005|-0.101|1.000|0.940|0.099|
| DB(en) |-0.026|-0.017|-0.126|0.940|1.000|0.113|
| 날씨(ko) |-0.131|0.021|-0.186|0.099|0.113|1.000|

→ cross-lingual alignment confirmed (0.76 / 0.94); topics well separated; normalization OK.

## Conclusion
Pipeline works end-to-end; multilingual model justified; cosine relevance sane.
Ready for #161 integration: SUMMARIZE_TURNS piggyback (write embedding) + wire map's parent-resolver to GET_RELEVANCE.

## Open items
- Model size (113MB q8): resolved with build-time download (git-ignored). LFS deferred — revisit with team if git-versioned/reproducible model is needed. A smaller quantization (q4) could roughly halve it.
- Message robustness (Port vs one-shot).
- Relevance threshold tuning (related≈0.4+, same≈0.9).
