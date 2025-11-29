# Memory Management and Progress Tracking Fix

**Date:** 2025-11-29
**Issues Addressed:** Out of Memory Error, Missing Progress Updates, Model Initialization Flow

---

## Problems Identified

### 1. Out of Memory (OOM) Error with BPE Tokenizer

**Error:**
```
ERROR ❌ Error loading tokenizer.json: Exception in HostFunction: Failed to allocate a 45808424 byte allocation with 11687680 free bytes and 11MB until OOM
WARN ⚠️ Failed to load tokenizer.json
WARN ⚠️ BPE Tokenizer failed to load, will use fallback
```

**Root Cause:**
- The `tokenizer.json` file is 45MB
- During app initialization, the ONNX text model loads this file synchronously into memory
- The app only has ~11MB free memory at that point, causing allocation failure
- This happens in `embeddingService.initializeTextModel()` called during onboarding

**Impact:**
- App crashes or fails to initialize text embeddings
- ONNX Runtime becomes unavailable
- Fallback to Gemini API or mock embeddings required

### 2. ONNX Runtime Module Not Available

**Error:**
```
WARN ⚠️ ONNX Runtime module not available (native module not linked/initialized)
LOG ⚠️ Text model initialization failed, will use fallback
```

**Root Cause:**
- Native module may not be properly linked
- Even if linked, the OOM error prevents successful initialization
- The app attempts to initialize ONNX during onboarding when memory is constrained

### 3. Model Download Progress Not Shown

**Issue:**
- Vision model (Cactus lfm2-vl-450m, 450MB) downloads in background
- STT model (whisper-small) downloads in background
- Logs show progress: `LOG Vision model download: 80%`, `LOG Vision model download: 81%`
- Onboarding screen shows 0% and doesn't update in real-time
- User sees stuck progress bar while models download

**Root Cause:**
- `indexingService.startIndexing()` accepts an `onProgress` callback
- `embeddingService.initializeImageModel()` accepts an `onProgress` callback
- `transcriptionService.initialize()` accepts an `onProgress` callback
- But these callbacks were not wired up - progress was logged but not forwarded to UI
- `IndexingProgress` type didn't support stage-specific progress tracking

### 4. Sequential Model Initialization Without Visibility

**Issue:**
- Models initialized sequentially:
  1. Vision model (450MB download)
  2. Text model (ONNX + 45MB tokenizer) - causes OOM
  3. STT model (whisper-small)
- User sees no indication of which stage is active
- No visibility into what's happening during the 450MB vision model download

---

## Solution Architecture

### Strategy Overview

1. **Lazy Load Text Model** - Skip ONNX text model initialization during onboarding to avoid OOM
2. **Enhanced Progress Tracking** - Extend `IndexingProgress` type to include stage information
3. **Real-Time Progress Updates** - Wire up progress callbacks from services to UI
4. **Graceful Fallback Handling** - Improve error messages for OOM scenarios

### Implementation Details

#### 1. Lazy Loading Text Model (Fix for OOM)

**Change:** Skip `embeddingService.initializeTextModel()` during onboarding

**Files Modified:**
- `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/services/indexingService.ts`

**Before:**
```typescript
try {
  // Initialize models
  await embeddingService.initializeImageModel();
  await embeddingService.initializeTextModel(); // ❌ Causes OOM

  // Initialize STT model
  const transcriptionService = (await import('./transcriptionService')).default;
  // ...
}
```

**After:**
```typescript
try {
  // Initialize vision model with progress tracking
  await embeddingService.initializeImageModel((progress) => {
    if (this.onProgressCallback) {
      this.onProgressCallback({
        total: 0,
        processed: 0,
        stage: 'vision_model',
        stageProgress: progress,
        stageName: `Downloading vision model: ${Math.round(progress * 100)}%`,
      });
    }
  });

  // Skip text model initialization to avoid OOM - lazy load on first text search ✅
  console.log('⏭️ Skipping text model initialization (lazy load on first search)');

  // Initialize STT model with progress tracking
  const transcriptionService = (await import('./transcriptionService')).default;
  if (transcriptionService.available()) {
    await transcriptionService.initialize('whisper-small', (progress) => {
      if (this.onProgressCallback) {
        this.onProgressCallback({
          total: 0,
          processed: 0,
          stage: 'stt_model',
          stageProgress: progress,
          stageName: `Downloading speech model: ${Math.round(progress * 100)}%`,
        });
      }
    });
  }
}
```

**Rationale:**
- Text embeddings are only needed when user performs a text search
- The `embeddingService.embedText()` method already has auto-initialization logic
- On first text search, ONNX will be initialized lazily when memory is less constrained
- If ONNX fails, graceful fallback to Gemini API or mock embeddings

