import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface StatBlockProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
  gradient?: boolean;
}

export const StatBlock: React.FC<StatBlockProps> = ({ 
  label, 
  value, 
  subtext, 
  icon, 
  style,
  gradient = false
}) => {
  const Content = () => (
    <View style={styles.content}>
      <View>
        <Text style={styles.label}>{label}</Text>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={styles.value}>{value}</Text>
      </View>
      {subtext && <Text style={styles.subtext}>{subtext}</Text>}
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, style]}
      >
        <Content />
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.container, styles.solid, style]}>
      <Content />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  solid: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  content: {
    padding: 20,
    flex: 1,
    justifyContent: 'space-between',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  iconContainer: {
    marginVertical: 8,
  },
});

