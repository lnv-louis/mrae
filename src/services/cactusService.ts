import { CactusLM, CactusConfig, type Message } from 'cactus-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cactus Service - Real on-device ML using Cactus SDK
 * Handles ONLY image embeddings and image analysis
 * 
 * Architecture:
 * - Image Embeddings: Cactus Visual Encoder (lfm2-vl-450m) - 450MB
 * - Text Embeddings: Custom ONNX Text Encoder (handled separately in onnxService)
 * 
 * Both encoders output vectors in the same embedding space for similarity search.
 * 
 * Model:
 * - lfm2-vl-450m: Vision + Language (450M params) - for image analysis and embeddings
 * 
 * Documentation: https://cactuscompute.com/docs/react-native
 */

const STORAGE_KEY_VISION_DOWNLOADED = '@cactus_vision_model_downloaded';

class CactusService {
  private visionModel: CactusLM | null = null;
  
  private visionModelName = 'lfm2-vl-450m';
  
  private visionReady = false;
  private visionDownloaded = false;
  
  private isDownloadingVision = false;
  
  // Queue for serializing image embedding calls (Cactus doesn't support concurrent inference)
  private embeddingQueue: Array<{
    imagePath: string;
    resolve: (value: number[] | null) => void;
    reject: (error: any) => void;
  }> = [];
  private isProcessingEmbedding = false;

  /**
   * Configure Cactus with telemetry and hybrid mode
   */
  configure(options?: { 
    telemetryToken?: string; 
    cactusToken?: string;
    enableTelemetry?: boolean;
  }): void {
    if (options?.telemetryToken) {
      CactusConfig.telemetryToken = options.telemetryToken;
    }
    if (options?.cactusToken) {
      CactusConfig.cactusToken = options.cactusToken;
    }
    if (options?.enableTelemetry !== undefined) {
      CactusConfig.isTelemetryEnabled = options.enableTelemetry;
    }
  }

  /**
   * Check if Cactus SDK is available
   */
  available(): boolean {
    return !!CactusLM;
  }

  /**
   * Check if vision model is already downloaded
   */
  private async isModelDownloaded(): Promise<boolean> {
    try {
      const downloaded = await AsyncStorage.getItem(STORAGE_KEY_VISION_DOWNLOADED);
      return downloaded === 'true';
    } catch (error) {
      console.error('Error checking model download status:', error);
      return false;
    }
  }

