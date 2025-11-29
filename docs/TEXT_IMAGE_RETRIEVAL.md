# Text-Image Retrieval Architecture

## Overview

This app implements an **offline-capable text-image retrieval system** using a hybrid approach:

- **Image Embeddings**: Cactus Visual Encoder (`lfm2-vl-450m`) - 450MB
- **Text Embeddings**: Your Custom ONNX Text Encoder

Both encoders output vectors in the **same high-dimensional embedding space** (e.g., 512D or 768D), enabling **cosine similarity search** between text queries and images.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Text-Image Retrieval                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │  Image Indexing  │          │  Text Query      │
    │                  │          │                  │
    │  Cactus Visual   │          │  Custom ONNX     │
    │  Encoder         │          │  Text Encoder    │
    │  (lfm2-vl-450m)  │          │  (your .onnx)    │
    └──────────────────┘          └──────────────────┘
              │                               │
              │ 512D/768D vector              │ 512D/768D vector
              │                               │
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │  Store in DB     │          │  Cosine          │
    │  with metadata   │──────────│  Similarity      │
    └──────────────────┘          │  Search          │
                                  └──────────────────┘
                                            │
                                            ▼
                                  ┌──────────────────┐
                                  │  Top N Results   │
                                  └──────────────────┘
```

---

## How It Works

### 1. Image Indexing (On App Launch)

When the app starts and during onboarding:

1. **Scan Device Photos**: Use `expo-media-library` to access all photos
2. **Generate Image Embeddings**: For each photo, use `cactusService.imageEmbed(imagePath)` to get a vector
3. **Store in Database**: Save the vector alongside photo metadata (ID, path, timestamp, location)

```typescript
// In indexingService.ts
const photos = await photoService.getAllPhotos();

for (const photo of photos) {
  // Generate image embedding with Cactus
  const embedding = await embeddingService.embedImage(photo.uri);
  
  // Store in database
  await databaseService.storePhotoEmbedding(photo.id, embedding);
}
```

### 2. Text Query (On Search)

When a user types a search query:

1. **Encode Text**: Use `onnxService.embedText(query)` to convert text to a vector
2. **Calculate Similarity**: Compare with all stored image vectors using cosine similarity
3. **Rank Results**: Sort by similarity score (highest = best match)
4. **Return Top N**: Show the most relevant images

```typescript
// In querySearchService.ts
const queryVector = await embeddingService.embedText(userQuery);

const results = allPhotos.map(photo => ({
  ...photo,
  score: cosineSimilarity(queryVector, photo.embedding),
}));

