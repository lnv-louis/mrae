import { CactusLM, type CactusLMEmbedResult, type CactusLMImageEmbedParams, type CactusLMImageEmbedResult } from 'cactus-react-native';
import { EmbeddingResult } from '../types';

class EmbeddingService {
  private textModel: CactusLM | null = null;
  private imageModel: CactusLM | null = null;
  private textModelInitialized = false;
  private imageModelInitialized = false;

  /**
   * Initialize text embedding model (Qwen3)
   */
  async initializeTextModel(model: string = 'qwen3-0.6'): Promise<void> {
    if (this.textModelInitialized && this.textModel) {
      return;
    }

    try {
      this.textModel = new CactusLM({ model });
      
      // Check if model is downloaded
      const models = await this.textModel.getModels();
      const targetModel = models.find(m => m.slug === model || m.name === model);
      
      if (!targetModel?.isDownloaded) {
        console.log(`Downloading text model: ${model}`);
        await this.textModel.download({
          onProgress: (progress) => {
            console.log(`Text model download: ${Math.round(progress * 100)}%`);
          },
        });
      }

      this.textModelInitialized = true;
      console.log(`Text model ${model} initialized`);
    } catch (error) {
      console.error('Error initializing text model:', error);
      throw error;
    }
  }

  /**
   * Initialize image embedding model (Vision model)
   */
  async initializeImageModel(model: string = 'lfm2-vl-450m'): Promise<void> {
    if (this.imageModelInitialized && this.imageModel) {
      return;
    }

    try {
      this.imageModel = new CactusLM({ model });
      
      // Check if model is downloaded
      const models = await this.imageModel.getModels();
      const targetModel = models.find(m => m.slug === model || m.name === model);
      
      if (!targetModel?.isDownloaded) {
        console.log(`Downloading image model: ${model}`);
        await this.imageModel.download({
          onProgress: (progress) => {
            console.log(`Image model download: ${Math.round(progress * 100)}%`);
          },
        });
      }

      this.imageModelInitialized = true;
      console.log(`Image model ${model} initialized`);
    } catch (error) {
      console.error('Error initializing image model:', error);
      throw error;
    }
  }

  /**
   * Generate text embedding
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    if (!this.textModel || !this.textModelInitialized) {
      await this.initializeTextModel();
    }

    try {
      const result: CactusLMEmbedResult = await this.textModel!.embed({ text });
      return {
        embedding: result.embedding,
        success: true,
      };
    } catch (error) {
      console.error('Error generating text embedding:', error);
      return {
        embedding: [],
        success: false,
      };
    }
  }

  /**
   * Generate image embedding
   */
  async embedImage(imagePath: string): Promise<EmbeddingResult> {
    if (!this.imageModel || !this.imageModelInitialized) {
      await this.initializeImageModel();
    }

    try {
      // Try embedImage method (check Cactus SDK docs for exact API)
      // Based on documentation, this should work for vision models
      if (typeof (this.imageModel as any).embedImage === 'function') {
        const result: CactusLMImageEmbedResult = await (this.imageModel as any).embedImage({ 
          imagePath 
        });
        return {
          embedding: result.embedding,
          success: true,
        };
      } else {
        // Fallback: If embedImage doesn't exist, we'll need to use a different approach
        // For now, return error - this needs to be verified with actual Cactus SDK
        console.warn('embedImage method not found on CactusLM. Please verify Cactus SDK API.');
        return {
          embedding: [],
          success: false,
        };
      }
    } catch (error) {
      console.error('Error generating image embedding:', error);
      return {
        embedding: [],
        success: false,
      };
    }
  }

  /**
   * Generate caption for image using vision model
   */
  async generateCaption(imagePath: string): Promise<string | null> {
    if (!this.imageModel || !this.imageModelInitialized) {
      await this.initializeImageModel();
    }

    try {
      const result = await this.imageModel!.complete({
        messages: [
          {
            role: 'user',
            content: 'Describe this image in one sentence.',
            images: [imagePath],
          },
        ],
      });

      return result.response || null;
    } catch (error) {
      console.error('Error generating caption:', error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.textModel) {
      await this.textModel.destroy();
      this.textModel = null;
      this.textModelInitialized = false;
    }
    if (this.imageModel) {
      await this.imageModel.destroy();
      this.imageModel = null;
      this.imageModelInitialized = false;
    }
  }
}

export default new EmbeddingService();

