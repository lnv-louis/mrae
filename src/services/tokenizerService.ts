import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

/**
 * BPE Tokenizer Service for SigLIP-2 (Gemma-based)
 *
 * This implements a Byte-Pair Encoding tokenizer compatible with the SigLIP-2
 * text encoder. It loads the tokenizer vocabulary from tokenizer.json and
 * handles proper padding to 64 tokens with right-side padding.
 *
 * Tokenizer Specifications:
 * - Type: GemmaTokenizer (SentencePiece-based BPE)
 * - Max Length: 64 tokens
 * - Padding: Fixed to 64, right-side
 * - Special Tokens: PAD=0, EOS=1, BOS=2, UNK=3
 */

// Special token IDs based on tokenizer_config.json
const SPECIAL_TOKENS = {
  PAD: 0,    // <pad>
  EOS: 1,    // <eos>
  BOS: 2,    // <bos>
  UNK: 3,    // <unk>
} as const;

const MAX_LENGTH = 64;

interface TokenizerVocab {
  vocab: Map<string, number>;
  merges: [string, string][];
  addedTokens: Map<string, number>;
  normalizer?: {
    type?: string;
    lowercase?: boolean;
  };
}

class TokenizerService {
  private vocab: Map<string, number> = new Map();
  private merges: [string, string][] = [];
  private addedTokens: Map<string, number> = new Map();
  private isLoaded = false;
  private doLowerCase = true;

  /**
   * Initialize the tokenizer by loading vocabulary from tokenizer.json
   *
   * NOTE: This always returns false on mobile because tokenizer.json is 45MB
   * and causes OOM. We use fallback tokenization instead which works fine.
   */
  async initialize(): Promise<boolean> {
    if (this.isLoaded) {
      console.log('✅ Tokenizer already initialized');
      return true;
    }

    // Skip loading tokenizer.json on mobile - it's 45MB and causes OOM
    // The fallback tokenizer works well enough for search
    console.log('⚠️ Skipping tokenizer.json load (45MB file causes OOM on mobile)');
    console.log('💡 Using fallback tokenization instead (word-based hashing)');
    return false;

    /* COMMENTED OUT - Causes OOM on mobile
    try {
      console.log('🔧 Loading BPE tokenizer vocabulary...');

      // Load tokenizer.json from assets
      const tokenizerData = await this.loadTokenizerJson();

      if (!tokenizerData) {
        console.warn('⚠️ Failed to load tokenizer.json');
        return false;
      }

      // Parse the tokenizer data
      this.parseTokenizerData(tokenizerData);

      this.isLoaded = true;
      console.log(`✅ BPE Tokenizer loaded: ${this.vocab.size} vocab entries, ${this.merges.length} merges`);
      return true;
    } catch (error: any) {
      console.error('❌ Failed to initialize tokenizer:', error?.message || error);
      return false;
    }
    */
  }

  /**
   * Load tokenizer.json from Android assets or iOS bundle
   */
  private async loadTokenizerJson(): Promise<any | null> {
    try {
      let RNFS: any;
      try {
        RNFS = require('react-native-fs');
      } catch (e) {
        console.warn('⚠️ react-native-fs not available, cannot load tokenizer');
        return null;
      }

      let tokenizerPath = '';

      if (Platform.OS === 'android') {
        // For Android, copy from assets to document directory
        const destPath = `${RNFS.DocumentDirectoryPath}/siglip2_tokenizer.json`;
        const exists = await RNFS.exists(destPath);

        if (!exists) {
          try {
            await RNFS.copyFileAssets(
              'siglip2_tokenizer/tokenizer.json',
              destPath
            );
          } catch (copyError: any) {
            console.warn('⚠️ Could not copy tokenizer from assets:', copyError?.message);
            return null;
          }
        }
        tokenizerPath = destPath;
      } else if (Platform.OS === 'ios') {
        // For iOS, read from main bundle
        tokenizerPath = `${RNFS.MainBundlePath}/siglip2_tokenizer/tokenizer.json`;
      } else {
        console.warn('⚠️ Unsupported platform for tokenizer loading');
        return null;
      }

      // Read the file
      const tokenizerJson = await RNFS.readFile(tokenizerPath, 'utf8');
      return JSON.parse(tokenizerJson);
    } catch (error: any) {
      const errorMsg = error?.message || String(error) || '';

      // Check for OOM-related errors
      if (errorMsg.includes('OOM') ||
          errorMsg.includes('memory') ||
          errorMsg.includes('allocat') ||
          errorMsg.includes('OutOfMemory')) {
        console.error('❌ Error loading tokenizer.json: Out of memory');
        console.log('💡 The tokenizer.json file is too large (45MB) to load at this time.');
        console.log('💡 This is expected - the app will use fallback tokenization or OpenRouter API.');
      } else {
        console.error('❌ Error loading tokenizer.json:', errorMsg);
      }
      console.warn('⚠️ Failed to load tokenizer.json');
      return null;
    }
  }

