class NanoBananaService {
  async applyDiff(originalPath: string, instructions: string): Promise<{ success: boolean; outputPath?: string; summary?: string }> {
    return { success: true, outputPath: originalPath, summary: instructions };
  }
}

export default new NanoBananaService();

