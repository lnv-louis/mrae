# Transcription Testing Checklist

## Pre-Testing Setup

1. Rebuild the app to include changes:
   ```bash
   # iOS
   cd ios && pod install && cd ..
   npx expo run:ios

   # Android
   npx expo run:android
   ```

2. Check package.json has correct version:
   - cactus-react-native: ^1.2.0 ✓

## Test Scenarios

### Test 1: First-Time Model Download
**Goal**: Verify model downloads and initializes correctly

Steps:
1. Fresh install (delete app if needed)
2. Open app
3. Navigate to Explore screen
4. Tap microphone button
5. Watch console logs

Expected Console Output:
```
Creating Cactus STT model: whisper-small
Downloading STT model...
STT model download: 10%
STT model download: 25%
...
STT model download: 100%
✅ STT model downloaded
Initializing STT model...
✅ STT model ready!
```

Pass Criteria:
- [ ] Download progress shows
- [ ] No errors during download
- [ ] Model initializes successfully
- [ ] Recording starts after init

### Test 2: Recording Format
**Goal**: Verify WAV format is used

Steps:
1. Start recording
2. Speak for 3-5 seconds
3. Stop recording
4. Check console logs

Expected Console Output:
```
🎤 Transcribing: recording-[uuid].wav
   Language: en, Model ready: true
```

Pass Criteria:
- [ ] File extension is .wav (not .m4a)
- [ ] Model ready: true

### Test 3: Basic Transcription
**Goal**: Verify transcription works with clear speech

Test Cases:
```
Input: "Find photos of sunset"
Expected: Similar text with good accuracy

Input: "Show me pictures from last summer"
Expected: Similar text with good accuracy

Input: "Beach vacation memories"
Expected: Similar text with good accuracy
```

Steps for each:
1. Tap microphone
2. Speak clearly
3. Tap stop
4. Wait for transcription

Expected Console Output:
```
✅ Transcribed (45 tokens, 12 tok/s): "find photos of sunset"
```

Pass Criteria:
- [ ] Transcription appears in search box
- [ ] Text is accurate (80%+ word accuracy)
- [ ] Response time under 5 seconds
- [ ] Search executes with transcribed text

### Test 4: Short Audio Handling
**Goal**: Verify behavior with very short audio

Steps:
1. Tap microphone
2. Immediately tap stop (under 0.5 seconds)

Expected Behavior:
- Error message: "Could not transcribe audio" or "audio too short"

Pass Criteria:
- [ ] Doesn't crash
- [ ] Shows user-friendly error

### Test 5: Subsequent Uses (Cached Model)
**Goal**: Verify faster performance after first use

Steps:
1. Complete Test 3 successfully
2. Immediately do another voice search
3. Record and transcribe

Expected:
- No download step
- Faster initialization (if needed)
- Immediate recording start

Pass Criteria:
- [ ] No download messages
- [ ] Recording starts instantly
- [ ] Transcription still works

### Test 6: Error Messages
**Goal**: Verify helpful error messages

Test 6a: Permissions Denied
1. Deny microphone permission
2. Tap microphone button

Expected:
```
Alert: "Permission Required - Please allow microphone access to use voice search"
```

Test 6b: Model Not Downloaded
1. Interrupt download (put app in background)
2. Try to transcribe

Expected:
```
Error: "STT model initialization failed..."
```

Pass Criteria:
- [ ] Clear, actionable error messages
- [ ] No technical jargon in user-facing errors

## Performance Benchmarks

### Acceptable Performance
- Model download: 30-90 seconds (depends on network)
- First transcription: 2-5 seconds
- Subsequent transcriptions: 1-3 seconds
- Tokens per second: 5-15 tok/s

### Red Flags
- Download takes over 2 minutes
- Transcription takes over 10 seconds
- App crashes during transcription
- Empty/gibberish transcription results

## Common Issues & Solutions

### Issue: "Cactus transcription failed"
Check:
1. Audio file actually created? Check file path in logs
2. Model properly initialized? Check ready status
3. WAV format being used? Check file extension

### Issue: Transcription is gibberish
Possible causes:
1. Audio quality too low
2. Background noise too high
3. Recording time too short

Try:
- Record in quiet environment
- Speak clearly and closer to mic
- Record for at least 2 seconds

### Issue: "Model not initialized"
Solution:
1. Restart app
2. Ensure stable internet for download
3. Check device storage (need 200+ MB)

## Console Log Patterns

### Successful Flow
```
Creating Cactus STT model: whisper-small
Downloading STT model...
STT model download: 100%
✅ STT model downloaded
Initializing STT model...
✅ STT model ready!
🎤 Transcribing: recording-abc123.wav
   Language: en, Model ready: true
✅ Transcribed (42 tokens, 11 tok/s): "show me photos from last year"
Generating embeddings...
Searching photos...
```

### Error Pattern Example
```
Creating Cactus STT model: whisper-small
Downloading STT model...
❌ Failed to initialize STT model: { error: "Network error", model: "whisper-small" }
```

## Final Verification

Before marking as complete:
- [ ] Can record audio successfully
- [ ] Audio files are .wav format
- [ ] Transcription returns accurate text
- [ ] Transcribed text triggers photo search
- [ ] Search results appear
- [ ] No crashes or freezes
- [ ] Error messages are helpful

## Device-Specific Notes

### iOS
- Check Info.plist has microphone permission
- WAV recording uses LINEARPCM format
- Test on both simulator and device

### Android
- Check AndroidManifest.xml has RECORD_AUDIO permission
- Test on different Android versions if possible
- Check storage permissions for model download
