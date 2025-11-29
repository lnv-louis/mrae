
class TranscriptionService {
  private initialized = false;

  async initialize(model: string = 'whisper-small'): Promise<void> {
    console.log('Initializing Transcription Service (Mocked)...');
    this.initialized = true;
  }

  async transcribe(
    audioFilePath: string,
    onToken?: (token: string) => void,
    language: string = 'en'
  ): Promise<{ response: string }> {
    if (!this.initialized) {
      await this.initialize();
    }
    console.log('Transcribing audio (Mocked) for:', audioFilePath);
    return { response: "This is a mocked transcription response." };
  }

  async destroy(): Promise<void> {
    this.initialized = false;
  }
}

export default new TranscriptionService();
