import { OpenRouterMessage, OpenRouterCompletionResponse } from '../types';
import Constants from 'expo-constants';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct';
const IMAGE_EDITING_MODEL = 'google/gemini-3-pro-image-preview';

class OpenRouterService {
  private apiKey: string | null = null;

  constructor() {
    // specialized for qwen3vl235b and gemini-3-pro-image
    // Try to get key from process.env if available, otherwise it needs to be set manually
    const extraKey = (Constants?.expoConfig?.extra as any)?.openrouterApiKey;
    this.apiKey = process.env.OPENROUTER_API_KEY || extraKey || null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async generateCompletion(
    messages: OpenRouterMessage[],
    model: string = DEFAULT_MODEL,
    modalities?: string[]
  ): Promise<OpenRouterCompletionResponse | null> {
    if (!this.apiKey) {
      console.warn('OpenRouter API key is not set');
      return null;
    }

    try {
      const body: any = {
        model,
        messages,
      };

      if (modalities) {
        body.modalities = modalities;
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/mrae-app', // Optional: For OpenRouter rankings
          'X-Title': 'MRAE', // Optional: For OpenRouter rankings
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        return null;
      }

      const data: OpenRouterCompletionResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error calling OpenRouter:', error);
      return null;
    }
  }

  /**
   * Edit an image using Gemini 3 Pro
   * @param prompt The instruction for editing (e.g., "make it sunset")
   * @param imageUrl The URL of the original image
   * @returns The edited image URL (base64) or null if failed
   */
  async editImage(prompt: string, imageUrl: string): Promise<string | null> {
    const message = this.formatImageMessage(prompt, imageUrl);
    const response = await this.generateCompletion(
      [message],
      IMAGE_EDITING_MODEL,
      ['text', 'image']
    );

    if (response && response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      // Check for image in message.images (OpenRouter standard for image gen)
      if (choice.message.images && choice.message.images.length > 0) {
        return choice.message.images[0].image_url.url;
      }
      // Sometimes it might be in content if the model returns a link, but for this model it's likely in images
    }

    return null;
  }

  /**
   * Helper to format image message for VL models
   */
  formatImageMessage(text: string, imageUrl: string): OpenRouterMessage {
    return {
      role: 'user',
      content: [
        {
          type: 'text',
          text,
        },
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
          },
        },
      ],
    };
  }
}

export default new OpenRouterService();
