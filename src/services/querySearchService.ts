import geminiService from './geminiService';
import embeddingService from './embeddingService';
import databaseService from './databaseService';

type ExpandedResult = {
  id: string;
  uri: string;
  score: number;
  phrase: string;
};

const MIN_SCORE_THRESHOLD = 0.25;
const MAX_RESULTS = 100;

function toFloat32(data: any): Float32Array {
  if (!data) return new Float32Array(0);
  if (data instanceof Float32Array) return data;
  if (data instanceof Uint8Array) return new Float32Array(data.buffer);
  if (Array.isArray(data)) return new Float32Array(data);
  if (data?.buffer && typeof data.length === 'number') return new Float32Array(data.buffer);
  return new Float32Array(0);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

async function expandQueryWithGemini(query: string): Promise<string[]> {
  const prompt = `You are a query expansion assistant for semantic image search. Given a user query, output a concise JSON array of 3-8 short phrases that capture different facets (objects, attributes, actions, scenes, moods). Keep each phrase under 6 words. Output only JSON.

Query: ${query}`;
  const response = await geminiService.generateContent([{ role: 'user', content: prompt }]);
  const text = response?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '[]';
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr.map((s) => String(s)).filter((s) => s.trim().length > 0);
  } catch {}
  return text
    .split(/\n|,/) // fallback split
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
}

export async function searchByExpandedText(
  query: string,
  options?: { threshold?: number; limit?: number }
): Promise<{ results: ExpandedResult[]; phrases: string[]; message: string }> {
  const threshold = options?.threshold ?? MIN_SCORE_THRESHOLD;
  const limit = options?.limit ?? MAX_RESULTS;

  if (!query || !query.trim()) {
    return { results: [], phrases: [], message: 'Empty query' };
  }

  const phrases = (await expandQueryWithGemini(query)) || [query];

  const phraseVectors: Float32Array[] = [];
  for (const p of phrases) {
    const vec = await embeddingService.embedText(p);
    const v = toFloat32(vec.embedding);
    if (v.length > 0) phraseVectors.push(v);
  }
  if (phraseVectors.length === 0) {
    return { results: [], phrases, message: 'No embeddings for phrases' };
  }

  const rows = await databaseService.getAll('SELECT id, uri, embedding FROM image_index');
  const candidates = rows.map((row: any) => ({ id: row.id, uri: row.uri, emb: toFloat32(row.embedding) }));
  if (candidates.length === 0) {
    return { results: [], phrases, message: 'No indexed images' };
  }

  const scored: ExpandedResult[] = candidates.map((c) => {
    let best = 0;
    let bestPhrase = phrases[0] || query;
    for (let i = 0; i < phraseVectors.length; i++) {
      const s = cosineSimilarity(phraseVectors[i], c.emb);
      if (s > best) {
        best = s;
        bestPhrase = phrases[i];
      }
    }
    return { id: c.id, uri: c.uri, score: best, phrase: bestPhrase };
  });

  const filtered = scored.filter((r) => r.score >= threshold);
  filtered.sort((a, b) => b.score - a.score);
  const final = filtered.slice(0, limit);

  const message = `Expanded to ${phrases.length} phrases; matched ${filtered.length} of ${candidates.length}; returning ${final.length}.`;
  return { results: final, phrases, message };
}

export default { searchByExpandedText };

async function expandQueryStructured(query: string): Promise<{
  phrases: string[];
  city?: string | null;
  startMs?: number | null;
  endMs?: number | null;
}> {
  const prompt = `Return JSON only with keys: phrases, city, startMs, endMs.\nphrases: array of 3-8 short strings (<=6 words).\ncity: string or null.\nstartMs: integer epoch ms or null.\nendMs: integer epoch ms or null.\nQuery: ${query}`;
  const response = await geminiService.generateContent([{ role: 'user', content: prompt }]);
  const text = response?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '{}';
  try {
    const obj = JSON.parse(text);
    const phrases = Array.isArray(obj?.phrases) ? obj.phrases.map((s: any) => String(s)) : [];
    const city = obj?.city != null ? String(obj.city) : null;
    const startMs = typeof obj?.startMs === 'number' ? obj.startMs : null;
    const endMs = typeof obj?.endMs === 'number' ? obj.endMs : null;
    return { phrases, city, startMs, endMs };
  } catch {
    return { phrases: [query], city: null, startMs: null, endMs: null };
  }
}

export async function searchByHybridText(
  query: string,
  options?: { threshold?: number; limit?: number }
): Promise<{ results: ExpandedResult[]; phrases: string[]; filters: { city?: string | null; startMs?: number | null; endMs?: number | null }; message: string }> {
  const threshold = options?.threshold ?? MIN_SCORE_THRESHOLD;
  const limit = options?.limit ?? MAX_RESULTS;
  if (!query || !query.trim()) {
    return { results: [], phrases: [], filters: {}, message: 'Empty query' };
  }
  const structured = await expandQueryStructured(query);
  const phrases = structured.phrases.length > 0 ? structured.phrases : [query];
  const vectors: Float32Array[] = [];
  for (const p of phrases) {
    const vec = await embeddingService.embedText(p);
    const v = toFloat32(vec.embedding);
    if (v.length > 0) vectors.push(v);
  }
  if (vectors.length === 0) {
    return { results: [], phrases, filters: structured, message: 'No embeddings for phrases' };
  }
  const conditions: string[] = [];
  const params: any[] = [];
  if (structured.city && structured.city.trim()) {
    conditions.push('city = ?');
    params.push(structured.city.trim());
  }
  if (typeof structured.startMs === 'number' && typeof structured.endMs === 'number') {
    conditions.push('timestamp BETWEEN ? AND ?');
    params.push(structured.startMs, structured.endMs);
  } else if (typeof structured.startMs === 'number') {
    conditions.push('timestamp >= ?');
    params.push(structured.startMs);
  } else if (typeof structured.endMs === 'number') {
    conditions.push('timestamp <= ?');
    params.push(structured.endMs);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const rows = await databaseService.getAll(`SELECT id, uri, embedding FROM image_index${where}`, params);
  const candidates = rows.map((row: any) => ({ id: row.id, uri: row.uri, emb: toFloat32(row.embedding) }));
  if (candidates.length === 0) {
    return { results: [], phrases, filters: structured, message: 'No candidates' };
  }
  const scored: ExpandedResult[] = candidates.map((c) => {
    let best = 0;
    let bestPhrase = phrases[0] || query;
    for (let i = 0; i < vectors.length; i++) {
      const s = cosineSimilarity(vectors[i], c.emb);
      if (s > best) {
        best = s;
        bestPhrase = phrases[i];
      }
    }
    return { id: c.id, uri: c.uri, score: best, phrase: bestPhrase };
  });
  const filtered = scored.filter((r) => r.score >= threshold);
  filtered.sort((a, b) => b.score - a.score);
  const final = filtered.slice(0, limit);
  const message = `Expanded ${phrases.length} phrases with filters; matched ${filtered.length} of ${candidates.length}; returning ${final.length}.`;
  return { results: final, phrases, filters: structured, message };
}

export const hybridSearchApi = { searchByExpandedText, searchByHybridText };
