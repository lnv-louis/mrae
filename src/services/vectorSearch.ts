import databaseService from './databaseService';
import userPreferenceService from './userPreferenceService';

export type ResultItem = { uri: string; score: number };

const MIN_SCORE_THRESHOLD = 0.25;
const MAX_RESULTS_TO_DISPLAY = 100;

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function toFloat32(data: any): Float32Array {
  if (!data) return new Float32Array(0);
  if (data instanceof Float32Array) return data;
  if (data instanceof Uint8Array) return new Float32Array(data.buffer);
  if (Array.isArray(data)) return new Float32Array(data);
  if (data?.buffer && typeof data.length === 'number') return new Float32Array(data.buffer);
  return new Float32Array(0);
}

export async function searchVectorOnly(
  queryText: string,
  onnxSession: any,
  tokenizer: any,
  minScoreThreshold: number = MIN_SCORE_THRESHOLD,
  opts?: { hateTag?: string; penaltyFactor?: number }
): Promise<{ results: ResultItem[]; message: string; foundCount: number }> {
  if (!queryText || !queryText.trim()) {
    throw new Error('Invalid query');
  }

  const inputs = tokenizer(queryText, {
    return_tensors: 'np',
    padding: 'max_length',
    max_length: 16,
    truncation: true,
  });

  const outputs = await onnxSession.run(
    {
      input_ids: inputs.input_ids.data,
      attention_mask: inputs.attention_mask.data,
    },
    ['pooler_output']
  );

  const out = outputs?.pooler_output ?? outputs?.[0] ?? outputs;
  const qVec = toFloat32(out?.data);

  const rows = await databaseService.getAll('SELECT uri, embedding FROM image_index');
  const candidates = rows.map((row: any) => ({ uri: row.uri, embedding: toFloat32(row.embedding) }));

  if (candidates.length === 0) {
    return { results: [], message: 'No indexed images', foundCount: 0 };
  }

  let hateCentroid: Float32Array | null = null;
  const hateTag = opts?.hateTag || 'Dislike';
  const penalty = opts?.penaltyFactor ?? 1.2;
  const centroid = await userPreferenceService.calculateHateCentroid(hateTag);
  if (centroid && centroid.length > 0) hateCentroid = centroid;

  const resultsWithScore: ResultItem[] = candidates.map((c: any) => {
    const base = cosineSimilarity(qVec, c.embedding);
    const hate = hateCentroid ? cosineSimilarity(hateCentroid, c.embedding) : 0;
    const final = base - hate * penalty;
    return { uri: c.uri, score: final };
  });

  const qualityResults = resultsWithScore.filter((r) => r.score >= minScoreThreshold);
  qualityResults.sort((a, b) => b.score - a.score);
  const finalResults = qualityResults.slice(0, MAX_RESULTS_TO_DISPLAY);

  return {
    results: finalResults,
    message: `Found ${qualityResults.length} in ${candidates.length}, showing ${finalResults.length}.`,
    foundCount: qualityResults.length,
  };
}
