import React, { useState, useEffect } from 'react';
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
import PhotoGrid from '../components/PhotoGrid';
import searchService from '../services/searchService';
import { SearchResult } from '../types';

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
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Search photos by description..."
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
      </View>

      {searching && (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>
            Try a different search query or index your photos first
          </Text>
        </View>
      )}

      {!searching && results.length > 0 && (
        <ScrollView style={styles.resultsContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Search Results</Text>
            <Text style={styles.count}>{results.length} photos found</Text>
          </View>
          <PhotoGrid
            photos={results.map((r) => r.photo)}
            onPhotoPress={handlePhotoPress}
          />
        </ScrollView>
      )}

      {!hasSearched && (
        <View style={styles.center}>
          <Text style={styles.placeholderText}>
            Enter a search query to find photos semantically
          </Text>
          <Text style={styles.placeholderSubtext}>
            Example: "sunset with people", "dog playing", "food"
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  count: {
    fontSize: 14,
    color: '#666',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

