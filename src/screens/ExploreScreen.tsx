import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import PhotoGrid from '../components/PhotoGrid';
import querySearchService from '../services/querySearchService';
import speechQueryService from '../services/speechQueryService';
import { PhotoMetadata } from '../types';
import ScreenLayout from '../components/ScreenLayout';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [resultsPhotos, setResultsPhotos] = useState<PhotoMetadata[]>([]);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      setHasSearched(true);
      const res = await querySearchService.searchByExpandedText(query.trim());
      const photos = res.results.map((r) => ({ id: r.id, uri: r.uri, createdAt: r.timestamp } as PhotoMetadata));
      setResultsPhotos(photos);
      setPhrases(res.phrases);
      setMessage(res.message);
      setTranscript('');
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search photos');
    } finally {
      setSearching(false);
    }
  };

  const handleAudioSearch = async () => {
    try {
      setSearching(true);
      setHasSearched(true);
      const res = await speechQueryService.searchByAudio('mock://audio');
      const photos = res.results.map((r) => ({ id: r.id, uri: r.uri, createdAt: r.timestamp } as PhotoMetadata));
      setResultsPhotos(photos);
      setPhrases(res.phrases);
      setTranscript(res.transcript);
      setMessage(res.message);
    } catch (error) {
      console.error('Error audio searching:', error);
      Alert.alert('Error', 'Failed to search by audio');
    } finally {
      setSearching(false);
    }
  };

  const handlePhotoPress = (photo: any) => {
    // TODO: Implement photo detail view
    console.log('Photo pressed:', photo.id);
  };

  return (
    <ScreenLayout>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Text style={styles.headerSubtitle}>Semantic Photo Finding</Text>
      </View>

      <View style={styles.searchWrapper}>
        <BlurView intensity={30} tint="light" style={styles.searchBlur}>
          <TextInput
            style={styles.input}
            placeholder="Search moods, contexts..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchButton, styles.audioButton]}
            onPress={handleAudioSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Audio</Text>
            )}
          </TouchableOpacity>
        </BlurView>
      </View>

      {searching && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!searching && hasSearched && resultsPhotos.length === 0 && (
        <View style={styles.center}>
          <BlurView intensity={20} style={styles.glassCard}>
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try a different search query or index your photos first
            </Text>
            {!!message && (
              <Text style={[styles.emptySubtext, { marginTop: 6 }]}>{message}</Text>
            )}
          </BlurView>
        </View>
      )}

      {!searching && resultsPhotos.length > 0 && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Search Results</Text>
            <Text style={styles.count}>{resultsPhotos.length} photos found</Text>
            {phrases.length > 0 && (
              <View style={styles.phrasesRow}>
                {phrases.map((p) => (
                  <View key={p} style={styles.phraseChip}>
                    <Text style={styles.phraseText}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!transcript && (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptText}>{transcript}</Text>
              </View>
            )}
            {!!message && (
              <Text style={styles.messageText}>{message}</Text>
            )}
          </View>
          <PhotoGrid
            photos={resultsPhotos}
            onPhotoPress={handlePhotoPress}
          />
        </ScrollView>
      )}

      {!hasSearched && !searching && (
        <View style={styles.center}>
          <BlurView intensity={20} style={styles.glassCard}>
            <Text style={styles.placeholderText}>
              Find photos by mood & context
            </Text>
            <Text style={styles.placeholderSubtext}>
              Example: "sunset with people", "dog playing", "food"
            </Text>
          </BlurView>
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBlur: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 10,
  },
  searchButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  glassCard: {
    padding: 30,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#fff',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  resultsHeader: {
    padding: 20,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  count: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  phrasesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  phraseChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  phraseText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  transcriptBox: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 10,
  },
  transcriptText: {
    color: '#fff',
    fontSize: 13,
  },
  messageText: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  audioButton: {
    marginLeft: 8,
  },
});
