/**
 * Test utility for verifying embeddings work correctly
 * This can be called from Settings screen or used during development
 *
 * Comprehensive diagnostics for Cactus and ONNX embedding services
 */

import embeddingService from '../services/embeddingService';
import cactusService from '../services/cactusService';
import onnxService from '../services/onnxService';

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

/**
 * Comprehensive diagnostics for Cactus and ONNX services
 *
 * This function checks:
 * - Service availability
 * - Model initialization status
 * - Embedding generation capability
 * - Vector dimensions
 *
 * Example usage:
 * const results = await runEmbeddingDiagnostics({ imagePath: 'file://path/to/test.jpg' });
 * console.log('Diagnostics:', results);
 */
export async function runEmbeddingDiagnostics(options?: {
  imagePath?: string;
  initModels?: boolean;
}): Promise<{
  success: boolean;
  cactus: {
    available: boolean;
    visionReady: boolean;
    visionDownloaded: boolean;
    testResult?: {
      success: boolean;
      dimension: number;
      method: 'cactus' | 'mock';
    };
  };
  onnx: {
    available: boolean;
    model: string;
    tokenizer: string;
    testResult?: {
      success: boolean;
      dimension: number;
      method: 'onnx' | 'mock';
    };
  };
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 Running Embedding Service Diagnostics...');
  console.log('='.repeat(60));

  try {
    // Initialize models if requested
    if (options?.initModels !== false) {
      console.log('\n📦 Initializing models...');

      try {
        await embeddingService.initializeTextModel((progress) => {
          if (progress === 1) console.log('  ✅ ONNX Text Model initialized');
        });
      } catch (error: any) {
        warnings.push(`ONNX initialization: ${error?.message}`);
      }

      try {
        await embeddingService.initializeImageModel((progress) => {
          if (progress === 1) console.log('  ✅ Cactus Vision Model initialized');
        });
      } catch (error: any) {
        warnings.push(`Cactus initialization: ${error?.message}`);
      }
    }

    // Get service status
    const cactusStatus = cactusService.getStatus();
    const onnxStatus = onnxService.getStatus();

    console.log('\n📊 Service Status:');
    console.log('  Cactus:');
    console.log(`    - Available: ${cactusStatus.available ? '✅' : '❌'}`);
    console.log(`    - Vision Ready: ${cactusStatus.visionReady ? '✅' : '❌'}`);
    console.log(`    - Vision Downloaded: ${cactusStatus.visionDownloaded ? '✅' : '❌'}`);
    console.log('  ONNX:');
    console.log(`    - Available: ${onnxStatus.available ? '✅' : '❌'}`);
    console.log(`    - Model: ${onnxStatus.model}`);
    console.log(`    - Tokenizer: ${onnxStatus.tokenizer}`);

    // Test text embedding
    console.log('\n🧪 Testing Text Embedding...');
    let textTestResult;
    try {
      const testText = 'golden hour sunset at the beach';
      const result = await embeddingService.embedText(testText);

      textTestResult = {
        success: result.success && result.embedding.length > 0,
        dimension: result.embedding.length,
        method: (onnxStatus.available ? 'onnx' : 'mock') as 'onnx' | 'mock',
      };

      console.log(`  ${textTestResult.success ? '✅' : '❌'} Text Embedding: ${textTestResult.dimension}D (${textTestResult.method})`);

      if (textTestResult.method === 'mock') {
        warnings.push('Text embeddings using mock fallback (ONNX not available)');
      }
    } catch (error: any) {
      errors.push(`Text embedding failed: ${error?.message}`);
    }

    // Test image embedding (if image path provided)
    console.log('\n🧪 Testing Image Embedding...');
    let imageTestResult;
    if (options?.imagePath) {
      try {
        const result = await embeddingService.embedImage(options.imagePath);

        imageTestResult = {
          success: result.success && result.embedding.length > 0,
          dimension: result.embedding.length,
          method: (cactusStatus.visionReady ? 'cactus' : 'mock') as 'cactus' | 'mock',
        };

        console.log(`  ${imageTestResult.success ? '✅' : '❌'} Image Embedding: ${imageTestResult.dimension}D (${imageTestResult.method})`);

        if (imageTestResult.method === 'mock') {
          warnings.push('Image embeddings using mock fallback (Cactus not available)');
        }
      } catch (error: any) {
        errors.push(`Image embedding failed: ${error?.message}`);
      }
    } else {
      console.log('  ⏭️  Skipped (no image path provided)');
      warnings.push('Image embedding test skipped (no image path provided)');
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📋 Summary: ${errors.length} errors, ${warnings.length} warnings`);

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(e => console.log(`  - ${e}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach(w => console.log(`  - ${w}`));
    }

    return {
      success: errors.length === 0,
      cactus: {
        available: cactusStatus.available,
        visionReady: cactusStatus.visionReady,
        visionDownloaded: cactusStatus.visionDownloaded,
        testResult: imageTestResult,
      },
      onnx: {
        available: onnxStatus.available,
        model: onnxStatus.model,
        tokenizer: onnxStatus.tokenizer,
        testResult: textTestResult,
      },
      errors,
      warnings,
    };
  } catch (error: any) {
    console.error('❌ Diagnostics failed:', error);
    errors.push(`Fatal error: ${error?.message}`);

    return {
      success: false,
      cactus: cactusService.getStatus(),
      onnx: onnxService.getStatus(),
      errors,
      warnings,
    };
  }
}

/**
 * Quick status check (non-async)
 */
export function getEmbeddingStatus() {
  return {
    cactus: cactusService.getStatus(),
    onnx: onnxService.getStatus(),
    embedding: embeddingService.getStatus(),
  };
}

