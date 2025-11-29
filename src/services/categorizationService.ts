import geminiService from './geminiService';
import embeddingService from './embeddingService';
import databaseService from './databaseService';
import * as FileSystem from 'expo-file-system';

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

/**
 * Automatically categorize all images using AI vision analysis
 * Analyzes actual photos for mood, color palette, and aesthetic qualities
 * Uses Gemini Vision API to generate categories from real image content
 */
export async function autoCategorizeAllImages(
  options?: { sampleSize?: number; threshold?: number }
): Promise<{ labels: string[]; counts: Array<{ label: string; topScore: number; count: number }>; message: string }> {
  const threshold = options?.threshold ?? 0.25;
  const sampleSize = options?.sampleSize ?? 5; // Analyze first N photos with vision API

  console.log('🎨 Starting automatic categorization with vision analysis...');

  // Get sample indexed images with URIs
  await databaseService.initImageLabels();
  const rows = await databaseService.getAll('SELECT id, uri, embedding FROM image_index LIMIT ?', [sampleSize]);

  if (rows.length === 0) {
    throw new Error('No indexed images found. Please index photos first.');
  }

  console.log(`📸 Analyzing ${rows.length} sample photos with Gemini Vision API...`);

  // Read sample images as base64 and prepare for vision analysis
  const imageDataArray: string[] = [];

  for (const row of rows) {
    try {
      const uri = row.uri as string;
      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      imageDataArray.push(base64);
    } catch (error) {
      console.error(`Failed to read image ${row.id}:`, error);
    }
  }

  if (imageDataArray.length === 0) {
    throw new Error('Failed to read any images for analysis.');
  }

  console.log(`✅ Successfully loaded ${imageDataArray.length} images for analysis`);

  // Use vision model to analyze actual photos and extract categories
  const analysisPrompt = `Analyze the photos I'm providing and return ONLY a JSON object with key "categories" containing an array of 15-20 short category labels (2-4 words each).

Focus on what you ACTUALLY SEE in these photos:
- Mood & emotion (happy, melancholic, energetic, peaceful, nostalgic)
- Color palette (warm tones, cool blues, vibrant, muted, golden hour)
- Visual aesthetics (minimalist, busy, natural, urban, artistic)
- Lighting & atmosphere (bright, moody, soft light, dramatic)
- Composition style (portrait, landscape, close-up, wide angle)
- Subject matter (people, nature, food, architecture, etc.)

Examples: "golden hour", "vibrant colors", "peaceful nature", "urban architecture", "warm memories", "moody atmosphere"

Return ONLY valid JSON: {"categories": ["label1", "label2", ...]}`;

  let categories: string[] = [];

  try {
    // Prepare message with text and multiple images
    const contentParts: any[] = [{ type: 'text', text: analysisPrompt }];

    // Add each image to the content
    for (const imageData of imageDataArray) {
      contentParts.push({
        type: 'inline_data',
        inline_data: {
          mime_type: 'image/jpeg',
          data: imageData
        }
      });
    }

    console.log('🤖 Sending images to Gemini Vision API...');

    // Use the IMAGE_MODEL for vision analysis
    const response = await geminiService.generateContent(
      [{ role: 'user', content: contentParts }],
      geminiService.getImageModel()
    );

    const text = response?.candidates?.[0]?.content?.parts?.find((x: any) => x.text)?.text || '{}';
    console.log('📝 Received response from Gemini Vision API');

    try {
      const parsed = JSON.parse(text);
      categories = parsed.categories || parsed.labels || [];

      if (!Array.isArray(categories) || categories.length === 0) {
        throw new Error('Invalid categories format from API');
      }

      // Clean and validate categories
      categories = categories
        .map((s: any) => String(s).trim())
        .filter((s: string) => s.length > 2 && s.length < 40)
        .slice(0, 20);

      console.log(`✨ Generated ${categories.length} categories from actual photo analysis`);

    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      // Try to extract labels from text as fallback
      const matches = text.match(/"([^"]+)"/g);
      if (matches && matches.length > 0) {
        categories = matches
          .map(m => m.replace(/"/g, '').trim())
          .filter(s => s.length > 2 && s.length < 40)
          .slice(0, 20);
        console.log(`📋 Extracted ${categories.length} categories from text response`);
      }
    }
  } catch (error) {
    console.error('Failed to analyze images with Vision API:', error);
    throw new Error('Failed to analyze photos with AI. Please check your API key and try again.');
  }

  if (categories.length === 0) {
    throw new Error('No valid categories generated from photo analysis. Please try again.');
  }

  console.log(`🏷️ Categories from vision analysis:`, categories.slice(0, 5));

  // Get all images for categorization
  const allRows = await databaseService.getAll('SELECT id, embedding FROM image_index');
  const images = allRows.map((r: any) => ({ id: r.id, emb: toFloat32(r.embedding) }));

  console.log(`🔍 Categorizing ${images.length} total images...`);

  // Embed each category label
  const labelVectors: { [label: string]: Float32Array } = {};
  for (const label of categories) {
    const vec = await embeddingService.embedText(label);
    const v = toFloat32(vec.embedding);
    if (v.length > 0) labelVectors[label] = v;
  }

  // Calculate similarity scores and store labels
  const counts: Array<{ label: string; topScore: number; count: number }> = [];

  for (const label of categories) {
    const v = labelVectors[label];
    if (!v || v.length === 0) continue;

    let topScore = 0;
    let matchCount = 0;

    for (const img of images) {
      const similarity = cosineSimilarity(v, img.emb);

      if (similarity >= threshold) {
        matchCount++;
      }

      if (similarity > topScore) {
        topScore = similarity;
      }

      // Store all similarities for potential filtering
      await databaseService.insertImageLabel({
        image_id: img.id,
        label,
        score: similarity
      });
    }

    counts.push({ label, topScore, count: matchCount });
  }

  // Sort by count (most popular categories first)
  counts.sort((a, b) => b.count - a.count || b.topScore - a.topScore);

  const message = `✨ Auto-categorized ${images.length} images into ${categories.length} AI-generated categories`;
  console.log(message);
  console.log('Top categories:', counts.slice(0, 5).map(c => `${c.label} (${c.count})`));

  return { labels: categories, counts, message };
}

export default {
  categorizeAllImagesFromPrompt,
  autoCategorizeAllImages
};

