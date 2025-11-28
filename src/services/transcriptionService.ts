import { CactusSTT } from 'cactus-react-native';

class TranscriptionService {
  private stt: CactusSTT | null = null;
  private initialized = false;

  async initialize(model: string = 'whisper-small'): Promise<void> {
    if (this.initialized && this.stt) return;
    this.stt = new CactusSTT({ model });
    await this.stt.init();
    this.initialized = true;
  }

  async transcribe(
    audioFilePath: string,
    onToken?: (token: string) => void,
    language: string = 'en'
  ): Promise<{ response: string }> {
    if (!this.stt || !this.initialized) {
      await this.initialize();
    }
    const prompt = `<|startoftranscript|><|${language}|><|transcribe|><|notimestamps|>`;
    const result = await this.stt!.transcribe({ audioFilePath, onToken, prompt });
    return { response: result.response };
  }

  async destroy(): Promise<void> {
    if (this.stt) {
      await this.stt.destroy();
      this.stt = null;
      this.initialized = false;
    }
  }
}

export default new TranscriptionService();
