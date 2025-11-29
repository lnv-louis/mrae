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
    const onnxruntime = require('onnxruntime-react-native');
    
    // Check if native module is properly initialized
    if (!onnxruntime || !onnxruntime.InferenceSession) {
      console.warn('⚠️ ONNX Runtime native module not initialized');
      return null;
    }
    
    InferenceSession = onnxruntime.InferenceSession;
  } catch (e: any) {
    console.warn('⚠️ onnxruntime-react-native not available:', e?.message);
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

