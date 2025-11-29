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
      // Initialize vision model with progress tracking
      console.log('📥 Initializing vision model...');
      if (this.onProgressCallback) {
        this.onProgressCallback({
          total: 0,
          processed: 0,
          stage: 'vision_model',
          stageProgress: 0,
          stageName: 'Downloading vision model',
        });
      }

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

      // Skip text model initialization to avoid OOM - it will be lazily loaded on first text search
      console.log('⏭️ Skipping text model initialization (lazy load on first search)');

      // Initialize STT model for voice search with progress tracking
      const transcriptionService = (await import('./transcriptionService')).default;
      if (transcriptionService.available()) {
        try {
          console.log('📥 Initializing STT model...');
          if (this.onProgressCallback) {
            this.onProgressCallback({
              total: 0,
              processed: 0,
              stage: 'stt_model',
              stageProgress: 0,
              stageName: 'Downloading speech model',
            });
          }

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
        stage: 'indexing',
        stageProgress: 0,
        stageName: 'Analyzing images',
      };

      // Already indexed IDs (DB)
      const existingDbIds = new Set(await databaseService.getImageIndexIds());
      // Already indexed (AsyncStorage) for backwards compatibility
      const indexedPhotos = await storageService.getAllPhotos();
      const indexedIds = new Set(indexedPhotos.map((p) => p.id));

      // Filter out already indexed photos BEFORE processing
      const photosToProcess = photos.filter((photo) => {
        // Skip if already in database
        if (existingDbIds.has(photo.id)) {
          console.log(`✓ Already indexed in DB: ${photo.id}`);
          return false;
        }
        // Skip if already in AsyncStorage with valid embedding
        if (indexedIds.has(photo.id)) {
          const existing = indexedPhotos.find((p) => p.id === photo.id);
          if (existing?.imageEmbedding && existing.imageEmbedding.length > 0) {
            console.log(`✓ Already indexed in storage: ${photo.id}`);
            return false;
          }
        }
        return true;
      });

      console.log(`📊 Total photos: ${total}, Already indexed: ${total - photosToProcess.length}, To process: ${photosToProcess.length}`);

      // Process photos in batches with separate transactions (avoid long-running locks)
      const BATCH_SIZE = 10;
      let processedCount = 0;

      for (let batchStart = 0; batchStart < photosToProcess.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, photosToProcess.length);
        const batch = photosToProcess.slice(batchStart, batchEnd);

        console.log(`📦 Processing batch ${batchStart / BATCH_SIZE + 1}: photos ${batchStart + 1}-${batchEnd}/${photosToProcess.length}`);

        // Start transaction for this batch
        await databaseService.beginTransaction();
        try {
          for (const photo of batch) {
          if (this.shouldStop) {
            console.log('Indexing stopped by user');
            await databaseService.rollbackTransaction();
            return;
          }

          const photoIndex = photos.findIndex(p => p.id === photo.id);
          progress.current = photo.uri;
          progress.processed = photoIndex;
          progress.stage = 'indexing';
          progress.stageProgress = total > 0 ? photoIndex / total : 0;
          progress.stageName = `Analyzing images: ${processedCount + 1}/${photosToProcess.length}`;

          // Double-check not already indexed (race condition prevention)
          if (existingDbIds.has(photo.id)) {
            console.log(`⏭️ Skipping (already indexed): ${photo.id}`);
            processedCount++;
            continue;
          }

          try {
            // Generate image embedding
            console.log(`Processing photo ${processedCount + 1}/${photosToProcess.length}: ${photo.id}`);
            const imageEmbeddingResult = await embeddingService.embedImage(photo.uri);

            if (!imageEmbeddingResult.success || imageEmbeddingResult.embedding.length === 0) {
              console.warn(`Failed to generate embedding for ${photo.id}`);
              processedCount++;
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

            // Mark as indexed to prevent re-processing
            existingDbIds.add(photo.id);

            processedCount++;

            // Update progress
            if (this.onProgressCallback) {
              this.onProgressCallback(progress);
            }

            await storageService.saveIndexingProgress({
              total: progress.total,
              processed: processedCount,
            });
          } catch (error) {
            console.error(`Error processing photo ${photo.id}:`, error);
            progress.error = `Error processing ${photo.id}: ${error}`;
            if (this.onProgressCallback) {
              this.onProgressCallback(progress);
            }
          }
          }

          // Commit this batch
          await databaseService.commitTransaction();
          console.log(`✅ Batch committed: ${batch.length} photos`);
        } catch (e) {
          console.error(`❌ Batch failed, rolling back:`, e);
          await databaseService.rollbackTransaction();
          // Continue with next batch instead of throwing
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