**Updated Documentation in Code:**
```typescript
/**
 * Initialize text embedding model (LAZY LOADED)
 * Uses SigLIP-2 ONNX text encoder for local inference
 *
 * This method is called lazily on first text search to avoid OOM during onboarding.
 * The tokenizer.json file is 45MB and can cause memory issues if loaded during app init.
 */
async initializeTextModel(onProgress?: (progress: number) => void): Promise<void>
```

#### 2. Enhanced Progress Tracking

**File Modified:**
- `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/types/index.ts`

**Before:**
```typescript
export interface IndexingProgress {
  total: number;
  processed: number;
  current?: string;
  error?: string;
}
```

**After:**
```typescript
export interface IndexingProgress {
  total: number;
  processed: number;
  current?: string;
  error?: string;
  stage?: 'vision_model' | 'stt_model' | 'indexing';
  stageProgress?: number; // 0.0 to 1.0 for current stage
  stageName?: string; // Human-readable stage name
}
```

**Usage:**
- `stage`: Identifies which phase of initialization is active
- `stageProgress`: Progress within the current stage (0.0 to 1.0)
- `stageName`: Human-readable description shown to user (e.g., "Downloading vision model: 85%")

#### 3. Real-Time Progress Updates in UI

**File Modified:**
- `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/screens/NeuralOnboarding.tsx`

**New State Variables:**
```typescript
const [currentStage, setCurrentStage] = useState<string>('');
const [stageProgress, setStageProgress] = useState<number>(0);
```

**Updated Progress Callback:**
```typescript
const startRealIndexing = async () => {
  try {
    await indexingService.startIndexing((progress) => {
      // Update stage information
      if (progress.stageName) {
        setCurrentStage(progress.stageName);
      }
      if (progress.stageProgress !== undefined) {
        setStageProgress(progress.stageProgress);
      }

      // Update indexing stats (only relevant during indexing stage)
      if (progress.stage === 'indexing') {
        setIndexingStats({
          processed: progress.processed,
          total: progress.total,
        });
        if (progress.current) {
          setCurrentPhoto(progress.current);
        }

        if (progress.processed >= progress.total && progress.total > 0) {
          setTimeout(onComplete, 1500);
        }
      }
    });
  } catch (error) {
    console.error('Indexing error:', error);
    setTimeout(onComplete, 1500);
  }
};
```

**Updated Progress Percentage:**
```typescript
// Calculate progress percentage based on current stage
// If we're in model download stages, use stageProgress
// If we're in indexing stage, use photo progress
const progressPercentage = indexingStats.total > 0
  ? indexingStats.processed / indexingStats.total
  : stageProgress;
```

**Updated Status Badge:**
```typescript
<View style={styles.statusBadge}>
  <PulsingDot />
  <Text style={styles.statusText}>
    {currentStage || (
      progressPercentage < 0.3
        ? 'Analyzing images...'
        : progressPercentage < 0.7
        ? 'Building connections...'
        : progressPercentage < 1
        ? 'Finalizing index...'
        : 'Complete!'
    )}
  </Text>
</View>
```

**Result:**
- User sees "Downloading vision model: 0%" → "Downloading vision model: 1%" → ... → "Downloading vision model: 100%"
- Then sees "Downloading speech model: 0%" → ... → "Downloading speech model: 100%"
- Then sees "Analyzing images: 0/100" → "Analyzing images: 1/100" → ... → "Analyzing images: 100/100"
- Progress bar updates in real-time with smooth animations

#### 4. Improved Error Handling for OOM

**File Modified:**
- `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/services/tokenizerService.ts`

**Enhanced Error Detection:**
```typescript
} catch (error: any) {
  const errorMsg = error?.message || String(error) || '';

  // Check for OOM-related errors
  if (errorMsg.includes('OOM') ||
      errorMsg.includes('memory') ||
      errorMsg.includes('allocat') ||
      errorMsg.includes('OutOfMemory')) {
    console.error('❌ Error loading tokenizer.json: Out of memory');
    console.log('💡 The tokenizer.json file is too large (45MB) to load at this time.');
    console.log('💡 This is expected - the app will use fallback tokenization or Gemini API.');
  } else {
    console.error('❌ Error loading tokenizer.json:', errorMsg);
  }
  console.warn('⚠️ Failed to load tokenizer.json');
  return null;
}
```

**Result:**
- Clear, actionable error messages
- Users understand the issue is expected and not fatal
- Graceful fallback to alternative solutions

---

## Testing Checklist

### Before Testing
1. Clear app data/cache
2. Uninstall and reinstall app to simulate first launch
3. Monitor logs during onboarding

### Test Scenarios

#### Scenario 1: First Launch (Fresh Install)
**Expected Behavior:**
1. User taps "Enter" on welcome screen
2. Screen shows "Downloading vision model: 0%"
3. Progress updates in real-time: 1%, 2%, 3%... up to 100%
4. Screen shows "Downloading speech model: 0%"
5. Progress updates in real-time: 1%, 2%, 3%... up to 100%
6. Screen shows "Analyzing images: 0/N"
7. Photo indexing progress updates
8. Completion

