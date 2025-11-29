# ONNX Runtime Error Fix

## Error Description

The app was experiencing the following error when trying to initialize the ONNX Runtime module:

```
TypeError: Cannot read property 'install' of null
    at onnxService.ts:74
```

This error occurred during the initialization of the text embedding model (SigLIP-2 ONNX encoder).

## Root Cause

The error `Cannot read property 'install' of null` indicates that:

1. **Native Module Not Linked**: The `onnxruntime-react-native` package requires native code to be properly linked. The error occurs when the module tries to access `NativeModules.OnnxruntimeModule.install()`, but the native module is `null`.

2. **Module Initialization Issue**: The error happens synchronously during the `require('onnxruntime-react-native')` call, when the module's initialization code tries to access the native module before it's available.

3. **Common Causes**:
   - Native module not properly autolinked
   - App needs to be rebuilt after installing the package
   - Native module initialization happens before React Native bridge is ready
   - Compatibility issues with React Native/Expo version

## Solution Implemented

### 1. Updated `onnxService.ts`

Changed the initialization to use the safer `tryLoadOnnxRuntime()` function from `onnxModelLoader.ts` instead of directly requiring the module:

**Before:**
```typescript
const safeRequireOnnx = () => {
  try {
    return require('onnxruntime-react-native');
  } catch (requireError: any) {
    // Error handling...
  }
};
```

**After:**
```typescript
const { tryLoadOnnxRuntime, loadTextEncoder } = await import('./onnxModelLoader');
const onnxruntime = tryLoadOnnxRuntime();
```

### 2. Improved `onnxModelLoader.ts`

Enhanced the `tryLoadOnnxRuntime()` function with:
- Better native module detection before requiring
- More comprehensive error handling for synchronous errors
- Validation of module structure after loading
- Clearer error messages with actionable guidance

### 3. Error Handling Improvements

- Catches errors that occur during module initialization
- Checks for native module existence before requiring
- Validates module structure (InferenceSession availability)
- Provides helpful error messages suggesting rebuild steps

## How It Works Now

1. **Safe Loading**: The code first checks if the native module exists in `NativeModules`
2. **Defensive Require**: Wraps the `require()` call in multiple try-catch blocks to catch errors at different stages
3. **Graceful Fallback**: If ONNX Runtime is not available, the app falls back to mock embeddings or Gemini API
4. **User-Friendly Messages**: Provides clear error messages explaining what went wrong and how to fix it

## Expected Behavior

### When ONNX Runtime is Available:
```
🔧 Loading SigLIP-2 text encoder...
✅ ONNX Runtime loaded successfully
✅ SigLIP-2 text encoder ready (with simple tokenizer)!
```

### When ONNX Runtime is Not Available:
```
🔧 Loading SigLIP-2 text encoder...
⚠️ ONNX Runtime module not available (native module not linked/initialized)
💡 This is expected if the native module is not properly linked.
💡 The app will use fallback embeddings instead.
⚠️ Text model initialization failed, will use fallback
```

The app continues to work using fallback embeddings (mock or Gemini API).

## If You Still See the Error

If you continue to see the error after this fix, try the following:

### 1. Rebuild the Android App

The native module needs to be compiled into the app:

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### 2. Clear Metro Cache

Sometimes cached modules can cause issues:

```bash
npm start -- --reset-cache
# or
expo start -c
```

### 3. Verify Native Module Linking

Check if the module is properly autolinked. For React Native 0.60+, autolinking should handle this automatically, but you can verify:

```bash
# Check if the module is in node_modules
ls node_modules/onnxruntime-react-native

# Reinstall if needed
npm install onnxruntime-react-native
```

### 4. Check Android Build Configuration

Ensure the native module is included in your `android/app/build.gradle`. With autolinking, this should be automatic, but verify the build succeeds.

### 5. Alternative: Use Fallback Only

If ONNX Runtime continues to cause issues, the app is designed to work without it:
- Text embeddings will use Gemini API (if API key is set) or mock embeddings
- Image embeddings will continue to use Cactus (which works independently)
- The app functionality remains intact

## Technical Details

### Error Flow

1. `embeddingService.initializeTextModel()` is called
2. `onnxService.initialize()` is invoked
3. `tryLoadOnnxRuntime()` attempts to load the module
4. `require('onnxruntime-react-native')` is called
5. Module initialization code runs and tries to access `NativeModules.OnnxruntimeModule.install()`
6. **Error occurs** if native module is null
7. Error is caught and handled gracefully
8. App falls back to alternative embedding methods

### Why the Fix Works

- **Defensive Loading**: Checks native module existence before requiring
- **Multiple Error Catchers**: Catches errors at different stages (require, initialization, validation)
- **Graceful Degradation**: App continues to work even if ONNX Runtime fails
- **Better Error Messages**: Helps developers understand what went wrong

## Related Files

- `src/services/onnxService.ts` - Main ONNX service
- `src/services/onnxModelLoader.ts` - Safe ONNX Runtime loader
- `src/services/embeddingService.ts` - Embedding service that uses ONNX
- `src/services/indexingService.ts` - Triggers ONNX initialization

## Notes

- The error is now caught and handled gracefully
- The app will continue to function with fallback embeddings
- The error message in the console is expected and can be ignored if you're using fallbacks
- To fully resolve the error (not just handle it), you need to ensure the native module is properly linked and rebuild the app

