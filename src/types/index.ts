export interface PhotoMetadata {
  id: string;
  filePath?: string; // Optional because cloud photos don't have a local path initially
  uri: string;
  caption?: string;
  tags?: string[];
  textEmbedding?: number[];
  imageEmbedding?: number[];
  createdAt: number;
  width?: number;
  height?: number;
  source?: 'local' | 'google_photos';
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
  stage?: 'vision_model' | 'stt_model' | 'indexing';
  stageProgress?: number; // 0.0 to 1.0 for current stage
  stageName?: string; // Human-readable stage name
}

export interface SearchResult {
  photo: PhotoMetadata;
  similarity: number;
}

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiGenerateResponse {
  candidates?: Array<{ content: { parts: GeminiPart[] } }>;
}

export interface GeminiEmbeddingResponse {
  embedding?: { values: number[] };
}
