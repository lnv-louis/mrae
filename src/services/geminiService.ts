import { GeminiContent, GeminiGenerateResponse, GeminiPart } from '../types';
import geoService from './geoService';
import Constants from 'expo-constants';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemini-2.5-flash-preview-09-2025';
const IMAGE_MODEL = 'google/gemini-3-pro-image-preview';

/**
 * AI Service - Uses OpenRouter API for AI capabilities
 * OpenRouter provides access to multiple AI models through a unified API
 *
 * Models:
 * - LLM: google/gemini-2.5-flash-preview-09-2025
 * - Image/Vision: google/gemini-3-pro-image-preview
 */
class GeminiService {
  private apiKey: string | null = null;

  constructor() {
    const extraKey = (Constants?.expoConfig?.extra as any)?.openrouterApiKey;
    this.apiKey = process.env.OPENROUTER_API_KEY || extraKey || null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  getImageModel(): string {
    return IMAGE_MODEL;
  }

  getDefaultModel(): string {
    return DEFAULT_MODEL;
  }

  private transformMessages(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: any }>): GeminiContent[] {
    return messages.map((m) => {
      const parts: GeminiPart[] = [];
      if (typeof m.content === 'string') {
        parts.push({ text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const c of m.content) {
          if (c.type === 'text' && c.text) parts.push({ text: c.text });
          if (c.type === 'image_url' && c.image_url?.url) {
            const url: string = c.image_url.url;
            let base64 = url;
            if (typeof url === 'string' && url.startsWith('data:image/')) {
              const commaIdx = url.indexOf(',');
              base64 = commaIdx > -1 ? url.slice(commaIdx + 1) : url;
            }
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64 } });
          }
          if (c.type === 'inline_data' && c.inline_data) parts.push({ inline_data: c.inline_data });
        }
      }
      const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
      return { role, parts };
    });
  }

  async generateContent(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: any }>, model: string = DEFAULT_MODEL): Promise<GeminiGenerateResponse | null> {
    if (!this.apiKey) {
      console.error('❌ OpenRouter API key not configured');
      return null;
    }
    try {
      const cities = await geoService.getVisitedCities(50);
      const contextPrefix = cities && cities.length > 0 ? [{ role: 'user' as const, content: `User visited cities: ${cities.join(', ')}.` }] : [];
      const augmented = contextPrefix.length ? [...contextPrefix, ...messages] : messages;

      // OpenRouter uses OpenAI-compatible format
      const url = `${OPENROUTER_API_BASE}/chat/completions`;
      // Pass content directly (array or string) - do NOT stringify arrays
      const openAIMessages = augmented.map(m => ({
        role: m.role,
        content: m.content // Pass as-is (OpenRouter handles arrays natively)
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://mrae.app',
          'X-Title': 'MRAE',
        },
        body: JSON.stringify({
          model,
          messages: openAIMessages
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenRouter API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      // Convert OpenAI format to internal format
      return {
        candidates: [{
          content: {
            parts: [{ text: data.choices[0].message.content }],
            role: 'model'
          },
          finishReason: 'STOP',
          index: 0
        }]
      } as GeminiGenerateResponse;
    } catch (error) {
      console.error('❌ Error calling OpenRouter API:', error);
      return null;
    }
  }

  formatImageMessage(text: string, imageDataBase64: string): { role: 'user'; content: any } {
    return {
      role: 'user',
      content: [
        { type: 'text', text },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${imageDataBase64}`
          }
        },
      ],
    };
  }

  /**
   * Embedding functionality is not available through OpenRouter
   * Use the local ONNX models instead (handled by embeddingService)
   */
  async embedText(text: string): Promise<number[] | null> {
    console.warn('⚠️ Text embedding not available via OpenRouter. Use local ONNX models instead.');
    return null;
  }
}

export default new GeminiService();
