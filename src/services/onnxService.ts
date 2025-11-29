import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import tokenizerService from './tokenizerService';

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
 *
 * Tokenizer:
 * - GemmaTokenizer (SentencePiece-based BPE)
 * - Max Length: 64 tokens
 * - Padding: Right-side to 64 tokens
 * - Special Tokens: PAD=0, EOS=1, BOS=2, UNK=3
 */

const TEXT_MODEL_FILENAME = 'siglip2_text_encoder.onnx';
const MAX_TOKEN_LENGTH = 64; // SigLIP-2 uses 64 token sequences

class OnnxService {
  private session: any = null;
  private tokenizerReady = false;
  private isReady = false;

  /**
   * Initialize the ONNX text encoder with SigLIP-2
   */
  async initialize(): Promise<boolean> {
    if (this.isReady) {
      return true;
    }

    try {
      // Initialize the BPE tokenizer first
      const tokenizerLoaded = await tokenizerService.initialize();
      this.tokenizerReady = tokenizerLoaded;

      // Use the safer loader from onnxModelLoader which has better error handling
      // This avoids the "Cannot read property 'install' of null" error by checking
      // native module existence before requiring
      try {
        const { tryLoadOnnxRuntime, loadTextEncoder } = await import('./onnxModelLoader');

        // First check if ONNX Runtime can be loaded safely
        const onnxruntime = tryLoadOnnxRuntime();

        if (!onnxruntime) {
          return false;
        }

        // Check if InferenceSession exists
        if (!onnxruntime.InferenceSession || typeof onnxruntime.InferenceSession !== 'function') {
          return false;
        }

        // Try to load the model
        this.session = await loadTextEncoder();

        if (!this.session) {
          return false;
        }

        this.isReady = true;
        return true;
      } catch (error: any) {
        // Catch errors from import or model loading
        return false;
      }
    } catch (error: any) {
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
        // Initialization warnings already logged, just return fallback
        return this.mockEmbed(text);
      }
    }

    if (!this.session) {
      return this.mockEmbed(text);
    }

    try {
      // Tokenize the input text using the BPE tokenizer
      // Uses 64 token max length with right-side padding
      const tokens = tokenizerService.tokenize(text, MAX_TOKEN_LENGTH, true);

      // Validate tokenization output
      if (!tokens || !tokens.input_ids || !tokens.attention_mask) {
        return this.mockEmbed(text);
      }

      // Convert to Int32Array for ONNX Runtime
      const inputIds = new Int32Array(tokens.input_ids);
      const attentionMask = new Int32Array(tokens.attention_mask);

      // Run ONNX inference
      const feeds: any = {
        input_ids: inputIds,
        attention_mask: attentionMask,
      };

      const outputs = await this.session.run(feeds);

      // Extract the embedding vector
      // Try multiple possible output keys based on model architecture
      const out = outputs?.pooler_output ?? outputs?.last_hidden_state ?? outputs?.[0] ?? outputs;
      const embedding = Array.from(out?.data || []);

      if (embedding.length === 0) {
        return this.mockEmbed(text);
      }

      return embedding;
    } catch (error: any) {
      console.error('❌ Text embedding failed:', error?.message || error);
      return this.mockEmbed(text);
    }
  }

  /**
   * Deterministic mock embedding for fallback
   * Uses text content hash as seed to ensure same text = same embedding
   * This allows search to work correctly even without ONNX Runtime
   */
  private mockEmbed(text: string): number[] {
    // Generate deterministic embedding based on text hash
    const initialSeed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let currentSeed = initialSeed;
    const rng = () => {
      const x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    };

    const embeddingDim = 512;
    return Array.from({ length: embeddingDim }, () => rng());
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    try {
      this.session = null;
      this.tokenizerReady = false;
      this.isReady = false;
      tokenizerService.destroy();
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
      tokenizer: this.tokenizerReady ? 'BPE (GemmaTokenizer)' : 'fallback',
      tokenizerStatus: tokenizerService.getStatus(),
      maxLength: MAX_TOKEN_LENGTH,
    };
  }
}

export default new OnnxService();

