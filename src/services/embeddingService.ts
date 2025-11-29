import { EmbeddingResult } from '../types';
import cactusService from './cactusService';
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
    if (!this.imageModelInitialized) {
      await this.initializeImageModel();
    }
    
    console.log('Generating caption (Mocked) for:', imagePath);
    return "A beautiful photo (Mocked Caption)";
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