  /**
   * Mark vision model as downloaded
   */
  private async markModelDownloaded(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_VISION_DOWNLOADED, 'true');
      this.visionDownloaded = true;
    } catch (error) {
      console.error('Error marking model as downloaded:', error);
    }
  }

  /**
   * Initialize the vision model (lfm2-vl-450m)
   * Use for image analysis and image embeddings
   * 
   * The model is downloaded only once on first launch and cached locally.
   * Subsequent calls will use the cached model.
   */
  async initVisionModel(onProgress?: (progress: number) => void): Promise<boolean> {
    if (!this.available()) {
      console.log('Cactus SDK not available');
      return false;
    }

    if (this.visionReady) {
      console.log('Vision model already ready');
      return true;
    }

    if (this.isDownloadingVision) {
      console.log('Vision model already downloading');
      return false;
    }

    try {
      this.isDownloadingVision = true;
      
      // Create model instance if needed
      if (!this.visionModel) {
        console.log(`Creating Cactus vision model: ${this.visionModelName}`);
        this.visionModel = new CactusLM({ 
          model: this.visionModelName,
          contextSize: 2048,
        });
      }

      // Check if model is already downloaded
      const alreadyDownloaded = await this.isModelDownloaded();
      
      if (alreadyDownloaded) {
        console.log('✅ Vision model already downloaded, skipping download');
        onProgress?.(1.0); // Report 100% progress immediately
      } else {
        // Download the model (first time only)
        console.log('📥 Downloading vision model (first launch)...');
        await this.visionModel.download({
          onProgress: (progress) => {
            console.log(`Vision model download: ${Math.round(progress * 100)}%`);
            onProgress?.(progress);
          },
        });
        
        // Mark as downloaded for future launches
        await this.markModelDownloaded();
        console.log('✅ Vision model downloaded and cached');
      }

      // Initialize the model
      console.log('🔧 Initializing vision model...');
      try {
        await this.visionModel.init();
        this.visionReady = true;
        this.isDownloadingVision = false;
        console.log('✅ Vision model ready!');
        return true;
      } catch (initError: any) {
        console.error('❌ Vision model init failed:', initError?.message || initError);
        
        // Try one more time after a short delay
        console.log('🔄 Retrying initialization...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          await this.visionModel.init();
          this.visionReady = true;
          this.isDownloadingVision = false;
          console.log('✅ Vision model ready (after retry)!');
          return true;
        } catch (retryError: any) {
          console.error('❌ Vision model init failed again:', retryError?.message || retryError);
          this.isDownloadingVision = false;
          this.visionReady = false;
          return false;
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to initialize vision model:', error?.message || error);
      this.isDownloadingVision = false;
      this.visionReady = false;
      return false;
    }
  }

  /**
   * Process the embedding queue (one at a time)
   */
  private async processEmbeddingQueue(): Promise<void> {
    if (this.isProcessingEmbedding || this.embeddingQueue.length === 0) {
      return;
    }

    this.isProcessingEmbedding = true;

    while (this.embeddingQueue.length > 0) {
      const item = this.embeddingQueue.shift();
      if (!item) break;

      try {
        if (!this.visionReady || !this.visionModel) {
          item.reject(new Error('Vision model not ready'));
          continue;
        }

        const result = await this.visionModel.imageEmbed({ imagePath: item.imagePath });
        item.resolve(result.embedding || null);
      } catch (error) {
        console.error('Image embedding failed:', error);
        item.reject(error);
      }
    }

    this.isProcessingEmbedding = false;
  }

  /**
   * Generate image embedding using vision model
   * Returns a vector representation of the image
   * This vector can be compared with text embeddings from your custom ONNX encoder
   * 
   * Uses a queue to serialize calls (Cactus doesn't support concurrent inference)
   */
  async imageEmbed(imagePath: string): Promise<number[] | null> {
    if (!this.visionReady) {
      await this.initVisionModel();
    }

    if (!this.visionReady || !this.visionModel) {
      return null;
    }

    // Queue the embedding request
    return new Promise<number[] | null>((resolve, reject) => {
      this.embeddingQueue.push({ imagePath, resolve, reject });
      this.processEmbeddingQueue();
    });
  }

  /**
   * Analyze an image with a text prompt
   * Uses vision model to understand and describe the image
   */
  async analyzeImage(
    imagePath: string, 
    prompt: string = "Describe this image in one concise sentence.",
    onToken?: (token: string) => void
  ): Promise<string | null> {
    if (!this.visionReady) {
      await this.initVisionModel();
    }

    if (!this.visionReady || !this.visionModel) {
      return null;
    }

    try {
      const messages: Message[] = [
        {
          role: 'user',
          content: prompt,
          images: [imagePath],
        },
      ];

      const result = await this.visionModel.complete({ 
        messages,
        onToken,
        options: {
          temperature: 0.7,
          maxTokens: 100,
        },
      });

      return result.response || null;
    } catch (error) {
      console.error('Image analysis failed:', error);
      return null;
    }
  }

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      available: this.available(),
      visionReady: this.visionReady,
      visionDownloaded: this.visionDownloaded,
      downloadingVision: this.isDownloadingVision,
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    try {
      if (this.visionModel) {
        await this.visionModel.destroy();
        this.visionModel = null;
      }
      this.visionReady = false;
    } catch (error) {
      console.error('Error destroying Cactus models:', error);
    }
  }

  /**
   * Clear downloaded model cache (for debugging/testing)
   * Forces re-download on next initialization
   */
  async clearModelCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_VISION_DOWNLOADED);
      this.visionDownloaded = false;
      console.log('✅ Model cache cleared');
    } catch (error) {
      console.error('Error clearing model cache:', error);
    }
  }
}

export default new CactusService();
