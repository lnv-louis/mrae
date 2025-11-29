import axios from 'axios';
import { PhotoMetadata } from '../types';

const BASE_URL = 'https://photoslibrary.googleapis.com/v1';

class GooglePhotosService {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  async listMediaItems(pageSize = 50, pageToken?: string): Promise<{ mediaItems: PhotoMetadata[]; nextPageToken?: string }> {
    if (!this.accessToken) throw new Error('No access token set');

    try {
      const response = await axios.get(`${BASE_URL}/mediaItems`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          pageSize,
          pageToken,
        },
      });

      const mediaItems = response.data.mediaItems || [];
      
      const photos: PhotoMetadata[] = mediaItems
        .filter((item: any) => item.mediaMetadata.photo) // Filter for photos only
        .map((item: any) => ({
          id: item.id,
          uri: `${item.baseUrl}=w${item.mediaMetadata.width}-h${item.mediaMetadata.height}`, // Construct high-res URL
          width: parseInt(item.mediaMetadata.width),
          height: parseInt(item.mediaMetadata.height),
          createdAt: new Date(item.mediaMetadata.creationTime).getTime(),
          source: 'google_photos', // Custom field to distinguish source
        }));

      return {
        mediaItems: photos,
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      console.error('Error fetching Google Photos:', error);
      throw error;
    }
  }
}

export default new GooglePhotosService();