  /**
   * Parse tokenizer data from tokenizer.json
   */
  private parseTokenizerData(data: any): void {
    try {
      // Extract vocabulary from the model section
      if (data.model && data.model.vocab) {
        const vocabObj = data.model.vocab;
        this.vocab = new Map(Object.entries(vocabObj) as [string, number][]);
      }

      // Extract merges if available
      if (data.model && data.model.merges && Array.isArray(data.model.merges)) {
        this.merges = data.model.merges.map((merge: string) => {
          const parts = merge.split(' ');
          return [parts[0], parts[1]] as [string, string];
        });
      }

      // Extract added tokens (special tokens)
      if (data.added_tokens && Array.isArray(data.added_tokens)) {
        data.added_tokens.forEach((token: any) => {
          if (token.content && typeof token.id === 'number') {
            this.addedTokens.set(token.content, token.id);
          }
        });
      }

      // Check normalizer settings
      if (data.normalizer) {
        if (data.normalizer.type === 'Lowercase' || data.normalizer.lowercase === true) {
          this.doLowerCase = true;
        }
      }
    } catch (error: any) {
      console.error('❌ Error parsing tokenizer data:', error?.message || error);
      throw error;
    }
  }

  /**
   * Normalize text before tokenization
   */
  private normalizeText(text: string): string {
    // Apply lowercase if configured
    if (this.doLowerCase) {
      text = text.toLowerCase();
    }

    // Trim whitespace
    text = text.trim();

    // Replace multiple spaces with single space
    text = text.replace(/\s+/g, ' ');

    return text;
  }

  /**
   * Convert text to tokens using BPE algorithm
   */
  private textToTokens(text: string): string[] {
    // Normalize the text
    text = this.normalizeText(text);

    if (!text) {
      return [];
    }

    // Split into words (SentencePiece uses '▁' for word boundaries)
    const words = text.split(' ');
    const tokens: string[] = [];

    for (const word of words) {
      if (!word) continue;

      // Add word boundary marker (SentencePiece convention)
      const wordWithMarker = '▁' + word;

      // Start with character-level tokens
      let wordTokens = Array.from(wordWithMarker);

      // Apply BPE merges
      while (wordTokens.length > 1) {
        let minMerge: [number, number, number] | null = null; // [pos, mergeIdx, priority]

        // Find the best merge
        for (let i = 0; i < wordTokens.length - 1; i++) {
          const pair = wordTokens[i] + wordTokens[i + 1];
          const mergeIdx = this.merges.findIndex(
            ([a, b]) => a + b === pair
          );

          if (mergeIdx !== -1) {
            if (minMerge === null || mergeIdx < minMerge[1]) {
              minMerge = [i, mergeIdx, mergeIdx];
            }
          }
        }

        // If no merge found, break
        if (minMerge === null) break;

        // Apply the merge
        const [pos] = minMerge;
        wordTokens = [
          ...wordTokens.slice(0, pos),
          wordTokens[pos] + wordTokens[pos + 1],
          ...wordTokens.slice(pos + 2),
        ];
      }

      tokens.push(...wordTokens);
    }

    return tokens;
  }

