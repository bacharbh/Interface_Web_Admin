export const tokens = {
  colors: {
    primary: {
      light: 'var(--color-primary-light)',
      DEFAULT: 'var(--color-primary)',
      dark: 'var(--color-primary-dark)',
    },
    surface: {
      light: 'var(--color-surface-light)',
      DEFAULT: 'var(--color-surface)',
      dark: 'var(--color-surface-dark)',
      accent: 'var(--color-surface-accent)',
    },
    alert: {
      high: 'var(--color-alert-high)',
      medium: 'var(--color-alert-medium)',
      low: 'var(--color-alert-low)',
    },
    battery: {
      full: 'var(--color-battery-full)',
      low: 'var(--color-battery-low)',
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.25rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  animation: {
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    slideIn: 'slide-in 0.5s ease-out forwards',
    countUp: 'count-up 2s ease-out forwards',
  },
  blur: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '24px',
  }
};
