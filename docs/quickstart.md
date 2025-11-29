## React Native Installation

```bash
npm install cactus-react-native react-native-nitro-modules
```

## Text Generation

```tsx
import { CactusLM } from 'cactus-react-native';

// Create model instance
const cactusLM = new CactusLM({ model: 'qwen3-0.6' });

// Download the model
await cactusLM.download();

// Initialize and complete
const result = await cactusLM.complete({
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(result.response);
```

## Learn from Examples

See complete working examples in the `/example` folder of the [Cactus React Native repo](https://github.com/cactus-compute/cactus-react-native):

```bash
git clone git@github.com:cactus-compute/cactus-react-native.git
cd cactus-react-native/example
yarn install

# android
yarn android

# iOS
bundle install
cd ios
bundle exec pod install
cd ..
yarn ios
```

### The example app shows:

- **Completion** – Text generation with streaming support
- **Vision** – Send images to the model
- **Tool Calling** – The model can call custom functions you define
- **RAG** – Load a folder of documents and let the model reference them.
- **Embedding** – Converts text into vector embeddings.
- **Model Management** – Browse available models
- **Multi-turn Chat** – Multi-turn conversations

## Documentation

Cactus Compute: https://www.cactuscompute.com/docs/react-native

GitHub Repo: https://github.com/cactus-compute/cactus-react-native

## Hackathon Tips

1. **Start with the example app** - Run it first to see everything working
2. **Use small models** - `qwen3-0.6` or `lfm2-350m`  for speed while prototyping
3. **Use the React Hook for automatic** - `useCactusLM` provides state management
4. **Offline-first** - Download models once, work offline
5. **Environment** - Set it up before the hackathon

## **Important Speech-to-Text Notice for London Venue**

When loading Whisper models, **do NOT use the `local-` prefix**.

Models with the `local-` prefix will **not work** in this environment. Only whisper models other ones will be fine.

✅ **Correct:** `whisper-small`

❌ **Incorrect:** `local-whisper-small`

Please load models **using only their production names**.