export const colors = {
  // Sunset Gradient Palette
  sunset: {
    dark: '#2E1A24',
    medium: '#E06C55',
    light: '#FDFBF7',
    accent: '#FF6B4A',
  },
  // Neutral Scale (for typography and backgrounds)
  neutral: {
    white: '#FFFFFF',
    black: '#1C1C1E',
    gray100: '#F5F5F7',
    gray200: '#E5E5EA',
    gray300: '#D1D1D6',
    gray400: '#C7C7CC',
    gray500: '#AEAEB2',
    gray600: '#8E8E93',
    gray700: '#636366',
    gray800: '#48484A',
    gray900: '#3A3A3C',
  },
  // Semantic Colors
  semantic: {
    success: '#4CD964',
    error: '#FF3B30',
    warning: '#FFCC00',
    info: '#5856D6',
  },
  // Glassmorphism
  glass: {
    light: 'rgba(255, 255, 255, 0.2)',
    heavy: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.3)',
  },
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
  header: 60, // Height for headers
  bottomTab: 85, // Height for bottom tab bar
} as const;

export const typography = {
  header: {
    xl: {
      fontSize: 34,
      fontWeight: '700' as const,
      lineHeight: 41,
      letterSpacing: -0.5,
    },
    l: {
      fontSize: 28,
      fontWeight: '600' as const,
      lineHeight: 34,
      letterSpacing: -0.5,
    },
    m: {
      fontSize: 22,
      fontWeight: '600' as const,
      lineHeight: 28,
      letterSpacing: -0.4,
    },
  },
  body: {
    l: {
      fontSize: 17,
      fontWeight: '400' as const,
      lineHeight: 22,
    },
    m: {
      fontSize: 15,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    s: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 13,
  },
} as const;

export const radius = {
  s: 8,
  m: 12,
  l: 20,
  xl: 24,
  round: 9999,
} as const;

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const layout = {
  gutter: 24,
} as const;

// Re-export haptics from here to make imports cleaner
export { haptics } from './utils/haptics';
