export const colors = {
  // Warm Light Palette
  background: {
    primary: '#FFF8F3',      // Warm off-white
    secondary: '#FFF4ED',    // Lighter warm
    tertiary: '#FFEDE3',     // Peachy light
  },
  // Warm Accent Colors
  warm: {
    primary: '#FF8A65',      // Warm coral
    secondary: '#FFAB91',    // Light coral
    tertiary: '#FFCCBC',     // Pale coral
    accent: '#FF6E40',       // Vibrant warm orange
  },
  // Text Colors (warm tones)
  text: {
    primary: '#5D4037',      // Warm dark brown
    secondary: '#8D6E63',    // Medium brown
    tertiary: '#A1887F',     // Light brown
    subtle: '#BCAAA4',       // Very light brown
  },
  // Neutral Scale (warm-tinted)
  neutral: {
    white: '#FFFFFF',
    black: '#3E2723',        // Warm black (dark brown)
    gray100: '#FFF8F5',
    gray200: '#F5EBE7',
    gray300: '#E8DAD4',
    gray400: '#D7C4BC',
    gray500: '#BCAAA4',
    gray600: '#A1887F',
    gray700: '#8D6E63',
    gray800: '#6D4C41',
    gray900: '#5D4037',
  },
  // Semantic Colors (warm-tinted)
  semantic: {
    success: '#66BB6A',
    error: '#EF5350',
    warning: '#FFA726',
    info: '#42A5F5',
  },
  // Legacy sunset for compatibility
  sunset: {
    dark: '#5D4037',
    medium: '#FF8A65',
    light: '#FFF8F3',
    accent: '#FF6E40',
  },
  // Glassmorphism (warm-tinted)
  glass: {
    light: 'rgba(255, 138, 101, 0.1)',
    heavy: 'rgba(255, 138, 101, 0.05)',
    border: 'rgba(255, 138, 101, 0.2)',
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