const topResults = results
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);
```

### 3. Cosine Similarity Formula

```typescript
function cosineSimilarity(A: number[], B: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

---

## File Structure

```
mrae/src/services/
├── cactusService.ts        # Cactus Visual Encoder (image embeddings only)
├── onnxService.ts          # Custom ONNX Text Encoder (text embeddings)
├── embeddingService.ts     # Orchestrates both services
├── indexingService.ts      # Indexes all photos on device
├── querySearchService.ts   # Performs similarity search
└── databaseService.ts      # Stores/retrieves embeddings
```

---

## Integration Steps for Your ONNX Model

### Step 1: Install ONNX Runtime for React Native

Choose one of these options:

#### Option A: Use `onnxruntime-react-native` (if available)

```bash
npm install onnxruntime-react-native
```

#### Option B: Write a Native Module

If no React Native package exists, you'll need to create a Native Module:

**Android (Java/Kotlin)**:
```kotlin
// android/app/src/main/java/com/mrae/OnnxModule.kt
import com.facebook.react.bridge.*
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession

class OnnxModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {
    
    private var session: OrtSession? = null
    
    override fun getName() = "OnnxModule"
    
    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        // Load your .onnx model
        val env = OrtEnvironment.getEnvironment()
        session = env.createSession(modelPath)
        promise.resolve("Model loaded")
    }
    
    @ReactMethod
    fun embedText(text: String, promise: Promise) {
        // 1. Tokenize text
        // 2. Run inference
        // 3. Extract embedding vector
        // 4. Return as array
    }
}
```

**iOS (Swift)**:
```swift
// ios/OnnxModule.swift
import Foundation
import onnxruntime_objc

@objc(OnnxModule)
class OnnxModule: NSObject {
    private var session: ORTSession?
    
    @objc
    func loadModel(_ modelPath: String, 
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        // Load your .onnx model
        do {
            session = try ORTSession(modelPath: modelPath)
            resolve("Model loaded")
        } catch {
            reject("LOAD_ERROR", "Failed to load model", error)
        }
    }
    
    @objc
    func embedText(_ text: String,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        // 1. Tokenize text
        // 2. Run inference
        // 3. Extract embedding vector
        // 4. Return as array
    }
}
```

### Step 2: Implement Tokenization

Your text encoder needs the same tokenization as the original model (e.g., CLIP, BERT).

#### Option A: JavaScript Tokenizer

Use a library like `@xenova/transformers` or `@huggingface/tokenizers`:

```bash
npm install @xenova/transformers
```

```typescript
import { AutoTokenizer } from '@xenova/transformers';

// Load tokenizer (one-time)
const tokenizer = await AutoTokenizer.from_pretrained('your-model-name');

// Tokenize input
const tokens = await tokenizer(text, {
  padding: true,
  truncation: true,
  max_length: 77, // e.g., for CLIP
  return_tensors: 'pt',
});
```

#### Option B: Native Tokenizer

Implement tokenization in your Native Module using the original model's tokenizer.

### Step 3: Update `onnxService.ts`

Once you have ONNX Runtime integrated, update the placeholder methods in `src/services/onnxService.ts`:

```typescript
import { NativeModules } from 'react-native';
const { OnnxModule } = NativeModules;

class OnnxService {
  async initialize(modelPath: string): Promise<boolean> {
    try {
      await OnnxModule.loadModel(modelPath);
      this.isReady = true;
      return true;
    } catch (error) {
      console.error('Failed to load ONNX model:', error);
      return false;
    }
  }

  async embedText(text: string): Promise<number[] | null> {
    try {
      const embedding = await OnnxModule.embedText(text);
      return embedding;
    } catch (error) {
      console.error('Text embedding failed:', error);
      return null;
    }
  }
}
```

### Step 4: Provide Your Model Path

When initializing the embedding service, provide the path to your `.onnx` file:

```typescript
// In indexingService.ts or App.tsx
await embeddingService.initializeTextModel(
  'path/to/your/text_encoder.onnx'
);
```

You can bundle the model in your app:
- **Android**: `android/app/src/main/assets/text_encoder.onnx`
- **iOS**: Add to Xcode project as a resource

Or download it on first launch (recommended for large models).

---

## Current Status

✅ **Implemented:**
- Cactus Visual Encoder integration (`cactusService.ts`)
- Image embedding indexing (`indexingService.ts`)
- Cosine similarity search (`querySearchService.ts`)
- Database storage for embeddings (`databaseService.ts`)
- ONNX service scaffold (`onnxService.ts`)
- Embedding service orchestration (`embeddingService.ts`)

⏳ **TODO:**
1. Integrate ONNX Runtime for React Native
2. Implement tokenization in `onnxService.ts`
3. Load your custom `.onnx` text encoder model
4. Test end-to-end retrieval with real queries

---

## Testing the Retrieval System

Once your ONNX model is integrated:

### 1. Index Photos

```typescript
// Trigger indexing (happens automatically on onboarding)
await indexingService.startIndexing();
```

### 2. Test Text Query

```typescript
// Search for photos
const results = await querySearchService.search('sunset on the beach');
console.log('Top results:', results);
```

### 3. Verify Embeddings

```typescript
// Check vector dimensions match
const textEmb = await embeddingService.embedText('test');
const imageEmb = await embeddingService.embedImage('photo.jpg');

console.log('Text embedding dim:', textEmb.embedding.length);
console.log('Image embedding dim:', imageEmb.embedding.length);
// Both should be the same (e.g., 512 or 768)
```

---

## Performance Tips

### For Small Datasets (< 1000 images)

Use the JavaScript cosine similarity function directly. It's fast enough for most use cases.

### For Large Datasets (> 1000 images)

Consider integrating a native vector search library like **FAISS**:

```bash
# Install FAISS via Native Module
# https://github.com/facebookresearch/faiss
```

FAISS provides optimized similarity search with indexing structures like IVF, HNSW, and PQ compression.

---

## Privacy & Security

✅ **100% On-Device Processing**
- Image embeddings: Cactus (local)
- Text embeddings: Your ONNX model (local)
- No data sent to cloud
- No API keys required (Gemini is optional fallback)

✅ **Secure Storage**
- Embeddings stored in SQLite database
- Photos never leave the device
- User controls all data

---

## Example Queries

Once integrated, users can search for:

- **"sunset on the beach"** → Beach photos at sunset
- **"my dog playing"** → Photos of dogs
- **"birthday party"** → Party photos
- **"mountain landscape"** → Mountain scenery
- **"food on table"** → Food photos

The quality of results depends on:
1. Quality of your text encoder model
2. Alignment between text and image embedding spaces
3. Diversity of indexed photos

---

## Next Steps

1. **Choose an ONNX Runtime integration approach** (Native Module recommended)
2. **Prepare your `.onnx` model file** and tokenizer configuration
3. **Update `onnxService.ts`** with real implementation
4. **Test with sample queries** to verify embedding alignment
5. **Optimize for performance** if needed (FAISS, quantization)

---

## Resources

- [Cactus React Native Docs](https://cactuscompute.com/docs/react-native)
- [Microsoft ONNX Runtime](https://onnxruntime.ai/)
- [ONNX Runtime Mobile](https://onnxruntime.ai/docs/tutorials/mobile/)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)
- [FAISS](https://github.com/facebookresearch/faiss)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)

---

## Questions?

If you need help with:
- ONNX Runtime integration
- Tokenization
- Vector search optimization
- Model alignment

Feel free to refer to this documentation or check the inline comments in the code!

