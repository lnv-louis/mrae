import transcriptionService from '../services/transcriptionService';

export async function testTranscription(audioFilePath: string): Promise<boolean> {
  try {
    await transcriptionService.initialize();
    let streamed = '';
    const result = await transcriptionService.transcribe(audioFilePath, (t) => {
      streamed += t;
    }, 'en');
    const finalText = result.response || '';
    return finalText.length > 0 || streamed.length > 0;
  } catch (e) {
    return false;
  }
}
