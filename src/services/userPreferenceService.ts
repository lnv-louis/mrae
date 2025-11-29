import databaseService from './databaseService';

function avgVector(vectors: Float32Array[]): Float32Array {
  if (!vectors.length) return new Float32Array(0);
  const dim = Math.min(...vectors.map((v) => v.length));
  const c = new Float32Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) c[i] += v[i];
  }
  for (let i = 0; i < dim; i++) c[i] /= vectors.length;
  return c;
}

async function getImageEmbedding(image_id: string): Promise<Uint8Array | null> {
  const rows = (await databaseService.getAll('SELECT embedding FROM image_index WHERE id = ?', [image_id])) as any[];
  if (!rows.length) return null;
  const emb = rows[0].embedding;
  if (emb instanceof Uint8Array) return emb;
  if (emb?.buffer && typeof emb.length === 'number') return new Uint8Array(emb.buffer);
  if (Array.isArray(emb)) return new Uint8Array(Float32Array.from(emb).buffer);
  return null;
}

export async function markPreference(image_id: string, feedback_tag: string = 'Dislike'): Promise<boolean> {
  const emb = await getImageEmbedding(image_id);
  if (!emb) return false;
  await databaseService.insertUserPreference({ image_id, feedback_tag, embedding_vector: emb });
  return true;
}

export async function calculateHateCentroid(feedback_tag: string = 'Dislike'): Promise<Float32Array> {
  const vecs = await databaseService.getPreferenceEmbeddingsByTag(feedback_tag);
  return avgVector(vecs);
}

export default { markPreference, calculateHateCentroid };
