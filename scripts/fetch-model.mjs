// Downloads the bundled embedding model from Hugging Face into public/models/
// at build time (see docs/spikes/offscreen-embedding.md). Keeps the ~113MB
// model out of git while the shipped dist stays fully offline.
//
// Pinned to a revision SHA, not `main`: a moving reference would let the
// weights change under a build, and the checksums below would stop matching.
// To move to a newer revision, update REVISION and every hash in FILES — get
// them from https://huggingface.co/<REPO>/tree/<REVISION> or from the
// `x-linked-etag` header on each resolve URL (it is the sha256 for LFS files).
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const REPO = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const REVISION = '2c4055b12046f11709e9df2c122e59ffbdc2f900';

const FILES = [
  { path: 'config.json', sha256: '05b570bff786faa5c4604152aa16f19f77ed6dfc31e47dd0f3dd987078693ac7' },
  { path: 'tokenizer.json', sha256: 'b60b6b43406a48bf3638526314f3d232d97058bc93472ff2de930d43686fa441' },
  { path: 'tokenizer_config.json', sha256: '3f5961b9ac86288cccdb97f32fb848d6187c78e1603958c53f3ea1f296b7d8a2' },
  { path: 'special_tokens_map.json', sha256: '06e405a36dfe4b9604f484f6a1e619af1a7f7d09e34a8555eb0b77b66318067f' },
  { path: 'onnx/model_quantized.onnx', sha256: '66fc00f5f29afcaff34092e1bdd20008ca3918265a82fb9695a551e510cc4ebc' },
];

const BASE = `https://huggingface.co/${REPO}/resolve/${REVISION}`;
const OUT_ROOT = join('public', 'models', REPO);

const exists = async (p) => stat(p).then(() => true).catch(() => false);

async function sha256(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function download({ path: file, sha256: expected }) {
  const dest = join(OUT_ROOT, file);

  // Verify what is already on disk instead of trusting its presence: an
  // interrupted run leaves a truncated file behind, and a bare existence check
  // would happily ship it.
  if (await exists(dest)) {
    if ((await sha256(dest)) === expected) {
      console.log(`[fetch-model] ok: ${file}`);
      return;
    }
    console.log(`[fetch-model] corrupt, refetching: ${file}`);
    await rm(dest);
  }

  console.log(`[fetch-model] downloading: ${file}`);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Failed ${res.status} for ${file}`);

  // Land it under a temporary name and rename only once the bytes verify, so a
  // failure never leaves something that looks complete.
  await mkdir(dirname(dest), { recursive: true });
  const partial = `${dest}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(partial));
    const actual = await sha256(partial);
    if (actual !== expected) {
      throw new Error(`Checksum mismatch for ${file}\n  expected ${expected}\n  actual   ${actual}`);
    }
    await rename(partial, dest);
  } catch (err) {
    await rm(partial, { force: true });
    throw err;
  }
}

// Neither the ONNX export nor the original model ships a LICENSE file, so the
// notice that travels with the weights has to be written here. Keeping it next
// to the model means the license survives if dist/models is ever extracted on
// its own; the same components are also listed in THIRD_PARTY_LICENSES.md at
// the package root.
async function writeLicense() {
  const dest = join(OUT_ROOT, 'LICENSE');
  const content = `${REPO}

Source:       https://huggingface.co/${REPO}
Revision:     ${REVISION}
Derived from: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

These files are redistributed unmodified. Neither upstream repository declares a
copyright line or ships a NOTICE file; both are published under the Apache
License 2.0, reproduced in full below.

${'-'.repeat(80)}

${await readFile(join('scripts', 'apache-2.0.txt'), 'utf8')}`;

  // Rewriting every run would bump the mtime and make webpack re-copy the file
  // for no reason, so only touch it when the content actually changes.
  if ((await readFile(dest, 'utf8').catch(() => null)) === content) {
    console.log('[fetch-model] ok: LICENSE');
    return;
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, content);
  console.log('[fetch-model] wrote: LICENSE');
}

for (const file of FILES) await download(file);
await writeLicense();
console.log('[fetch-model] all model files ready');
