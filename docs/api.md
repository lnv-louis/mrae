# MRAE API Reference

## Overview
This app exposes a set of TypeScript services under `src/services/` that implement image indexing, embeddings, search, categorization, preferences, vision analysis, and editing. This document summarizes the public APIs available for use in UI and integration code.

## Embeddings & Vision

- `src/services/embeddingService.ts`
  - `embedText(text: string): Promise<{ embedding: number[]; success: boolean }>`
  - `embedImage(imagePath: string): Promise<{ embedding: number[]; success: boolean }>`
  - `generateCaption(imagePath: string): Promise<string | null>`
  - `generateCaptionWithContext(ref: { id?: string; uri?: string }): Promise<{ caption: string | null; city?: string | null; time?: string | null }>`

- `src/services/cactusService.ts`
  - `available(): boolean`
  - `init(model?: string): Promise<void>`
  - `imageEmbed(imagePath: string): Promise<number[] | null>`
  - `complete(messages: Array<{ role: 'user' | 'assistant'; content: string; images?: string[] }>): Promise<string | null>`
  - `analyzeImage(imagePath: string, prompt?: string): Promise<string | null>`
  - `destroy(): Promise<void>`

- `src/services/geminiService.ts`
  - `setApiKey(key: string): void`
  - `hasApiKey(): boolean`
  - `generateContent(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: any }>, model?: string): Promise<GeminiGenerateResponse | null>`
  - `formatImageMessage(text: string, imageDataBase64: string): { role: 'user'; content: any }`
  - `embedText(text: string, model?: string): Promise<number[] | null>`

## Search

- `src/services/querySearchService.ts`
  - `searchByExpandedText(query: string, options?: { threshold?: number; limit?: number }): Promise<{ results: Array<{ id: string; uri: string; score: number; phrase: string }>; phrases: string[]; message: string }>`
  - `searchByHybridText(query: string, options?: { threshold?: number; limit?: number }): Promise<{ results: Array<{ id: string; uri: string; score: number; phrase: string }>; phrases: string[]; filters: { city?: string | null; startMs?: number | null; endMs?: number | null }; message: string }>`

- `src/services/vectorSearch.ts`
  - `searchVectorOnly(queryText: string, onnxSession: any, tokenizer: any, minScoreThreshold?: number, opts?: { hateTag?: string; penaltyFactor?: number }): Promise<{ results: Array<{ uri: string; score: number }>; message: string; foundCount: number }>`

- `src/services/speechQueryService.ts`
  - `searchByAudio(audioFilePath: string, options?: { threshold?: number; limit?: number; language?: string }): Promise<{ transcript: string; phrases: string[]; results: Array<{ id: string; uri: string; score: number; phrase: string }>; message: string }>`

## Categorization

- `src/services/categorizationService.ts`
  - `categorizeAllImagesFromPrompt(prompt: string, options?: { threshold?: number }): Promise<{ labels: string[]; counts: Array<{ label: string; topScore: number; count: number }>; message: string }>`

## Preferences (Negative Space Learning)

- `src/services/userPreferenceService.ts`
  - `markPreference(image_id: string, feedback_tag?: string): Promise<boolean>`
  - `calculateHateCentroid(feedback_tag?: string): Promise<Float32Array>`

## Vision Diff & Editing

- `src/services/editDiffService.ts`
  - `diffAndApply(originalImagePath: string, editedImagePath: string): Promise<{ diffText: string; instructions: string; result: { success: boolean; outputPath?: string; summary?: string } }>`

- `src/services/nanoBananaService.ts`
  - `applyDiff(originalPath: string, instructions: string): Promise<{ success: boolean; outputPath?: string; summary?: string }>`

## Indexing & Metadata

- `src/services/indexingService.ts`
  - `startIndexing(): Promise<void>`
  - `ensureUpToDate(): Promise<void>`
  - `stopIndexing(): void`
  - `isIndexingInProgress(): boolean`
  - `getIndexingStatus(): Promise<{ isIndexing: boolean; progress: any | null; lastIndexed: number | null }>`

- `src/services/photoService.ts`
  - `requestPermissions(): Promise<boolean>`
  - `checkPermissions(): Promise<boolean>`
  - `getAllPhotos(): Promise<PhotoMetadata[]>`
  - `getPhotos(limit?: number, after?: string): Promise<{ photos: PhotoMetadata[]; hasNextPage: boolean; endCursor?: string }>`
  - `getPhotoById(id: string): Promise<PhotoMetadata | null>`

- `src/services/geoService.ts`
  - `reverseGeocodeToCity(lat: number, lon: number): Promise<string | null>`

## Database

- `src/services/databaseService.ts`
  - `init(): Promise<void>`
  - `execute(sql: string, params?: any[]): Promise<{ rows: any[] }>`
  - `run(sql: string, params?: any[]): Promise<any>`
  - `getAll(sql: string, params?: any[]): Promise<any[]>`
  - `initImageIndex(): Promise<void>`
  - `initImageLabels(): Promise<void>`
  - `initUserPreferences(): Promise<void>`
  - `getImageIndexIds(): Promise<string[]>`
  - `beginTransaction(): Promise<void>`
  - `commitTransaction(): Promise<void>`
  - `rollbackTransaction(): Promise<void>`
  - `insertImageIndex(entry: { id: string; uri: string; embedding: Uint8Array; latitude: number | null; longitude: number | null; city: string | null; timestamp: number }): Promise<void>`
  - `insertImageLabel(item: { image_id: string; label: string; score: number }): Promise<void>`
  - `clearLabelsByLabel(label: string): Promise<void>`
  - `insertUserPreference(pref: { image_id: string; feedback_tag: string; embedding_vector: Uint8Array }): Promise<void>`
  - `getPreferenceEmbeddingsByTag(tag: string): Promise<Float32Array[]>`

## Notes
- Many APIs gracefully degrade in Expo Go environments, using mocked behaviors when native modules or cloud keys are not available.
- For best results, set `GEMINI_API_KEY` in `.env` or Expo config, and install `cactus-react-native` with models downloaded.
- Ensure the `image_index` table is populated via `indexingService` before using search/categorization features.
