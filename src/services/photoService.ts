import * as MediaLibrary from 'expo-media-library';
import { PhotoMetadata } from '../types';

class PhotoService {
  private permissionGranted = false;

  /**
   * Request media library permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Check if permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Get all photos from device
   */
  async getAllPhotos(): Promise<PhotoMetadata[]> {
    if (!this.permissionGranted) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Media library permissions not granted');
      }
    }

    try {
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: 1000, // Limit for initial load, can be paginated later
        sortBy: MediaLibrary.SortBy.creationTime,
      });

      return assets.assets.map((asset) => ({
        id: asset.id,
        filePath: asset.uri,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        createdAt: asset.creationTime,
      }));
    } catch (error) {
      console.error('Error fetching photos:', error);
      throw error;
    }
  }

  /**
   * Get photos with pagination
   */
  async getPhotos(limit: number = 50, after?: string): Promise<{
    photos: PhotoMetadata[];
    hasNextPage: boolean;
    endCursor?: string;
  }> {
    if (!this.permissionGranted) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Media library permissions not granted');
      }
    }

    try {
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: limit,
        after,
        sortBy: MediaLibrary.SortBy.creationTime,
      });

      const photos: PhotoMetadata[] = assets.assets.map((asset) => ({
        id: asset.id,
        filePath: asset.uri,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        createdAt: asset.creationTime,
      }));

      return {
        photos,
        hasNextPage: assets.hasNextPage,
        endCursor: assets.endCursor,
      };
    } catch (error) {
      console.error('Error fetching photos:', error);
      throw error;
    }
  }

  /**
   * Get photo by ID
   */
  async getPhotoById(id: string): Promise<PhotoMetadata | null> {
    try {
      const asset = await MediaLibrary.getAssetInfoAsync(id);
      return {
        id: asset.id,
        filePath: asset.uri,
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        createdAt: asset.creationTime,
      };
    } catch (error) {
      console.error('Error fetching photo:', error);
      return null;
    }
  }
}

export default new PhotoService();

