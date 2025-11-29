import { EmbeddingResult } from '../types';
import cactusService from './cactusService';
import databaseService from './databaseService';
import geminiService from './geminiService';

class EmbeddingService {
  private textModelInitialized = false;
  private imageModelInitialized = false;

  /**
   * Initialize text embedding model (MOCKED for Expo Go)
   */
  async initializeTextModel(model: string = 'qwen3-0.6'): Promise<void> {
    console.log('Initializing Text Model (Mocked)...');
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 500));
    this.textModelInitialized = true;
    console.log('Text model initialized (Mocked)');
  }

  /**
   * Initialize image embedding model (MOCKED for Expo Go)
   */
  async initializeImageModel(model: string = 'lfm2-vl-450m'): Promise<void> {
    console.log('Initializing Image Model (Mocked)...');
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 500));
    this.imageModelInitialized = true;
    console.log('Image model initialized (Mocked)');
  }

  /**
   * Generate text embedding (MOCKED)
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    // Prefer Gemini cloud embedding if available
    if (geminiService.hasApiKey()) {
      const vec = await geminiService.embedText(text);
      if (vec && vec.length > 0) {
        return { embedding: vec, success: true };
      }
    }
    if (!this.textModelInitialized) {
      await this.initializeTextModel();
    }
    const dummyEmbedding = Array(384).fill(0).map(() => Math.random());
    return { embedding: dummyEmbedding, success: true };
  }

  /**
   * Generate image embedding (MOCKED)
   */
  async embedImage(imagePath: string): Promise<EmbeddingResult> {
    // Prefer Cactus if available
    if (cactusService.available()) {
      const vec = await cactusService.imageEmbed(imagePath);
      if (vec && vec.length > 0) {
        return { embedding: vec, success: true };
      }
    }
    if (!this.imageModelInitialized) {
      await this.initializeImageModel();
    }
    const dummyEmbedding = Array(384).fill(0).map(() => Math.random());
    return { embedding: dummyEmbedding, success: true };
  }

  /**
   * Generate caption for image using vision model (MOCKED)
   */
  async generateCaption(imagePath: string): Promise<string | null> {
    if (!cactusService.available()) {
      if (!this.imageModelInitialized) {
        await this.initializeImageModel();
      }
      return "A photo";
    }
    const text = await cactusService.analyzeImage(imagePath, "Describe the image in one concise sentence.");
    return text || null;
  }

  async generateCaptionWithContext(ref: { id?: string; uri?: string }): Promise<{ caption: string | null; city?: string | null; time?: string | null }> {
    let row: any | null = null;
    if (ref.id) {
      const rows = await databaseService.getAll('SELECT uri, city, timestamp FROM image_index WHERE id = ?', [ref.id]);
      row = rows?.[0] || null;
    }
    if (!row && ref.uri) {
      const rows = await databaseService.getAll('SELECT uri, city, timestamp FROM image_index WHERE uri = ?', [ref.uri]);
      row = rows?.[0] || null;
    }
    const uri = row?.uri || ref.uri || null;
    if (!uri) {
      return { caption: null, city: null, time: null };
    }
    const city = row?.city ?? null;
    const ts = typeof row?.timestamp === 'number' ? row.timestamp : null;
    const time = ts ? new Date(ts).toLocaleString() : null;
    const ctx = `Location: ${city ?? 'Unknown'}; Time: ${time ?? 'Unknown'}.`;
    const prompt = `Using the context (${ctx}) generate a natural, concise caption describing the image.`;
    const text = await cactusService.analyzeImage(uri, prompt);
    return { caption: text || null, city, time };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.textModelInitialized = false;
    this.imageModelInitialized = false;
  }
}

export default new EmbeddingService();
