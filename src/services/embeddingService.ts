import { EmbeddingResult } from '../types';
import cactusService from './cactusService';
import onnxService from './onnxService';
import databaseService from './databaseService';
import geminiService from './geminiService';

/**
 * Embedding Service - Manages text and image embeddings for Text-Image Retrieval
 * 
 * Architecture:
 * - Image Embeddings: Cactus Visual Encoder (lfm2-vl-450m) - on-device
 * - Text Embeddings: Custom ONNX Text Encoder - on-device
 * 
 * Both encoders output vectors in the same embedding space for cosine similarity search.
 * 
 * Fallback priority for text:
 * 1. Custom ONNX text encoder (on-device, private) ⭐ PRIMARY
 * 2. Gemini API (cloud, requires API key)
 * 3. Mock fallback (for testing without models)
 */

class EmbeddingService {
  private initializingText = false;
  private initializingImage = false;

  /**
   * Initialize text embedding model
   * Uses SigLIP-2 ONNX text encoder for local inference
   */
  async initializeTextModel(onProgress?: (progress: number) => void): Promise<void> {
    if (this.initializingText) {
      console.log('Text model already initializing');
      return;
    }

    this.initializingText = true;
    
    try {
      console.log('Initializing Text Embedding Model (SigLIP-2 ONNX)...');
      
      const success = await onnxService.initialize();
      
      if (success) {
        console.log('✅ Text model initialized (SigLIP-2)');
        onProgress?.(1.0);
      } else {
        console.log('⚠️ Text model initialization failed, will use fallback');
      }
    } catch (error) {
      console.error('Text model error:', error);
    } finally {
      this.initializingText = false;
    }
  }

  /**
   * Initialize image embedding model
   * Uses Cactus lfm2-vl-450m model for local inference
   */
  async initializeImageModel(onProgress?: (progress: number) => void): Promise<void> {
    if (this.initializingImage) {
      console.log('Image model already initializing');
      return;
    }

    this.initializingImage = true;
    
    try {
      console.log('Initializing Image Embedding Model (Cactus)...');
      const success = await cactusService.initVisionModel((progress) => {
        console.log(`Vision model: ${Math.round(progress * 100)}%`);
        onProgress?.(progress);
      });
      
      if (success) {
        console.log('✅ Vision model initialized (Cactus)');
      } else {
        console.log('⚠️ Vision model initialization failed, will use fallback');
      }
    } catch (error) {
      console.error('Vision model error:', error);
    } finally {
      this.initializingImage = false;
    }
  }

  /**
   * Generate text embedding
   * 
   * Priority:
   * 1. Custom ONNX text encoder (private, on-device) ⭐ PRIMARY
   * 2. Gemini API (cloud, requires key)
   * 3. Mock fallback
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    // Try ONNX first (local, private, custom encoder)
    if (onnxService.available()) {
      const embedding = await onnxService.embedText(text);
      if (embedding && embedding.length > 0) {
        console.log(`✅ Text embedded locally with ONNX (${embedding.length}D)`);
        return { embedding, success: true };
      }
    } else {
      // Auto-initialize if not ready
      console.log('Auto-initializing ONNX text model...');
      await this.initializeTextModel();
      
      // Retry after initialization
      const embedding = await onnxService.embedText(text);
      if (embedding && embedding.length > 0) {
        console.log(`✅ Text embedded locally with ONNX (${embedding.length}D)`);
        return { embedding, success: true };
      }
    }

    // Try Gemini as fallback
    if (geminiService.hasApiKey()) {
      const embedding = await geminiService.embedText(text);
      if (embedding && embedding.length > 0) {
        console.log(`✅ Text embedded via Gemini (${embedding.length}D)`);
        return { embedding, success: true };
      }
    }

    // Mock fallback for demo/testing
    console.warn('⚠️ Using mock text embedding (no real model available)');
    const mockEmbedding = Array(512).fill(0).map(() => Math.random());
    return { embedding: mockEmbedding, success: true };
  }

  /**
   * Generate image embedding
   * 
   * Uses Cactus Visual Encoder (lfm2-vl-450m) for on-device image embeddings.
   * Output vectors are in the same space as your ONNX text embeddings for similarity search.
   */
  async embedImage(imagePath: string): Promise<EmbeddingResult> {
    // Try Cactus first (local, private)
    const status = cactusService.getStatus();
    
    if (status.available && status.visionReady) {
      const embedding = await cactusService.imageEmbed(imagePath);
      if (embedding && embedding.length > 0) {
        console.log(`✅ Image embedded locally with Cactus (${embedding.length}D)`);
        return { embedding, success: true };
      }
    } else if (status.available && !status.visionReady && !status.downloadingVision) {
      // Auto-initialize if available but not ready
      console.log('Auto-initializing vision model...');
      await this.initializeImageModel();
      
      // Retry after initialization
      const embedding = await cactusService.imageEmbed(imagePath);
      if (embedding && embedding.length > 0) {
        console.log(`✅ Image embedded locally with Cactus (${embedding.length}D)`);
        return { embedding, success: true };
      }
    }

    // Mock fallback for demo/testing
    console.warn('⚠️ Using mock image embedding (no real model available)');
    const mockEmbedding = Array(512).fill(0).map(() => Math.random());
    return { embedding: mockEmbedding, success: true };
  }

  /**
   * Generate caption for image using vision model
   */
  async generateCaption(imagePath: string): Promise<string | null> {
    const status = cactusService.getStatus();
    
    if (status.available && status.visionReady) {
      const caption = await cactusService.analyzeImage(
        imagePath,
        "Describe this image in one concise sentence."
      );
      
      if (caption) {
        console.log('✅ Caption generated locally');
        return caption;
      }
    } else if (status.available && !status.visionReady && !status.downloadingVision) {
      // Auto-initialize
      console.log('Auto-initializing vision model for caption...');
      await this.initializeImageModel();
      
      // Retry
      const caption = await cactusService.analyzeImage(
        imagePath,
        "Describe this image in one concise sentence."
      );
      
      if (caption) {
        console.log('✅ Caption generated locally');
        return caption;
      }
    }

    // Fallback
    console.warn('⚠️ Using mock caption');
    return "A photo";
  }

  /**
   * Generate caption with location context (city, time)
   */
  async generateCaptionWithContext(photo: { 
    id: string; 
    uri: string; 
  }): Promise<{ caption: string | null; city: string | null; time: string | null }> {
    const caption = await this.generateCaption(photo.uri);
    
    // Try to get metadata from database
    const metadata = await databaseService.getPhotoMetadata(photo.id);
    
    return {
      caption,
      city: metadata?.city || null,
      time: metadata?.timestamp ? new Date(metadata.timestamp).toLocaleString() : null,
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      cactus: cactusService.getStatus(),
      onnx: onnxService.getStatus(),
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await cactusService.destroy();
    await onnxService.destroy();
  }
}

export default new EmbeddingService();
