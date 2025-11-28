/**
 * Test utility for verifying embeddings work correctly
 * This can be called from Settings screen or used during development
 */

import embeddingService from '../services/embeddingService';

export async function testTextEmbedding(): Promise<boolean> {
  try {
    console.log('Testing text embedding...');
    const result = await embeddingService.embedText('test query');
    
    if (result.success && result.embedding.length > 0) {
      console.log(`✓ Text embedding successful. Vector length: ${result.embedding.length}`);
      return true;
    } else {
      console.error('✗ Text embedding failed');
      return false;
    }
  } catch (error) {
    console.error('✗ Text embedding error:', error);
    return false;
  }
}

export async function testImageEmbedding(imagePath: string): Promise<boolean> {
  try {
    console.log('Testing image embedding...');
    const result = await embeddingService.embedImage(imagePath);
    
    if (result.success && result.embedding.length > 0) {
      console.log(`✓ Image embedding successful. Vector length: ${result.embedding.length}`);
      return true;
    } else {
      console.error('✗ Image embedding failed');
      return false;
    }
  } catch (error) {
    console.error('✗ Image embedding error:', error);
    return false;
  }
}

export async function testModelsInitialization(): Promise<{
  textModel: boolean;
  imageModel: boolean;
}> {
  try {
    console.log('Testing model initialization...');
    
    await embeddingService.initializeTextModel();
    const textOk = true;
    
    await embeddingService.initializeImageModel();
    const imageOk = true;
    
    return {
      textModel: textOk,
      imageModel: imageOk,
    };
  } catch (error) {
    console.error('Model initialization error:', error);
    return {
      textModel: false,
      imageModel: false,
    };
  }
}

