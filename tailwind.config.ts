import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF6EF',
        'cream-card': '#FFFCF6',
        ink: {
          DEFAULT: '#2A1F17',
          soft: '#5A4A3A',
          muted: '#6B5D52',
          tertiary: '#8C7E72',
        },
        terracotta: {
          DEFAULT: '#B8543A',
          soft: '#C9764C',
          dark: '#8B3E2A',
        },
        gold: {
          DEFAULT: '#D4A04C',
          soft: '#FFF8E8',
        },
        sage: '#7A9F4F',
      },
      borderColor: {
        DEFAULT: 'rgba(42, 31, 23, 0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        editorial: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
