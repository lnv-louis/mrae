import photoService from './photoService';
import googlePhotosService from './googlePhotosService';
import { PhotoMetadata } from '../types';

class IntelligentSyncService {
  async getUnifiedPhotos(limit = 50, googlePageToken?: string): Promise<{ photos: PhotoMetadata[]; nextGooglePageToken?: string }> {
    
    // 1. Fetch Local Photos
    let localPhotos: PhotoMetadata[] = [];
    try {
      const localData = await photoService.getPhotos(limit);
      localPhotos = localData.photos.map(p => ({ ...p, source: 'local' as const }));
    } catch (error) {
      console.warn('Failed to fetch local photos', error);
    }

    // 2. Fetch Google Photos (if token exists)
    let googlePhotos: PhotoMetadata[] = [];
    let nextToken: string | undefined;
    try {
        // Assuming token is set elsewhere or handled by the service internal state for now
        // In a real app, we'd check auth state here.
       const googleData = await googlePhotosService.listMediaItems(limit, googlePageToken);
       googlePhotos = googleData.mediaItems;
       nextToken = googleData.nextPageToken;
    } catch (error) {
        // Silent fail if not auth'd or error
        console.log('Google Photos fetch skipped or failed');
    }

    // 3. Merge and Sort
    const unified = [...localPhotos, ...googlePhotos].sort((a, b) => b.createdAt - a.createdAt);

    return {
      photos: unified,
      nextGooglePageToken: nextToken,
    };
  }
}

export default new IntelligentSyncService();

