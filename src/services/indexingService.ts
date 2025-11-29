import embeddingService from './embeddingService';
import photoService from './photoService';
import storageService from '../utils/storage';
import databaseService from './databaseService';
import geoService from './geoService';
import * as MediaLibrary from 'expo-media-library';
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
      
      // Initialize STT model for voice search (download on first launch)
      const transcriptionService = (await import('./transcriptionService')).default;
      if (transcriptionService.available()) {
        try {
          await transcriptionService.initialize('whisper-small');
        } catch (error) {
          console.warn('⚠️ STT model initialization failed, will retry when needed');
        }
      }

      // Prepare database schema
      await databaseService.initImageIndex();

      // Get all photos
      const photos = await photoService.getAllPhotos();
      const total = photos.length;

      console.log(`Starting indexing for ${total} photos`);

      const progress: IndexingProgress = {
        total,
        processed: 0,
      };

      // Already indexed IDs (DB)
      const existingDbIds = new Set(await databaseService.getImageIndexIds());
      // Already indexed (AsyncStorage) for backwards compatibility
      const indexedPhotos = await storageService.getAllPhotos();
      const indexedIds = new Set(indexedPhotos.map((p) => p.id));

      // Transactional write for performance
      await databaseService.beginTransaction();
      try {
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
        if (existingDbIds.has(photo.id) || indexedIds.has(photo.id)) {
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

          // Location & timestamp via MediaLibrary
          let latitude: number | null = null;
          let longitude: number | null = null;
          try {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(photo.id);
            const loc: any = (assetInfo as any)?.location;
            latitude = typeof loc?.latitude === 'number' ? loc.latitude : null;
            longitude = typeof loc?.longitude === 'number' ? loc.longitude : null;
          } catch {}
          const timestamp = photo.createdAt;
          let city: string | null = null;
          if (latitude !== null && longitude !== null) {
            city = await geoService.reverseGeocodeToCity(latitude, longitude);
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

          // Save to SQL (embedding as Float32 -> Uint8Array)
          const float32 = new Float32Array(imageEmbeddingResult.embedding);
          const bytes = new Uint8Array(float32.buffer);
          await databaseService.insertImageIndex({
            id: photo.id,
            uri: photo.uri,
            embedding: bytes,
            latitude,
            longitude,
            city,
            timestamp,
          });

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
        await databaseService.commitTransaction();
      } catch (e) {
        await databaseService.rollbackTransaction();
        throw e;
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

  async ensureUpToDate(): Promise<void> {
    if (this.isIndexing) return;
    try {
      await databaseService.initImageIndex();
      const photos = await photoService.getAllPhotos();
      const dbIds = new Set(await databaseService.getImageIndexIds());
      const missingCount = photos.filter((p) => !dbIds.has(p.id)).length;
      const lastIndexed = await storageService.getLastIndexed();
      if (!lastIndexed || missingCount > 0) {
        await this.startIndexing();
      }
    } catch (e) {
      // swallow errors to avoid blocking app launch
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
