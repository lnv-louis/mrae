import { GeminiContent, GeminiGenerateResponse, GeminiPart } from '../types';
import Constants from 'expo-constants';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

class GeminiService {
  private apiKey: string | null = null;

  constructor() {
    const extraKey = (Constants?.expoConfig?.extra as any)?.geminiApiKey;
    this.apiKey = process.env.GEMINI_API_KEY || extraKey || null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
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
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: c.image_url.url } });
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
      return null;
    }
    try {
      const url = `${GEMINI_API_BASE}/${model}:generateContent`;
      const contents = this.transformMessages(messages);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({ contents }),
      });
      if (!response.ok) {
        return null;
      }
      const data: GeminiGenerateResponse = await response.json();
      return data;
    } catch {
      return null;
    }
  }

  formatImageMessage(text: string, imageDataBase64: string): { role: 'user'; content: any } {
    return {
      role: 'user',
      content: [
        { type: 'text', text },
        { type: 'inline_data', inline_data: { mime_type: 'image/jpeg', data: imageDataBase64 } },
      ],
    };
  }
}

export default new GeminiService();

