import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
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
      // Convert image URI to base64 or file path
      let imageData: string;
      let imageFormat = 'image/jpeg';

      if (imageUri.startsWith('file://') || imageUri.startsWith('http')) {
        try {
          // Check if file exists first
          const fileInfo = await FileSystem.getInfoAsync(imageUri);
          if (!fileInfo.exists) {
            return {
              success: false,
              error: 'Image file not found'
            };
          }

          // Read file as base64
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          if (!base64 || base64.length === 0) {
            return {
              success: false,
              error: 'Failed to read image file'
            };
          }

          imageData = base64;

          // Detect format
          if (imageUri.toLowerCase().endsWith('.png')) {
            imageFormat = 'image/png';
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

      console.log('✅ AI analysis complete:', aiResponse);

      // For now, return the original image with AI analysis
      // In a production app, you would use the AI response to guide actual image editing
      // using a library like react-native-image-editor or react-native-canvas
      console.log('⚠️ Note: Full image editing capabilities require additional image processing libraries');
      console.log('📝 AI Suggestion:', aiResponse);

      return {
        success: false,
        error: `Image editing feature requires additional setup. AI suggested: ${aiResponse.substring(0, 200)}...`
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

