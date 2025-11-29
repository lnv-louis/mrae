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

      // Download the model if not already downloaded
      console.log('Downloading STT model...');
      await this.sttModel.download({
        onProgress: (progress) => {
          console.log(`STT model download: ${Math.round(progress * 100)}%`);
          onProgress?.(progress);
        },
      });

      // Initialize the model
      console.log('Initializing STT model...');
      await this.sttModel.init();

      this.ready = true;
      this.isDownloading = false;
      console.log('✅ STT model ready!');
      return true;
    } catch (error) {
      console.error('Failed to initialize STT model:', error);
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
   * @param language - Language code (e.g., 'en', 'es', 'fr')
   */
  async transcribe(
    audioFilePath: string,
    onToken?: (token: string) => void,
    language: string = 'en'
  ): Promise<{ response: string; success: boolean }> {
    // Auto-initialize if not ready
    if (!this.ready) {
      const success = await this.initialize();
      if (!success) {
        console.warn('⚠️ Using mock transcription (STT not available)');
        return {
          response: 'Transcription not available. Please ensure audio file is valid.',
          success: false,
        };
      }
    }

    if (!this.sttModel) {
      return {
        response: 'STT model not initialized',
        success: false,
      };
    }

    try {
      console.log(`Transcribing audio: ${audioFilePath}`);
      
      // Validate audio file path
      if (!audioFilePath || typeof audioFilePath !== 'string') {
        console.error('Invalid audio file path:', audioFilePath);
        return {
          response: 'Invalid audio file path',
          success: false,
        };
      }

      // Ensure model is ready before transcribing
      if (!this.ready || !this.sttModel) {
        console.warn('STT model not ready, initializing...');
        const initSuccess = await this.initialize();
        if (!initSuccess || !this.sttModel) {
          return {
            response: 'STT model not available',
            success: false,
          };
        }
      }
      
      const result = await this.sttModel.transcribe({
        audioFilePath,
        prompt: `Transcribe this audio in ${language}`,
        onToken,
        options: {
          temperature: 0.0, // Deterministic for transcription
          maxTokens: 500,
        },
      });

      if (!result || !result.response) {
        console.warn('Transcription returned empty result');
        return {
          response: 'No transcription result',
          success: false,
        };
      }

      console.log('✅ Audio transcribed successfully');
      return {
        response: result.response,
        success: true,
      };
    } catch (error: any) {
      console.error('Transcription failed:', error);
      const errorMsg = error?.message || String(error) || '';
      
      // Provide more helpful error messages
      if (errorMsg.includes('file') || errorMsg.includes('path')) {
        return {
          response: 'Audio file not found or invalid',
          success: false,
        };
      }
      
      return {
        response: 'Failed to transcribe audio. Please try again.',
        success: false,
      };
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
