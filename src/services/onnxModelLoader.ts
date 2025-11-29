import { Platform } from 'react-native';

const TEXT_MODEL_FILENAME = 'siglip2_text_encoder.onnx';
const IMAGE_MODEL_FILENAME = 'siglip2_image_encoder.onnx';

async function loadOnnxModel(modelFilename: string): Promise<any | null> {
  let RNFS: any;
  let InferenceSession: any;
  
  try {
    RNFS = require('react-native-fs');
  } catch (e) {
    console.warn('⚠️ react-native-fs not available');
    return null;
  }

  try {
    // Use a function to safely require the module to prevent load-time errors
    const loadOnnxModule = () => {
      try {
        return require('onnxruntime-react-native');
      } catch (e: any) {
        // Suppress the "install" error that happens at module load
        if (e?.message?.includes('install') || e?.message?.includes('null')) {
          return null;
        }
        throw e;
      }
    };
    
    const onnxruntime = loadOnnxModule();
    
    // Check if native module is properly initialized
    if (!onnxruntime || typeof onnxruntime !== 'object') {
      console.warn('⚠️ ONNX Runtime module not properly loaded');
      return null;
    }
    
    // Check if InferenceSession exists and is a function
    if (!onnxruntime.InferenceSession || typeof onnxruntime.InferenceSession !== 'function') {
      console.warn('⚠️ ONNX Runtime InferenceSession not available');
      return null;
    }
    
    InferenceSession = onnxruntime.InferenceSession;
  } catch (e: any) {
    // Suppress the "install" error - it's a known issue with onnxruntime-react-native
    if (e?.message?.includes('install') || e?.message?.includes('null')) {
      console.warn('⚠️ ONNX Runtime native module not initialized (install error suppressed)');
    } else {
      console.warn('⚠️ onnxruntime-react-native not available:', e?.message || e);
    }
    return null;
  }

  let modelPath = '';
  try {
    if (Platform.OS === 'android') {
      const destPath = `${RNFS.DocumentDirectoryPath}/${modelFilename}`;
      const exists = await RNFS.exists(destPath);
      if (!exists) {
        try {
          await RNFS.copyFileAssets(modelFilename, destPath);
        } catch (copyError: any) {
          console.warn(`⚠️ Could not copy model from assets: ${copyError?.message}`);
          return null;
        }
      }
      modelPath = destPath;
    } else {
      modelPath = `${RNFS.MainBundlePath}/${modelFilename}`;
    }

    if (!modelPath) {
      console.warn('⚠️ Model path is empty');
      return null;
    }

    const session = await InferenceSession.create(modelPath);
    return session;
  } catch (e: any) {
    console.warn(`⚠️ Failed to load ONNX model: ${e?.message || e}`);
    return null;
  }
}

export const loadTextEncoder = async (): Promise<any | null> => {
  return loadOnnxModel(TEXT_MODEL_FILENAME);
};

export const loadImageEncoder = async (): Promise<any | null> => {
  return loadOnnxModel(IMAGE_MODEL_FILENAME);
};

