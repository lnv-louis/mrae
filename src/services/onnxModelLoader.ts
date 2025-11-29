import { Platform } from 'react-native';

const TEXT_MODEL_FILENAME = 'siglip2_text_encoder.onnx';
const IMAGE_MODEL_FILENAME = 'siglip2_image_encoder.onnx';

async function loadOnnxModel(modelFilename: string): Promise<any | null> {
  let RNFS: any;
  let InferenceSession: any;
  try {
    RNFS = require('react-native-fs');
    ({ InferenceSession } = require('onnxruntime-react-native'));
  } catch (e) {
    return null;
  }

  let modelPath = '';
  try {
    if (Platform.OS === 'android') {
      const destPath = `${RNFS.DocumentDirectoryPath}/${modelFilename}`;
      const exists = await RNFS.exists(destPath);
      if (!exists) {
        await RNFS.copyFileAssets(modelFilename, destPath);
      }
      modelPath = destPath;
    } else {
      modelPath = `${RNFS.MainBundlePath}/${modelFilename}`;
    }

    const session = await InferenceSession.create(modelPath);
    return session;
  } catch (e) {
    return null;
  }
}

export const loadTextEncoder = async (): Promise<any | null> => {
  return loadOnnxModel(TEXT_MODEL_FILENAME);
};

export const loadImageEncoder = async (): Promise<any | null> => {
  return loadOnnxModel(IMAGE_MODEL_FILENAME);
};

