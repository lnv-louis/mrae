import openRouterService from '../services/openRouterService';
import { OpenRouterMessage } from '../types';

export async function testOpenRouterConnection(apiKey?: string): Promise<boolean> {
  if (apiKey) {
    openRouterService.setApiKey(apiKey);
  }

  console.log('Testing OpenRouter connection...');
  
  const messages: OpenRouterMessage[] = [
    {
      role: 'user',
      content: 'Hello, are you Qwen VL?',
    },
  ];

  const response = await openRouterService.generateCompletion(messages);

  if (response && response.choices && response.choices.length > 0) {
    console.log('✓ OpenRouter connection successful');
    console.log('Response:', response.choices[0].message.content);
    return true;
  } else {
    console.error('✗ OpenRouter connection failed');
    return false;
  }
}

export async function testImageAnalysis(imageUrl: string, apiKey?: string): Promise<void> {
  if (apiKey) {
    openRouterService.setApiKey(apiKey);
  }

  console.log('Testing Image Analysis...');

  const message = openRouterService.formatImageMessage(
    'Describe this image in detail.',
    imageUrl
  );

  const response = await openRouterService.generateCompletion([message]);

  if (response && response.choices && response.choices.length > 0) {
    console.log('✓ Image analysis successful');
    console.log('Description:', response.choices[0].message.content);
  } else {
    console.error('✗ Image analysis failed');
  }
}

export async function testImageEditing(imageUrl: string, prompt: string, apiKey?: string): Promise<void> {
  if (apiKey) {
    openRouterService.setApiKey(apiKey);
  }

  console.log('Testing Image Editing (Gemini 3 Pro)...');

  const resultUrl = await openRouterService.editImage(prompt, imageUrl);

  if (resultUrl) {
    console.log('✓ Image editing successful');
    console.log('Result URL length:', resultUrl.length);
    // console.log('Result URL:', resultUrl); // Likely very long base64
  } else {
    console.error('✗ Image editing failed');
  }
}
