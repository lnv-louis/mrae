import AsyncStorage from '@react-native-async-storage/async-storage';
import { PhotoMetadata } from '../types';

const STORAGE_KEYS = {
  PHOTOS: 'mrae_photos',
  INDEXING_PROGRESS: 'mrae_indexing_progress',
  LAST_INDEXED: 'mrae_last_indexed',
};

class StorageService {
  /**
   * Save photo metadata with embeddings
   */
  async savePhotoMetadata(photo: PhotoMetadata): Promise<void> {
    try {
      const allPhotos = await this.getAllPhotos();
      const existingIndex = allPhotos.findIndex((p) => p.id === photo.id);
      
      if (existingIndex >= 0) {
        allPhotos[existingIndex] = photo;
      } else {
        allPhotos.push(photo);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.PHOTOS, JSON.stringify(allPhotos));
    } catch (error) {
      console.error('Error saving photo metadata:', error);
      throw error;
    }
  }

  /**
   * Get all stored photo metadata
   */
  async getAllPhotos(): Promise<PhotoMetadata[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PHOTOS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting photos:', error);
      return [];
    }
  }

  /**
   * Get photo metadata by ID
   */
  async getPhotoById(id: string): Promise<PhotoMetadata | null> {
    try {
      const allPhotos = await this.getAllPhotos();
      return allPhotos.find((p) => p.id === id) || null;
    } catch (error) {
      console.error('Error getting photo:', error);
      return null;
    }
  }

  /**
   * Save indexing progress
   */
  async saveIndexingProgress(progress: {
    total: number;
    processed: number;
    current?: string;
  }): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.INDEXING_PROGRESS,
        JSON.stringify(progress)
      );
    } catch (error) {
      console.error('Error saving indexing progress:', error);
    }
  }

  /**
   * Get indexing progress
   */
  async getIndexingProgress(): Promise<{
    total: number;
    processed: number;
    current?: string;
  } | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.INDEXING_PROGRESS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting indexing progress:', error);
      return null;
    }
  }

  /**
   * Save last indexed timestamp
   */
  async saveLastIndexed(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_INDEXED,
        timestamp.toString()
      );
    } catch (error) {
      console.error('Error saving last indexed:', error);
    }
  }

  /**
   * Get last indexed timestamp
   */
  async getLastIndexed(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_INDEXED);
      return data ? parseInt(data, 10) : null;
    } catch (error) {
      console.error('Error getting last indexed:', error);
      return null;
    }
  }

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PHOTOS,
        STORAGE_KEYS.INDEXING_PROGRESS,
        STORAGE_KEYS.LAST_INDEXED,
      ]);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export default new StorageService();

