# MRAE - Memory-retrieved Album Explorer

A React Native app for semantic photo search using on-device AI with Cactus SDK.

## Features

- **Gallery**: Browse all photos from device
- **Explore**: Semantic search using text queries (e.g., "sunset with people")
- **Creative**: AI photo editing (placeholder)
- **Clean**: Garbage collection with swipe interface (placeholder)
- **Settings**: Model management and indexing controls

## Architecture

- **Memory**: Persistent local storage for photo metadata and embeddings
- **Intelligence**: Cactus SDK models (Liquid VLM, Qwen3)
- **Communication Interface**: React Native UI with 5 tabs

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on Android:
```bash
npm run android
```

## Building APK

For Android build:
```bash
npx expo build:android
```

Or using EAS Build:
```bash
npx eas build --platform android
```

## Models Used

- **Image Embeddings**: `lfm2-vl-450m` (vision-capable model)
- **Text Embeddings**: `qwen3-0.6` (for query embeddings)
- **Captioning**: `lfm2-vl-450m` (optional)

## Requirements

- React Native with Expo
- Android SDK (for Nothing Phone 3: Android 15, API 35)
- Cactus SDK (`cactus-react-native`)

## Notes

- Models are downloaded on first use
- Indexing processes photos in background
- All processing happens on-device (offline)
