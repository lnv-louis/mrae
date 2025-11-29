import embeddingService from './embeddingService';
import storageService from '../utils/storage';
import { PhotoMetadata, SearchResult } from '../types';

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

class SearchService {
  /**
   * Search photos by text query using semantic similarity
   */
  async searchByText(query: string, limit: number = 20): Promise<SearchResult[]> {
    try {
      // Generate embedding for query
      const queryEmbeddingResult = await embeddingService.embedText(query);
      
      if (!queryEmbeddingResult.success || queryEmbeddingResult.embedding.length === 0) {
        console.error('Failed to generate query embedding');
        return [];
      }

      // Get all indexed photos
      const photos = await storageService.getAllPhotos();
      
      // Filter photos that have image embeddings
      const photosWithEmbeddings = photos.filter(
        (p) => p.imageEmbedding && p.imageEmbedding.length > 0
      );

      if (photosWithEmbeddings.length === 0) {
        return [];
      }

      // Calculate similarities
      const results: SearchResult[] = photosWithEmbeddings.map((photo) => {
        const similarity = cosineSimilarity(
          queryEmbeddingResult.embedding,
          photo.imageEmbedding!
        );
        return {
          photo,
          similarity,
        };
      });

      // Sort by similarity (descending)
      results.sort((a, b) => b.similarity - a.similarity);

      // Return top results
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching photos:', error);
      return [];
    }
  }

  /**
   * Search photos by image (find similar images)
   */
  async searchByImage(imagePath: string, limit: number = 20): Promise<SearchResult[]> {
    try {
      // Generate embedding for query image
      const queryEmbeddingResult = await embeddingService.embedImage(imagePath);
      
      if (!queryEmbeddingResult.success || queryEmbeddingResult.embedding.length === 0) {
        console.error('Failed to generate query image embedding');
        return [];
      }

      // Get all indexed photos
      const photos = await storageService.getAllPhotos();
      
      // Filter photos that have image embeddings
      const photosWithEmbeddings = photos.filter(
        (p) => p.imageEmbedding && p.imageEmbedding.length > 0 && p.uri !== imagePath
      );

      if (photosWithEmbeddings.length === 0) {
        return [];
      }

      // Calculate similarities
      const results: SearchResult[] = photosWithEmbeddings.map((photo) => {
        const similarity = cosineSimilarity(
          queryEmbeddingResult.embedding,
          photo.imageEmbedding!
        );
        return {
          photo,
          similarity,
        };
      });

      // Sort by similarity (descending)
      results.sort((a, b) => b.similarity - a.similarity);

      // Return top results
      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching photos by image:', error);
      return [];
    }
  }
}

export default new SearchService();
