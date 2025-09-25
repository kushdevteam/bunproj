/**
 * SolNox BNB Dark Theme System
 * Extracted from frontend.html and converted to TypeScript for React app
 */

export const theme = {
  colors: {
    // Background colors
    bgPrimary: '#0a0a0a',
    bgSecondary: '#1a1a1a',
    bgTertiary: '#2a2a2a',
    
    // Border colors
    border: '#333',
    
    // Text colors
    textPrimary: '#fff',
    textSecondary: '#888',
    
    // Accent colors
    accentGreen: '#00ff88',
    accentOrange: '#ff6b35',
    accentRed: '#ff4444',
    accentBlue: '#3b82f6',
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '30px',
  },
  
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '10px',
      sm: '12px',
      md: '14px',
      lg: '16px',
      xl: '18px',
      xxl: '20px',
      xxxl: '24px',
      heading: '36px',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  
  layout: {
    sidebarWidth: '280px',
    contentPadding: '30px',
    sidebarPadding: '20px',
  },
  
  animation: {
    transition: 'all 0.2s',
    pulse: 'pulse 2s infinite',
  },
} as const;

export type Theme = typeof theme;

// CSS Custom Properties for React
export const cssVariables = {
  '--bg-primary': theme.colors.bgPrimary,
  '--bg-secondary': theme.colors.bgSecondary,
  '--bg-tertiary': theme.colors.bgTertiary,
  '--border-color': theme.colors.border,
  '--text-primary': theme.colors.textPrimary,
  '--text-secondary': theme.colors.textSecondary,
  '--accent-green': theme.colors.accentGreen,
  '--accent-orange': theme.colors.accentOrange,
  '--accent-red': theme.colors.accentRed,
  '--accent-blue': theme.colors.accentBlue,
} as const;

// Utility function to apply theme variables
export const applyThemeVariables = (): void => {
  const root = document.documentElement;
  Object.entries(cssVariables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
};