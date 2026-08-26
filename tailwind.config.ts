import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bauhaus: {
          black:  '#121212',
          blue:   '#1040C0',
          red:    '#D02020',
          yellow: '#F0C020',
          bg:     '#F0F0F0',
        },
      },
      fontFamily: {
        outfit: ['var(--font-outfit)', 'sans-serif'],
      },
      boxShadow: {
        bauhaus: '6px 6px 0 #121212',
        'bauhaus-sm': '3px 3px 0 #121212',
        'bauhaus-lg': '8px 8px 0 #121212',
      },
    },
  },
  plugins: [],
}

export default config
