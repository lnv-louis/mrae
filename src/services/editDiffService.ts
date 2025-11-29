import geminiService from './geminiService';
import nanoBananaService from './nanoBananaService';

function toBase64FromDataUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:image/')) {
    const idx = url.indexOf(',');
    return idx > -1 ? url.slice(idx + 1) : null;
  }
  return null;
}

async function toBase64FromPath(path: string): Promise<string | null> {
  const dataUrl = toBase64FromDataUrl(path);
  if (dataUrl) return dataUrl;
  let RNFS: any;
  try { RNFS = require('react-native-fs'); } catch { RNFS = null; }
  if (!RNFS) return null;
  try {
    const b64 = await RNFS.readFile(path, 'base64');
    return b64;
  } catch {
    return null;
  }
}

export async function diffAndApply(originalImagePath: string, editedImagePath: string): Promise<{
  diffText: string;
  instructions: string;
  result: { success: boolean; outputPath?: string; summary?: string };
}> {
  const origB64 = await toBase64FromPath(originalImagePath);
  const editB64 = await toBase64FromPath(editedImagePath);
  const partsOrig = origB64 ? [{ inline_data: { mime_type: 'image/jpeg', data: origB64 } }] : [];
  const partsEdit = editB64 ? [{ inline_data: { mime_type: 'image/jpeg', data: editB64 } }] : [];
  const prompt = 'Compare these images and produce concise JSON instructions describing edits needed to transform the original into the edited. Focus on object-level changes, colors, positions. Output only JSON with keys: steps: string[] and summary: string.';
  const messages = [
    { role: 'user', content: [ { type: 'text', text: prompt }, ...partsOrig, ...partsEdit ] },
  ];
  const res = await geminiService.generateContent(messages as any);
  const text = res?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
  let instructions = '';
  try {
    const obj = JSON.parse(text);
    instructions = Array.isArray(obj?.steps) ? obj.steps.join('\n') : String(obj?.summary || text);
  } catch {
    instructions = text;
  }
  const result = await nanoBananaService.applyDiff(originalImagePath, instructions);
  return { diffText: text, instructions, result };
}

export default { diffAndApply };

