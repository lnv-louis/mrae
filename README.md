# MRAE - Memory-Retrieved Album Explorer

A React Native app for semantic photo search using on-device AI and cloud vision models.

## Features

- **Gallery**: Browse all photos from device with auto-categorization
- **Explore**: Semantic search using text or voice queries (e.g., "sunset with people")
- **Creative**: AI photo analysis using Gemini Vision via OpenRouter
- **Clean**: Photo management with swipe interface
- **Settings**: Model management and indexing controls

## Architecture

### On-Device AI (Cactus SDK)
- **Speech-to-Text**: Whisper-small model for voice search transcription
- **Text Embeddings**: SigLIP-2 ONNX text encoder (1.1GB model)
- **Image Embeddings**: SigLIP-2 ONNX image encoder for semantic search

### Cloud AI (OpenRouter)
- **Vision Analysis**: Gemini 2.5 Flash for categorization
- **Image Analysis**: Gemini 3 Pro Image for photo understanding
- **Text Generation**: Gemini 2.5 Flash for AI responses

### Storage
- **SQLite**: Photo metadata, embeddings, and category mappings
- **Local**: All embeddings stored on-device for offline search

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure OpenRouter API Key

Create a `.env` file in the project root:
```bash
OPENROUTER_API_KEY=your_api_key_here
```

Or add to `app.json`:
```json
{
  "expo": {
    "extra": {
      "openrouterApiKey": "your_api_key_here"
    }
  }
}
```

Get your API key from: https://openrouter.ai/

### 3. Development Build

For development with live reload and dev menu:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk && \
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools && \
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" && \
npx expo run:android
```

### 4. Production Build

For consumer-ready builds without dev menu:

**Local Release Build (Recommended):**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk && \
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools && \
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" && \
cd android && ./gradlew assembleRelease
```

**Or using EAS Build:**

Preview Build (Internal Distribution):
```bash
eas build --profile preview --platform android
```

Production Build (App Store):
```bash
eas build --profile production --platform android
```

**APK Location:**
After building, the production APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

**APK Size:** ~1.1GB (includes on-device AI models: ONNX Runtime, Cactus STT, embeddings)

## Models Used

### On-Device (Cactus SDK)
- **STT**: `whisper-small` - Speech transcription for voice search
- **Text Encoder**: `siglip2_text_encoder.onnx` - 1.1GB ONNX model for text embeddings
- **Image Encoder**: SigLIP-2 for image embeddings

### Cloud (OpenRouter)
- **LLM**: `google/gemini-2.5-flash-preview-09-2025` - Fast text generation
- **Vision**: `google/gemini-3-pro-image-preview` - Image analysis

## Key Features

### 1. Auto-Categorization
- Uses Gemini Vision to analyze sample photos
- Generates intelligent categories based on photo content
- Stores category embeddings for fast similarity search
- Full AI pipeline (no placeholder data)

### 2. Voice Search
- Cactus STT with Whisper model transcribes voice queries
- Converts speech to text with proper Whisper prompt format
- WAV audio format optimized for best transcription accuracy
- Full pipeline with proper error handling

### 3. Semantic Search
- ONNX Runtime text embeddings for queries
- Cosine similarity search against photo embeddings
- Fast on-device search (no network required)
- Progressive loading with FlashList for 60fps scrolling

### 4. Photo Analysis
- Gemini Vision analyzes photo content via OpenRouter
- Proper OpenAI-compatible image format (image_url)
- Supports up to 4k resolution images
- Note: Analysis only (not image editing/generation)

## Requirements

- **React Native**: 0.81.5
- **Expo SDK**: 54
- **Android SDK**: API 35 (Android 15) for Nothing Phone 3
- **Cactus SDK**: `cactus-react-native` for on-device AI
- **ONNX Runtime**: Native module for ML inference
- **OpenRouter API Key**: For cloud AI features

## Build Profiles

### Development
- Development client enabled
- Live reload and dev menu
- Internal distribution
- Use: `npx expo run:android`

### Preview
- Development client disabled
- Consumer-like experience
- Internal distribution (no app store)
- Use: `eas build --profile preview --platform android`

### Production
- Development client disabled
- Auto-increment version
- App store distribution
- Use: `eas build --profile production --platform android`

## Notes

- **Models**: Downloaded automatically on first use
- **Indexing**: Processes photos in background on app start
- **Search**: All processing happens on-device (offline capable)
- **Categories**: AI-generated based on your photo content
- **Voice Search**: Requires microphone permissions
- **Image Analysis**: Requires OpenRouter API key and internet connection

## Troubleshooting

### "Cannot find native module 'ExpoImageManipulator'"
Rebuild the app after installing dependencies:
```bash
npx expo run:android
```

### "ONNX Runtime not loading"
Clean build cache:
```bash
cd android && ./gradlew clean && rm -rf .gradle && cd ..
npx expo run:android --no-build-cache
```

### "OpenRouter API error: token limit exceeded"
This should be fixed - images are sent in proper format. If still occurring, check that geminiService.ts doesn't stringify content arrays.

### Developer menu appears in production build
Use EAS Build or local release build, not `npx expo run:android` which always creates a dev build:
```bash
eas build --profile preview --platform android
```
