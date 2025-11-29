import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import geminiService from './geminiService';

/**
 * Image Editing Service - AI Image Editing using OpenRouter
 * Uses OpenRouter API (Gemini 3 Pro Image model) for intelligent photo editing
 *
 * Note: This service uses multimodal capabilities to understand
 * the image and generate editing instructions. For actual image manipulation,
 * you may need to implement additional image processing logic.
 *
 * Model: google/gemini-3-pro-image-preview
 */

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

class ImageEditingService {
  private apiKey: string | null = null;

  constructor() {
    const extraKey = (Constants?.expoConfig?.extra as any)?.openrouterApiKey;
    this.apiKey = process.env.OPENROUTER_API_KEY || extraKey || null;

    // Set the API key in geminiService
    if (this.apiKey) {
      geminiService.setApiKey(this.apiKey);
    }
  }

  setApiKey(key: string) {
    this.apiKey = key;
    geminiService.setApiKey(key);
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
      console.error('❌ OpenRouter API key not configured');
      return {
        success: false,
        error: 'API key not configured. Please set OPENROUTER_API_KEY in .env'
      };
    }

    if (!prompt || !prompt.trim()) {
      return {
        success: false,
        error: 'Prompt is required'
      };
    }

    if (!imageUri) {
      return {
        success: false,
        error: 'Image URI is required'
      };
    }

    try {
      // Resize image to prevent token overflow (OpenRouter has 65k token limit)
      // Large images can easily exceed this, so we resize to max 1024x1024
      let processedImageUri = imageUri;

      try {
        console.log('📐 Resizing image to prevent API token overflow...');

        const manipResult = await ImageManipulator.manipulateAsync(
          imageUri,
          [
            {
              resize: {
                width: 384, // Aggressive resize to stay under 65k token limit (512px was still too large)
              }
            }
          ],
          {
            compress: 0.4, // Aggressive compression for token budget
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        processedImageUri = manipResult.uri;
        console.log('✅ Image resized for API compatibility');
      } catch (resizeError: any) {
        console.warn('⚠️ Image resize failed, using original (may cause token overflow):', resizeError);
      }

      // Convert image URI to base64
      let imageData: string;
      const imageFormat = 'image/jpeg';

      if (processedImageUri.startsWith('file://') || processedImageUri.startsWith('http')) {
        try {
          // Check if file exists first
          const fileInfo = await FileSystem.getInfoAsync(processedImageUri);
          if (!fileInfo.exists) {
            return {
              success: false,
              error: 'Image file not found'
            };
          }

          // Read file as base64
          const base64 = await FileSystem.readAsStringAsync(processedImageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          if (!base64 || base64.length === 0) {
            return {
              success: false,
              error: 'Failed to read image file'
            };
          }

          imageData = base64;

          // Log size for debugging
          const estimatedTokens = Math.ceil(base64.length / 4);
          console.log(`📊 Image size: ~${(base64.length / 1024).toFixed(1)}KB base64, ~${estimatedTokens.toLocaleString()} tokens`);

          if (estimatedTokens > 50000) {
            console.warn('⚠️ WARNING: Image still very large after resize, may exceed API limits');
          }
        } catch (fileError: any) {
          console.error('❌ File read error:', fileError);
          return {
            success: false,
            error: `Failed to read image: ${fileError?.message || 'Unknown file error'}`
          };
        }
      } else {
        imageData = imageUri; // Assume it's already base64
      }

      // Build the prompt based on region selection
      let fullPrompt = prompt.trim();
      if (region) {
        fullPrompt = `Edit the image region at coordinates (${Math.round(region.x)}, ${Math.round(region.y)}) with dimensions ${Math.round(region.width)}x${Math.round(region.height)}px. ${prompt.trim()}. Please provide detailed instructions for this edit.`;
      }

      console.log('🔄 Sending edit request to OpenRouter (Gemini 3 Pro Image)...');
      console.log(`📝 Prompt: ${fullPrompt}`);
      if (region) {
        console.log(`📍 Region: ${region.width}x${region.height} at (${region.x}, ${region.y})`);
      }

      // Use AI to understand the image and generate editing instructions
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: fullPrompt },
            { type: 'inline_data', inline_data: { mime_type: imageFormat, data: imageData } }
          ]
        }
      ];

      // Use the image model for vision tasks
      const response = await geminiService.generateContent(messages as any, geminiService.getImageModel());

      if (!response || !response.candidates || response.candidates.length === 0) {
        return {
          success: false,
          error: 'Failed to get response from OpenRouter API'
        };
      }

      const aiResponse = response.candidates[0]?.content?.parts?.find((p: any) => p.text)?.text || '';

      if (!aiResponse) {
        return {
          success: false,
          error: 'No text response from API'
        };
      }

      console.log('✅ AI analysis complete');

      // IMPORTANT: OpenRouter/Gemini can only ANALYZE images, not EDIT them
      // For actual image editing, you would need:
      // 1. Image generation API (Replicate + Stable Diffusion)
      // 2. Client-side image manipulation (react-native-canvas, expo-gl)
      // 3. Or upload to a proper image editing service

      console.log('ℹ️ OpenRouter provides image analysis only, not editing');
      console.log('📝 AI Analysis:', aiResponse.substring(0, 200));

      return {
        success: false,
        error: `⚠️ Image editing not implemented.\n\nOpenRouter/Gemini can only analyze images, not edit them. To implement image editing, you would need:\n\n• Image generation API (e.g., Replicate with Stable Diffusion)\n• Or client-side manipulation libraries\n\nAI Analysis: ${aiResponse.substring(0, 150)}...`
      };
    } catch (error: any) {
      console.error('❌ Image editing error:', error);
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

export default new ImageEditingService();

