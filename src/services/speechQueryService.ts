import transcriptionService from './transcriptionService';
import querySearchService from './querySearchService';

export async function searchByAudio(
  audioFilePath: string,
  options?: { threshold?: number; limit?: number; language?: string }
): Promise<{
  transcript: string;
  phrases: string[];
  results: Array<{ id: string; uri: string; score: number; phrase: string; timestamp: number }>;
  message: string;
}>{
  const lang = options?.language || 'en';
  const t = await transcriptionService.transcribe(audioFilePath, undefined, lang);
  const text = t?.response || '';
  if (!text.trim()) {
    return { transcript: '', phrases: [], results: [], message: 'Empty transcript' };
  }
  const expanded = await querySearchService.searchByExpandedText(text, {
    threshold: options?.threshold,
    limit: options?.limit,
  });
  return {
    transcript: text,
    phrases: expanded.phrases,
    results: expanded.results,
    message: expanded.message,
  };
}

export default { searchByAudio };
