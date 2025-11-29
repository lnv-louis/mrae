import { Platform, NativeModules } from 'react-native';

const TEXT_MODEL_FILENAME = 'siglip2_text_encoder.onnx';
const IMAGE_MODEL_FILENAME = 'siglip2_image_encoder.onnx';

// Lazy load ONNX to prevent errors at module load time
let onnxruntimeModule: any = null;
let onnxruntimeLoadAttempted = false;

export function tryLoadOnnxRuntime(): any {
  // Only try once to prevent repeated errors
  if (onnxruntimeLoadAttempted) {
    return onnxruntimeModule;
  }
  
  onnxruntimeLoadAttempted = true;
  
  // Use a defensive pattern with comprehensive error checking
  try {
    // CRITICAL: Check NativeModules FIRST before requiring the JS module
    // The require() call triggers module initialization which tries to access
    // the native module. If the native module doesn't exist, this will throw
    // an error that React Native's error handler logs before our catch can suppress it.
    
    // Check for native module using multiple possible names
    let hasNativeModule = false;
    if (NativeModules) {
      // Try common naming patterns
      const possibleNames = [
        'OnnxruntimeModule',
        'ONNXRuntimeModule',
        'OnnxRuntimeModule',
        'OnnxRuntime',
        'ONNXRuntime',
        'Onnxruntime',
      ];
      
      // Check direct property access
      hasNativeModule = possibleNames.some(name => 
        NativeModules[name] !== undefined && NativeModules[name] !== null
      );
      
      // Also check if any native module name contains 'onnx' (case-insensitive)
      if (!hasNativeModule) {
        const allModuleNames = Object.keys(NativeModules || {});
        hasNativeModule = allModuleNames.some(name => 
          name.toLowerCase().includes('onnx')
        );
      }
    }
    
    // If native module doesn't exist, skip require() entirely to prevent error
    // This is the KEY fix - by not calling require() when native module is missing,
    // we prevent the "Cannot read property 'install' of null" error from being thrown
    if (!hasNativeModule) {
      // Native module not linked - return null without attempting require
      // This prevents the error from being thrown in the first place
      onnxruntimeModule = null;
      return null;
    }
    
    // Native module appears to exist, but we still need to be careful
    // The require() call might still fail if the module isn't fully initialized
    let moduleLoaded = false;
    let requireError: any = null;
    
    // Use a very defensive require pattern
    // Even though we checked for native module, the require might still fail
    // if the module initialization code runs before the native bridge is ready
    try {
      // @ts-ignore - dynamic require
      // This require() call will execute the module's initialization code
      // If that code tries to access a null native module, it will throw here
      const result = require('onnxruntime-react-native');
      
      // Verify the result is valid before using it
      if (result && typeof result === 'object') {
        onnxruntimeModule = result;
        moduleLoaded = true;
      } else {
        requireError = new Error('ONNX Runtime module returned invalid result');
        moduleLoaded = false;
      }
    } catch (err: any) {
      // Catch errors during require() call or module initialization
      // This includes the "Cannot read property 'install' of null" error
      requireError = err;
      moduleLoaded = false;
    }
    
    // If require failed, check the error type
    if (!moduleLoaded || requireError) {
      const errorMsg = requireError?.message || String(requireError) || '';
      const errorStack = requireError?.stack || '';
      const fullError = (errorMsg + ' ' + errorStack).toLowerCase();
      
      // Check for the specific "install" or "null" errors
      // These indicate the native module isn't properly linked/initialized
      if (fullError.includes('install') || 
          fullError.includes('null') || 
          fullError.includes('cannot read property') ||
          fullError.includes('undefined') ||
          fullError.includes('native module') ||
          fullError.includes('not found')) {
        // Silently suppress these known errors - they indicate missing native module
        onnxruntimeModule = null;
        return null;
      }
      // For other errors, log but still return null
      console.warn('⚠️ ONNX Runtime require error:', errorMsg);
      onnxruntimeModule = null;
      return null;
    }
    
    // If we got here, module was loaded successfully
    // But verify it's a valid object with expected properties
    if (!onnxruntimeModule || typeof onnxruntimeModule !== 'object') {
      onnxruntimeModule = null;
      return null;
    }
    
    // Verify the module has the expected API
    if (!onnxruntimeModule.InferenceSession) {
      console.warn('⚠️ ONNX Runtime module loaded but InferenceSession not available');
      onnxruntimeModule = null;
      return null;
    }
    
    return onnxruntimeModule;
  } catch (e: any) {
    // Outer catch for any unexpected errors during the entire process
    const errorMsg = e?.message || String(e) || '';
    const errorStack = e?.stack || '';
    const fullError = (errorMsg + ' ' + errorStack).toLowerCase();
    
    if (fullError.includes('install') || 
        fullError.includes('null') || 
        fullError.includes('cannot read property') ||
        fullError.includes('undefined') ||
        fullError.includes('native module') ||
        fullError.includes('not found')) {
      // Silently suppress these known errors
      onnxruntimeModule = null;
      return null;
    }
    // For other errors, log but still return null
    console.warn('⚠️ ONNX Runtime unexpected error:', errorMsg);
    onnxruntimeModule = null;
    return null;
  }
}

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
    // Try to load ONNX Runtime using our safe loader
    const onnxruntime = tryLoadOnnxRuntime();
    
    if (!onnxruntime) {
      console.warn('⚠️ ONNX Runtime module not available');
      return null;
    }
    
    // Check if InferenceSession exists and is a function
    if (!onnxruntime.InferenceSession || typeof onnxruntime.InferenceSession !== 'function') {
      console.warn('⚠️ ONNX Runtime InferenceSession not available');
      return null;
    }
    
    InferenceSession = onnxruntime.InferenceSession;
  } catch (e: any) {
    // Final catch-all for any unexpected errors
    const errorMsg = e?.message || String(e) || '';
    if (errorMsg.includes('install') || 
        errorMsg.includes('null') || 
        errorMsg.includes('Cannot read property') ||
        errorMsg.includes('undefined')) {
      console.warn('⚠️ ONNX Runtime native module not initialized (install error suppressed)');
    } else {
      console.warn('⚠️ onnxruntime-react-native error:', errorMsg);
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