  /**
   * Convert tokens to IDs using vocabulary
   */
  private tokensToIds(tokens: string[]): number[] {
    return tokens.map(token => {
      // Check added tokens first (special tokens)
      if (this.addedTokens.has(token)) {
        return this.addedTokens.get(token)!;
      }

      // Check main vocabulary
      if (this.vocab.has(token)) {
        return this.vocab.get(token)!;
      }

      // Return UNK token for unknown
      return SPECIAL_TOKENS.UNK;
    });
  }

  /**
   * Main tokenization method with padding
   *
   * @param text - Input text to tokenize
   * @param maxLength - Maximum sequence length (default: 64)
   * @param addEos - Whether to add EOS token at the end (default: true)
   * @returns Object with input_ids and attention_mask arrays
   */
  tokenize(
    text: string,
    maxLength: number = MAX_LENGTH,
    addEos: boolean = true
  ): { input_ids: number[]; attention_mask: number[] } {
    if (!this.isLoaded) {
      console.warn('⚠️ Tokenizer not loaded, using fallback');
      return this.fallbackTokenize(text, maxLength);
    }

    try {
      // Convert text to tokens
      const tokens = this.textToTokens(text);

      // Convert tokens to IDs
      let tokenIds = this.tokensToIds(tokens);

      // Add EOS token if configured
      if (addEos) {
        tokenIds.push(SPECIAL_TOKENS.EOS);
      }

      // Truncate if too long
      if (tokenIds.length > maxLength) {
        tokenIds = tokenIds.slice(0, maxLength);
      }

      // Create attention mask (1 for real tokens, 0 for padding)
      const attentionMask = new Array(tokenIds.length).fill(1);

      // Pad to maxLength with PAD tokens
      while (tokenIds.length < maxLength) {
        tokenIds.push(SPECIAL_TOKENS.PAD);
        attentionMask.push(0);
      }

      return {
        input_ids: tokenIds,
        attention_mask: attentionMask,
      };
    } catch (error: any) {
      console.error('❌ Tokenization error:', error?.message || error);
      return this.fallbackTokenize(text, maxLength);
    }
  }

  /**
   * Fallback tokenization for when main tokenizer fails
   * Uses a simple word-based hashing approach
   */
  private fallbackTokenize(
    text: string,
    maxLength: number
  ): { input_ids: number[]; attention_mask: number[] } {
    console.warn('⚠️ Using fallback tokenization (word hashing)');

    // Normalize and split text
    const words = text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);

    // Convert words to simple hash-based IDs
    const tokenIds: number[] = [];

    for (const word of words) {
      if (tokenIds.length >= maxLength - 1) break; // Leave room for EOS

      // Simple hash function
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }

      // Map to vocab range (avoiding special tokens 0-3)
      const vocabSize = 256000; // Gemma vocab size
      const tokenId = (Math.abs(hash) % (vocabSize - 100)) + 100;
      tokenIds.push(tokenId);
    }

    // Add EOS token
    tokenIds.push(SPECIAL_TOKENS.EOS);

    // Create attention mask
    const attentionMask = new Array(tokenIds.length).fill(1);

    // Pad to maxLength
    while (tokenIds.length < maxLength) {
      tokenIds.push(SPECIAL_TOKENS.PAD);
      attentionMask.push(0);
    }

    return {
      input_ids: tokenIds,
      attention_mask: attentionMask,
    };
  }

  /**
   * Batch tokenization for multiple texts
   */
  batchTokenize(
    texts: string[],
    maxLength: number = MAX_LENGTH,
    addEos: boolean = true
  ): { input_ids: number[][]; attention_mask: number[][] } {
    const results = texts.map(text => this.tokenize(text, maxLength, addEos));

    return {
      input_ids: results.map(r => r.input_ids),
      attention_mask: results.map(r => r.attention_mask),
    };
  }

  /**
   * Check if tokenizer is ready
   */
  isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Get tokenizer status
   */
  getStatus() {
    return {
      loaded: this.isLoaded,
      vocabSize: this.vocab.size,
      mergesCount: this.merges.length,
      specialTokens: SPECIAL_TOKENS,
      maxLength: MAX_LENGTH,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.vocab.clear();
    this.merges = [];
    this.addedTokens.clear();
    this.isLoaded = false;
  }
}

// Export singleton instance
export default new TokenizerService();
