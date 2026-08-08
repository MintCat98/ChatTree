// Downloads the bundled embedding model from Hugging Face into public/models/
// at build time (see docs/spikes/offscreen-embedding.md). Keeps the 113MB
// model out of git while the shipped dist stays fully offline.
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const REPO = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'onnx/model_quantized.onnx',
];
const BASE = `https://huggingface.co/${REPO}/resolve/main`;
const OUT_ROOT = join('public', 'models', REPO);

const exists = async (p) => stat(p).then(() => true).catch(() => false);

async function download(file) {
  const dest = join(OUT_ROOT, file);
  if (await exists(dest)) { console.log(`[fetch-model] skip: ${file}`); return; }
  console.log(`[fetch-model] downloading: ${file}`);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Failed ${res.status} for ${file}`);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

for (const f of FILES) await download(f);
console.log('[fetch-model] all model files ready');