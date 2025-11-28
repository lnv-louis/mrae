export interface PhotoMetadata {
  id: string;
  filePath: string;
  uri: string;
  caption?: string;
  tags?: string[];
  textEmbedding?: number[];
  imageEmbedding?: number[];
  createdAt: number;
  width?: number;
  height?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  success: boolean;
}

export interface IndexingProgress {
  total: number;
  processed: number;
  current?: string;
  error?: string;
}

export interface SearchResult {
  photo: PhotoMetadata;
  similarity: number;
}

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
  // For image generation responses
  images?: Array<{ image_url: { url: string } }>;
}

export interface OpenRouterCompletionRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  modalities?: string[]; // e.g. ["text", "image"]
}

export interface OpenRouterCompletionResponse {
  id: string;
  choices: Array<{
    message: OpenRouterMessage;
    finish_reason: string;
  }>;
  created: number;
  model: string;
}

