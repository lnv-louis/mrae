import geminiService from '../services/geminiService';
import { GeminiGenerateResponse } from '../types';

export async function testGeminiConnection(apiKey?: string): Promise<boolean> {
  if (apiKey) {
    geminiService.setApiKey(apiKey);
  }
  const response: GeminiGenerateResponse | null = await geminiService.generateContent([
    { role: 'user', content: 'Hello, can you respond with a short greeting?' },
  ]);
  if (response?.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0].content.parts;
    const text = parts.find((p) => p.text)?.text || '';
    return text.length > 0;
  }
  return false;
}

export async function testGeminiImageAnalysis(imageBase64: string, apiKey?: string): Promise<string | null> {
  if (apiKey) {
    geminiService.setApiKey(apiKey);
  }
  const message = geminiService.formatImageMessage('Describe this image in detail.', imageBase64);
  const response = await geminiService.generateContent([message]);
  if (response?.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0].content.parts;
    const text = parts.find((p) => p.text)?.text || '';
    return text || null;
  }
  return null;
}

