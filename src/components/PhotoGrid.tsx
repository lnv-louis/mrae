import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { PhotoMetadata } from '../types';

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const SPACING = 2;
const ITEM_SIZE = (width - SPACING * (COLUMNS + 1)) / COLUMNS;

interface PhotoGridProps {
  photos: PhotoMetadata[];
  onPhotoPress?: (photo: PhotoMetadata) => void;
}

export default function PhotoGrid({ photos, onPhotoPress }: PhotoGridProps) {
  return (
    <View style={styles.container}>
      {photos.map((photo) => (
        <TouchableOpacity
          key={photo.id}
          style={styles.item}
          onPress={() => onPhotoPress?.(photo)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING,
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: SPACING / 2,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
});

