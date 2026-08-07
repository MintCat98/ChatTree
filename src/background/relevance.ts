import { getSessionNodeCache } from '@shared/node-cache';

export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length === 0) return null;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getRelevance(sessionId: string, nodeIdA: string, nodeIdB: string): Promise<number | null> {
  const cache = await getSessionNodeCache(sessionId);
  const embA = cache[nodeIdA]?.embedding;
  const embB = cache[nodeIdB]?.embedding;
  if (!embA || !embB) return null;
  return cosineSimilarity(embA, embB);
}