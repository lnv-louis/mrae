import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface GallerySheetProps {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export const GallerySheet: React.FC<GallerySheetProps> = ({ 
  children, 
  title, 
  action,
  style 
}) => {
  return (
    <View style={[styles.container, style]}>
      {(title || action) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {action}
        </View>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    paddingHorizontal: 24,
    marginTop: 24,
    minHeight: 500, // Ensure it takes up space
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
});

