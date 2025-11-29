import geminiService from './geminiService';
import embeddingService from './embeddingService';
import databaseService from './databaseService';

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

async function expandLabels(prompt: string): Promise<string[]> {
  const p = `Return JSON only with key labels: array of 5-20 concise image labels (<=6 words each) covering color, objects, scenes, moods. Query: ${prompt}`;
  const res = await geminiService.generateContent([{ role: 'user', content: p }]);
  const text = res?.candidates?.[0]?.content?.parts?.find((x: any) => x.text)?.text || '[]';
  try {
    const obj = JSON.parse(text);
    const arr = obj?.labels ?? obj;
    if (Array.isArray(arr)) return arr.map((s: any) => String(s)).filter((s) => s.trim().length > 0).slice(0, 20);
  } catch {}
  return text.split(/\n|,/).map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 20);
}

export async function categorizeAllImagesFromPrompt(
  prompt: string,
  options?: { threshold?: number }
): Promise<{ labels: string[]; counts: Array<{ label: string; topScore: number; count: number }>; message: string }>{
  const threshold = options?.threshold ?? 0.25;
  const labels = await expandLabels(prompt);
  if (labels.length === 0) return { labels: [], counts: [], message: 'No labels' };
  await databaseService.initImageLabels();
  const rows = await databaseService.getAll('SELECT id, embedding FROM image_index');
  const images = rows.map((r: any) => ({ id: r.id, emb: toFloat32(r.embedding) }));
  if (images.length === 0) return { labels, counts: [], message: 'No indexed images' };
  const labelVectors: { [label: string]: Float32Array } = {};
  for (const label of labels) {
    const vec = await embeddingService.embedText(label);
    const v = toFloat32(vec.embedding);
    if (v.length > 0) labelVectors[label] = v;
  }
  const counts: Array<{ label: string; topScore: number; count: number }> = [];
  for (const label of labels) {
    const v = labelVectors[label];
    if (!v || v.length === 0) continue;
    let top = 0;
    let c = 0;
    for (const img of images) {
      const s = cosineSimilarity(v, img.emb);
      if (s >= threshold) {
        c++;
      }
      if (s > top) top = s;
      await databaseService.insertImageLabel({ image_id: img.id, label, score: s });
    }
    counts.push({ label, topScore: top, count: c });
  }
  counts.sort((a, b) => b.count - a.count || b.topScore - a.topScore);
  const message = `Categorized ${images.length} images over ${labels.length} labels.`;
  return { labels, counts, message };
}

export default { categorizeAllImagesFromPrompt };