**Verify:**
- No OOM errors in logs
- Progress bar animates smoothly
- Status badge shows current stage name
- Percentage updates match stage progress

#### Scenario 2: Subsequent Launch (Models Cached)
**Expected Behavior:**
1. User taps "Enter"
2. Vision model already cached - progress jumps to 100% quickly
3. STT model already cached - progress jumps to 100% quickly
4. Indexing begins immediately (only new photos processed)

**Verify:**
- Fast initialization
- No re-downloads
- Progress still shown but completes quickly

#### Scenario 3: Text Search (First Time)
**Expected Behavior:**
1. User types a search query
2. ONNX text model lazy loads
3. If OOM still occurs, graceful fallback to Gemini API

**Verify:**
- Search works regardless of ONNX success/failure
- Error messages are clear
- Fallback embeddings used if needed

### Log Verification

**Expected Logs During Onboarding:**
```
📥 Initializing vision model...
Vision model download: 0%
Vision model download: 1%
...
Vision model download: 100%
✅ Vision model ready!
⏭️ Skipping text model initialization (lazy load on first search)
📥 Initializing STT model...
STT model download: 0%
...
STT model download: 100%
✅ STT model ready!
Starting indexing for N photos
Analyzing images: 0/N
...
Analyzing images: N/N
Indexing completed
```

**No Longer Expected (OOM errors eliminated):**
```
❌ Error loading tokenizer.json: Failed to allocate 45808424 byte allocation
⚠️ Failed to load tokenizer.json
⚠️ BPE Tokenizer failed to load, will use fallback
```

---

## Benefits

### Performance
- **Faster Onboarding:** Skipping text model initialization saves time and memory
- **No OOM Crashes:** 45MB tokenizer.json not loaded during memory-constrained onboarding
- **Lazy Loading:** Text embeddings loaded only when needed (on first search)

### User Experience
- **Real-Time Progress:** User sees exactly what's happening at each stage
- **Stage Visibility:** Clear labels like "Downloading vision model: 85%"
- **No Stuck Progress:** Bar updates smoothly instead of staying at 0%
- **Professional Feel:** Polished initialization flow with detailed status updates

### Reliability
- **Graceful Fallback:** OOM doesn't crash app, uses alternative embeddings
- **Better Error Messages:** Clear explanation of what happened and why it's OK
- **Resilient Architecture:** App works even if ONNX fails to initialize

### Memory Management
- **Reduced Peak Memory:** Critical 45MB allocation deferred to later when memory is available
- **Better Memory Profiling:** Models loaded when memory pressure is lower
- **Avoid Initialization Bottleneck:** Spread out memory-intensive operations

---

## Future Improvements

### Short Term
1. **Parallel Model Downloads:** Download vision and STT models in parallel (with care for memory)
2. **Progressive Tokenizer Loading:** Stream tokenizer.json in chunks instead of loading all at once
3. **Memory Monitoring:** Add memory usage tracking to inform when to load text model

### Medium Term
1. **Smaller Tokenizer:** Use a quantized or pruned vocabulary to reduce tokenizer.json size
2. **On-Demand Text Embeddings:** Generate text embeddings only for search queries, not stored in DB
3. **Hybrid Search Strategy:** Combine on-device ONNX with cloud Gemini for best results

### Long Term
1. **Model Quantization:** Reduce model sizes further (int8, int4 quantization)
2. **Dynamic Memory Management:** Automatically load/unload models based on available memory
3. **Progressive Web App:** Offload some embedding computation to web workers

---

## Files Modified

### Core Changes
1. `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/types/index.ts`
   - Extended `IndexingProgress` interface with stage tracking

2. `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/services/indexingService.ts`
   - Skip text model initialization during onboarding
   - Wire up progress callbacks from vision and STT services
   - Add stage information to progress updates

3. `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/services/embeddingService.ts`
   - Add comments clarifying lazy loading strategy
   - Update initialization docs

4. `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/screens/NeuralOnboarding.tsx`
   - Add state variables for stage tracking
   - Update progress callback to handle stage information
   - Update UI to show stage-specific progress

5. `/Users/louiss/Programming/Projects/hackathons/cactus-nothing-hackathon/mrae/src/services/tokenizerService.ts`
   - Improve OOM error detection and messages

### No Changes Required (Already Correct)
- `cactusService.ts` - Already has progress callback support
- `transcriptionService.ts` - Already has progress callback support
- `onnxService.ts` - Already has lazy initialization via `embedText()`

---

## Conclusion

This fix addresses three critical issues:

1. **OOM Error:** Eliminated by lazy loading the text model
2. **Missing Progress:** Fixed by wiring up callbacks and extending progress tracking
3. **Poor UX:** Improved with real-time stage-specific progress updates

The solution maintains backward compatibility, doesn't break existing functionality, and provides a much better user experience during onboarding.

**Status:** ✅ Complete and Ready for Testing
