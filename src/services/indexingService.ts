import embeddingService from './embeddingService';
import photoService from './photoService';
import storageService from '../utils/storage';
import { PhotoMetadata, IndexingProgress } from '../types';

class IndexingService {
  private isIndexing = false;
  private shouldStop = false;
  private onProgressCallback?: (progress: IndexingProgress) => void;

  /**
   * Start indexing photos
   */
  async startIndexing(
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<void> {
    if (this.isIndexing) {
      console.log('Indexing already in progress');
      return;
    }

    this.isIndexing = true;
    this.shouldStop = false;
    this.onProgressCallback = onProgress;

    try {
      // Initialize models
      await embeddingService.initializeImageModel();
      await embeddingService.initializeTextModel();

      // Get all photos
      const photos = await photoService.getAllPhotos();
      const total = photos.length;

      console.log(`Starting indexing for ${total} photos`);

      const progress: IndexingProgress = {
        total,
        processed: 0,
      };

      // Get already indexed photos
      const indexedPhotos = await storageService.getAllPhotos();
      const indexedIds = new Set(indexedPhotos.map((p) => p.id));

      // Process photos
      for (let i = 0; i < photos.length; i++) {
        if (this.shouldStop) {
          console.log('Indexing stopped by user');
          break;
        }

        const photo = photos[i];
        progress.current = photo.uri;
        progress.processed = i;

        // Skip if already indexed
        if (indexedIds.has(photo.id)) {
          const existing = indexedPhotos.find((p) => p.id === photo.id);
          if (existing?.imageEmbedding && existing.imageEmbedding.length > 0) {
            console.log(`Skipping already indexed: ${photo.id}`);
            if (this.onProgressCallback) {
              this.onProgressCallback(progress);
            }
            continue;
          }
        }

        try {
          // Generate image embedding
          console.log(`Processing photo ${i + 1}/${total}: ${photo.id}`);
          const imageEmbeddingResult = await embeddingService.embedImage(photo.uri);

          if (!imageEmbeddingResult.success || imageEmbeddingResult.embedding.length === 0) {
            console.warn(`Failed to generate embedding for ${photo.id}`);
            continue;
          }

          // Generate caption (optional, can be slow)
          // const caption = await embeddingService.generateCaption(photo.uri);

          const metadata: PhotoMetadata = {
            ...photo,
            imageEmbedding: imageEmbeddingResult.embedding,
            // caption,
          };

          // Save to storage
          await storageService.savePhotoMetadata(metadata);

          // Update progress
          if (this.onProgressCallback) {
            this.onProgressCallback(progress);
          }

          await storageService.saveIndexingProgress({
            total: progress.total,
            processed: progress.processed,
          });
        } catch (error) {
          console.error(`Error processing photo ${photo.id}:`, error);
          progress.error = `Error processing ${photo.id}: ${error}`;
          if (this.onProgressCallback) {
            this.onProgressCallback(progress);
          }
        }
      }

      progress.processed = total;
      progress.current = undefined;
      if (this.onProgressCallback) {
        this.onProgressCallback(progress);
      }

      await storageService.saveLastIndexed(Date.now());
      console.log('Indexing completed');
    } catch (error) {
      console.error('Error during indexing:', error);
      throw error;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Stop indexing
   */
  stopIndexing(): void {
    this.shouldStop = true;
  }

  /**
   * Check if indexing is in progress
   */
  isIndexingInProgress(): boolean {
    return this.isIndexing;
  }

  /**
   * Get indexing status
   */
  async getIndexingStatus(): Promise<{
    isIndexing: boolean;
    progress: IndexingProgress | null;
    lastIndexed: number | null;
  }> {
    const progress = await storageService.getIndexingProgress();
    const lastIndexed = await storageService.getLastIndexed();

    return {
      isIndexing: this.isIndexing,
      progress,
      lastIndexed,
    };
  }
}

export default new IndexingService();

