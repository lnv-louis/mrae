import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Nano Banana Service - AI Image Editing
 * Uses Nano Banana API for intelligent photo editing with region selection
 * 
 * API Documentation: https://nanobanana.ai/docs
 * Fastest model: nano-banana-pro (lowest latency)
 */

const NANO_BANANA_API_BASE = 'https://api.nanobanana.ai/v1';
const FASTEST_MODEL = 'nano-banana-pro'; // Fastest response time

interface EditRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EditRequest {
  imageUri: string;
  prompt: string;
  region?: EditRegion;
}

class NanoBananaService {
  private apiKey: string | null = null;

  constructor() {
    const extraKey = (Constants?.expoConfig?.extra as any)?.nanoBananaApiKey;
    this.apiKey = process.env.NANO_BANANA_API_KEY || extraKey || null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  /**
   * Edit image with prompt and optional region selection
   * @param imageUri - URI of the image to edit
   * @param prompt - Text prompt describing the edit
   * @param region - Optional region to edit (x, y, width, height in pixels)
   */
  async editImage({ imageUri, prompt, region }: EditRequest): Promise<{ 
    success: boolean; 
    outputPath?: string; 
    error?: string;
  }> {
    if (!this.apiKey) {
      console.error('❌ Nano Banana API key not configured');
      return { 
        success: false, 
        error: 'API key not configured. Please set NANO_BANANA_API_KEY in .env' 
      };
    }

    if (!prompt || !prompt.trim()) {
      return { 
        success: false, 
        error: 'Prompt is required' 
      };
    }

    try {
      // Convert image URI to base64 or file path
      let imageData: string;
      let imageFormat = 'image/jpeg';

      if (imageUri.startsWith('file://') || imageUri.startsWith('http')) {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        imageData = base64;
        
        // Detect format
        if (imageUri.toLowerCase().endsWith('.png')) {
          imageFormat = 'image/png';
        }
      } else {
        imageData = imageUri; // Assume it's already base64
      }

      // Prepare request body
      const requestBody: any = {
        model: FASTEST_MODEL,
        image: `data:${imageFormat};base64,${imageData}`,
        prompt: prompt.trim(),
      };

      // Add region if specified
      if (region) {
        requestBody.region = {
          x: Math.round(region.x),
          y: Math.round(region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        };
      }

      console.log('🔄 Sending edit request to Nano Banana...');
      
      // Make API request
      const response = await fetch(`${NANO_BANANA_API_BASE}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error('❌ Nano Banana API error:', errorMsg);
        return { 
          success: false, 
          error: errorMsg 
        };
      }

      const result = await response.json();
      
      // Extract edited image (could be base64 or URL)
      let outputPath: string;
      
      if (result.image) {
        // Save base64 image to file
        const base64Data = result.image.replace(/^data:image\/\w+;base64,/, '');
        const fileName = `edited_${Date.now()}.${imageFormat === 'image/png' ? 'png' : 'jpg'}`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        outputPath = fileUri;
      } else if (result.output_url) {
        outputPath = result.output_url;
      } else {
        return { 
          success: false, 
          error: 'No image returned from API' 
        };
      }

      console.log('✅ Image edited successfully');
      return { 
        success: true, 
        outputPath 
      };
    } catch (error: any) {
      console.error('❌ Nano Banana edit error:', error);
      return { 
        success: false, 
        error: error?.message || 'Failed to edit image' 
      };
    }
  }

  /**
   * Legacy method for compatibility
   */
  async applyDiff(originalPath: string, instructions: string): Promise<{ 
    success: boolean; 
    outputPath?: string; 
    summary?: string 
  }> {
    const result = await this.editImage({
      imageUri: originalPath,
      prompt: instructions,
    });
    
    return {
      success: result.success,
      outputPath: result.outputPath,
      summary: result.success ? 'Edit applied successfully' : result.error,
    };
  }
}

export default new NanoBananaService();

