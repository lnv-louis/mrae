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
import searchService from '../services/searchService';
import { SearchResult } from '../types';
import ScreenLayout from '../components/ScreenLayout';

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
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
      const searchResults = await searchService.searchByText(query.trim());
      setResults(searchResults);
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search photos');
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
        </BlurView>
      </View>

      {searching && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <View style={styles.center}>
          <BlurView intensity={20} style={styles.glassCard}>
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try a different search query or index your photos first
            </Text>
          </BlurView>
        </View>
      )}

      {!searching && results.length > 0 && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Search Results</Text>
            <Text style={styles.count}>{results.length} photos found</Text>
          </View>
          <PhotoGrid
            photos={results.map((r) => r.photo)}
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
});
