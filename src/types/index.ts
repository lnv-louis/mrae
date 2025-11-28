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

