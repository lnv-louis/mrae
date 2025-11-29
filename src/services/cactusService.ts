let CactusLM: any;
try {
  ({ CactusLM } = require('cactus-react-native'));
} catch {}

class CactusService {
  private cactus: any | null = null;
  private isReady = false;
  private model: string = 'lfm2-vl-450m';

  available(): boolean {
    return !!CactusLM;
  }

  async init(model?: string): Promise<void> {
    if (!this.available()) return;
    if (model) this.model = model;
    if (!this.cactus) {
      this.cactus = new CactusLM({ model: this.model });
    }
    if (!this.isReady) {
      try {
        await this.cactus.download?.({});
        this.isReady = true;
      } catch {
        this.isReady = false;
      }
    }
  }

  async imageEmbed(imagePath: string): Promise<number[] | null> {
    if (!this.available()) return null;
    await this.init();
    try {
      if (typeof this.cactus.imageEmbed === 'function') {
        const result = await this.cactus.imageEmbed({ imagePath });
        return Array.isArray(result?.embedding) ? result.embedding : null;
      }
      // Fallback: try vision completion if embed not available
      const messages = [
        { role: 'user', content: "Analyze image and produce a numeric embedding.", images: [imagePath] },
      ];
      const res = await this.cactus.complete?.({ messages });
      const text: string = res?.response || '';
      const numbers = text
        .split(/[^-0-9\.eE]+/)
        .map((t: string) => parseFloat(t))
        .filter((n: number) => Number.isFinite(n));
      return numbers.length > 0 ? numbers : null;
    } catch {
      return null;
    }
  }

  async complete(messages: any[]): Promise<string | null> {
    if (!this.available()) return null;
    await this.init();
    try {
      const res = await this.cactus.complete?.({ messages });
      const text: string = res?.response || '';
      return text || null;
    } catch {
      return null;
    }
  }

  async analyzeImage(imagePath: string, prompt: string = "What's in the image?"): Promise<string | null> {
    const messages = [
      { role: 'user', content: prompt, images: [imagePath] },
    ];
    return this.complete(messages);
  }

  async destroy(): Promise<void> {
    try { await this.cactus?.destroy?.(); } catch {}
    this.isReady = false;
    this.cactus = null;
  }
}

export default new CactusService();
