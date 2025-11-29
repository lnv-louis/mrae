import { CactusSTT } from 'cactus-react-native';

/**
 * Transcription Service - Speech-to-Text using Cactus STT
 * Uses Whisper model for accurate audio transcription
 * 
 * Documentation: https://cactuscompute.com/docs/react-native#speech-to-text-stt
 */

class TranscriptionService {
  private sttModel: CactusSTT | null = null;
  private modelName = 'whisper-small';
  private ready = false;
  private isDownloading = false;

  /**
   * Check if Cactus STT is available
   */
  available(): boolean {
    return !!CactusSTT;
  }

  /**
   * Initialize the STT model
   */
  async initialize(
    model: string = 'whisper-small',
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    if (!this.available()) {
      console.log('Cactus STT not available');
      return false;
    }

    if (this.ready) {
      return true;
    }

    if (this.isDownloading) {
      console.log('STT model already downloading');
      return false;
    }

    try {
      this.isDownloading = true;
      this.modelName = model;

      if (!this.sttModel) {
        console.log(`Creating Cactus STT model: ${this.modelName}`);
        this.sttModel = new CactusSTT({
          model: this.modelName,
          contextSize: 2048,
        });
      }

      // Download the model first (required before init)
      console.log('Downloading STT model...');
      try {
        await this.sttModel.download({
          onProgress: (progress) => {
            console.log(`STT model download: ${Math.round(progress * 100)}%`);
            onProgress?.(progress);
          },
        });
        console.log('✅ STT model downloaded');
      } catch (downloadError: any) {
        // If already downloaded, this is not an error
        if (!downloadError?.message?.includes('already downloaded')) {
          throw downloadError;
        }
        console.log('STT model already downloaded');
      }

      // Initialize the model after download
      console.log('Initializing STT model...');
      await this.sttModel.init();

      this.ready = true;
      this.isDownloading = false;
      console.log('✅ STT model ready!');
      return true;
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('Failed to initialize STT model:', {
        error: errorMsg,
        model: this.modelName,
      });
      this.isDownloading = false;
      this.ready = false;
      return false;
    }
  }

  /**
   * Transcribe audio to text
   *
   * @param audioFilePath - Path to audio file
   * @param onToken - Optional callback for streaming tokens
   * @param language - Language code (e.g., 'en', 'es', 'fr', 'de', 'zh')
   */
  async transcribe(
    audioFilePath: string,
    onToken?: (token: string) => void,
    language: string = 'en'
  ): Promise<{ response: string; success: boolean }> {
    // Validate audio file path first
    if (!audioFilePath || typeof audioFilePath !== 'string') {
      throw new Error('Invalid audio file path provided');
    }

    // Auto-initialize if not ready
    if (!this.ready) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('STT model initialization failed. Please ensure Cactus STT is properly configured.');
      }
    }

    if (!this.sttModel) {
      throw new Error('STT model not initialized. Call initialize() first.');
    }

    try {
      console.log(`🎤 Transcribing: ${audioFilePath.split('/').pop()}`);
      console.log(`   Language: ${language}, Model ready: ${this.ready}`);

      // Use Whisper's standard prompt format
      // Format: <|startoftranscript|><|LANG|><|transcribe|><|notimestamps|>
      const whisperPrompt = `<|startoftranscript|><|${language}|><|transcribe|><|notimestamps|>`;

      const result = await this.sttModel.transcribe({
        audioFilePath,
        prompt: whisperPrompt,
        onToken,
        options: {
          temperature: 0.0, // Deterministic for transcription
          maxTokens: 500,
        },
      });

      if (!result || !result.response) {
        throw new Error('Cactus STT returned empty result. The audio file may be invalid, corrupted, or too short.');
      }

      const responseText = result.response.trim();
      console.log(`✅ Transcribed (${result.totalTokens} tokens, ${Math.round(result.tokensPerSecond)} tok/s): "${responseText.substring(0, 50)}${responseText.length > 50 ? '...' : ''}"`);

      return {
        response: responseText,
        success: true,
      };
    } catch (error: any) {
      // Log detailed error for debugging
      const errorMsg = error?.message || String(error) || 'Unknown error';
      const errorStack = error?.stack || '';

      console.error('❌ Cactus transcription error:', {
        message: errorMsg,
        audioPath: audioFilePath,
        audioFileName: audioFilePath.split('/').pop(),
        modelReady: this.ready,
        modelName: this.modelName,
        stack: errorStack.substring(0, 200),
      });

      // Provide specific error messages based on error type
      if (errorMsg.toLowerCase().includes('file not found') ||
          errorMsg.toLowerCase().includes('enoent') ||
          errorMsg.toLowerCase().includes('no such file')) {
        throw new Error(`Audio file not found at path: ${audioFilePath.split('/').pop()}`);
      }

      if (errorMsg.toLowerCase().includes('invalid format') ||
          errorMsg.toLowerCase().includes('codec') ||
          errorMsg.toLowerCase().includes('unsupported') ||
          errorMsg.toLowerCase().includes('decode')) {
        throw new Error(`Invalid or unsupported audio format. Cactus STT works best with WAV files. Current file: ${audioFilePath.split('/').pop()}`);
      }

      if (errorMsg.toLowerCase().includes('model') ||
          errorMsg.toLowerCase().includes('not initialized') ||
          errorMsg.toLowerCase().includes('not downloaded')) {
        throw new Error('STT model error. The model may not be properly downloaded or initialized. Try restarting the app.');
      }

      if (errorMsg.toLowerCase().includes('timeout')) {
        throw new Error('Transcription timed out. The audio file may be too long or the device may be under heavy load.');
      }

      // Re-throw with detailed error message
      throw new Error(`Cactus transcription failed: ${errorMsg}`);
    }
  }

  /**
   * Generate audio embedding
   * Useful for audio similarity search
   */
  async audioEmbed(audioPath: string): Promise<number[] | null> {
    if (!this.ready) {
      await this.initialize();
    }

    if (!this.ready || !this.sttModel) {
      return null;
    }

    try {
      const result = await this.sttModel.audioEmbed({ audioPath });
      return result.embedding || null;
    } catch (error) {
      console.error('Audio embedding failed:', error);
      return null;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      available: this.available(),
      ready: this.ready,
      downloading: this.isDownloading,
      model: this.modelName,
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    try {
      if (this.sttModel) {
        await this.sttModel.destroy();
        this.sttModel = null;
      }
      this.ready = false;
    } catch (error) {
      console.error('Error destroying STT model:', error);
    }
  }
}

export default new TranscriptionService();
