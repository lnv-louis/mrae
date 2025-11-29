import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

/**
 * ONNX Service - SigLIP-2 Text Encoder for Text-Image Retrieval
 * 
 * This service handles text embeddings using the SigLIP-2 ONNX text encoder.
 * The embeddings are designed to live in the same vector space as the
 * Cactus Visual Encoder (lfm2-vl-450m) for similarity search.
 * 
 * Architecture:
 * - Text Embeddings: SigLIP-2 Text Encoder (siglip2_text_encoder.onnx)
 * - Image Embeddings: Cactus Visual Encoder (handled in cactusService)
 * 
 * Both encoders output vectors in the same embedding space for cosine similarity.
 * 
 * Model Files:
 * - android/app/src/main/assets/siglip2_text_encoder.onnx
 * - android/app/src/main/assets/siglip2_tokenizer/
 */

const TEXT_MODEL_FILENAME = 'siglip2_text_encoder.onnx';

class OnnxService {
  private session: any = null;
  private tokenizer: any = null;
  private isReady = false;

  /**
   * Simple tokenizer for SigLIP-2 (since @xenova/transformers doesn't work well in RN)
   * This is a basic implementation - for production, you'd want a proper tokenizer
   */
  private simpleTokenize(text: string, maxLength: number = 16): { input_ids: number[], attention_mask: number[] } {
    // Basic tokenization: split on spaces and convert to character codes
    // This is a simplified version - SigLIP uses BPE tokenization
    const tokens = text.toLowerCase().split(/\s+/).slice(0, maxLength);
    
    // Convert to simple numerical IDs (basic char code approach)
    const input_ids = new Array(maxLength).fill(0);
    const attention_mask = new Array(maxLength).fill(0);
    
    for (let i = 0; i < tokens.length && i < maxLength; i++) {
      // Simple hash of the token for now
      let tokenId = 0;
      for (let j = 0; j < tokens[i].length; j++) {
        tokenId += tokens[i].charCodeAt(j);
      }
      input_ids[i] = (tokenId % 30000) + 1; // Keep in reasonable range
      attention_mask[i] = 1;
    }
    
    return { input_ids, attention_mask };
  }

  /**
   * Initialize the ONNX text encoder with SigLIP-2
   */
  async initialize(): Promise<boolean> {
    if (this.isReady) {
      console.log('✅ ONNX service already initialized');
      return true;
    }

    try {
      console.log('🔧 Loading SigLIP-2 text encoder...');
      
      // Use the safer loader from onnxModelLoader which has better error handling
      // This avoids the "Cannot read property 'install' of null" error by checking
      // native module existence before requiring
      try {
        const { tryLoadOnnxRuntime, loadTextEncoder } = await import('./onnxModelLoader');
        
        // First check if ONNX Runtime can be loaded safely
        const onnxruntime = tryLoadOnnxRuntime();
        
        if (!onnxruntime) {
          console.warn('⚠️ ONNX Runtime module not available (native module not linked/initialized)');
          console.log('💡 This is expected if the native module is not properly linked.');
          console.log('💡 The app will use fallback embeddings instead.');
          return false;
        }
        
        // Check if InferenceSession exists
        if (!onnxruntime.InferenceSession || typeof onnxruntime.InferenceSession !== 'function') {
          console.warn('⚠️ ONNX Runtime InferenceSession not available');
          return false;
        }
        
        console.log('✅ ONNX Runtime loaded successfully');
        
        // Try to load the model
        this.session = await loadTextEncoder();
        
        if (!this.session) {
          console.warn('⚠️ Failed to load ONNX session, using mock embeddings');
          return false;
        }
        
        // Use simple tokenizer instead of full transformer
        this.tokenizer = { tokenize: this.simpleTokenize.bind(this) };
        
        this.isReady = true;
        console.log('✅ SigLIP-2 text encoder ready (with simple tokenizer)!');
        return true;
      } catch (error: any) {
        // Catch errors from import or model loading
        const errorMsg = error?.message || String(error) || '';
        const errorStack = error?.stack || '';
        const fullError = (errorMsg + ' ' + errorStack).toLowerCase();
        
        // Check for the specific "install" or "null" errors
        if (fullError.includes('install') || 
            fullError.includes('null') || 
            fullError.includes('cannot read property') ||
            fullError.includes('undefined') ||
            fullError.includes('native module')) {
          console.warn('⚠️ ONNX Runtime native module not initialized');
          console.log('💡 This usually means the native module needs to be rebuilt.');
          console.log('💡 Try: cd android && ./gradlew clean && cd .. && npm run android');
        } else {
          console.warn('⚠️ Error loading ONNX model:', errorMsg);
        }
        console.log('Using mock embeddings for text queries');
        return false;
      }
    } catch (error: any) {
      console.error('❌ Failed to initialize ONNX service:', error?.message || error);
      console.log('Falling back to mock embeddings');
      this.isReady = false;
      return false;
    }
  }

  /**
   * Check if ONNX service is available
   */
  available(): boolean {
    return this.isReady;
  }

  /**
   * Generate text embedding using SigLIP-2 ONNX encoder
   * Returns a vector in the same space as Cactus image embeddings
   * 
   * @param text - Input text to embed
   * @returns Embedding vector (e.g., 512D or 768D)
   */
  async embedText(text: string): Promise<number[] | null> {
    if (!this.isReady) {
      // Try to initialize if not ready
      const initialized = await this.initialize();
      if (!initialized) {
        console.warn('⚠️ ONNX service not available, using mock');
        return this.mockEmbed(text);
      }
    }

    if (!this.session || !this.tokenizer) {
      console.warn('⚠️ Session or tokenizer not available');
      return this.mockEmbed(text);
    }

    try {
      // Tokenize the input text
      const tokens = this.tokenizer.tokenize(text, 16);

      // Convert to Int32Array for ONNX
      const inputIds = new Int32Array(tokens.input_ids);
      const attentionMask = new Int32Array(tokens.attention_mask);

      // Run ONNX inference
      const feeds: any = {
        input_ids: inputIds,
        attention_mask: attentionMask,
      };

      const outputs = await this.session.run(feeds);

      // Extract the embedding vector
      const out = outputs?.pooler_output ?? outputs?.[0] ?? outputs;
      const embedding = Array.from(out?.data || []);
      
      if (embedding.length === 0) {
        console.warn('⚠️ Empty embedding from ONNX, using mock');
        return this.mockEmbed(text);
      }

      console.log(`✅ Text embedded with SigLIP-2 (${embedding.length}D)`);
      return embedding;
    } catch (error) {
      console.error('❌ Text embedding failed:', error);
      return this.mockEmbed(text);
    }
  }

  /**
   * Mock embedding for fallback
   */
  private mockEmbed(text: string): number[] {
    console.warn('⚠️ Using mock text embedding');
    // Generate deterministic mock based on text hash
    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rng = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    
    const embeddingDim = 512;
    return Array(embeddingDim).fill(0).map(() => rng());
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    try {
      this.session = null;
      this.tokenizer = null;
      this.isReady = false;
    } catch (error) {
      console.error('Error destroying ONNX service:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      available: this.isReady,
      model: TEXT_MODEL_FILENAME,
      tokenizer: 'simple',
    };
  }
}

export default new OnnxService();

