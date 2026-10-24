/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#0f172a', soft: '#475569', faint: '#94a3b8' },
        brand: { 50: '#ecfeff', 100: '#cffafe', 500: '#0891b2', 600: '#0e7490', 700: '#155e75' },
      },
    },
  },
  plugins: [],
};
