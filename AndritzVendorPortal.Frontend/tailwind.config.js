/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        andritz: {
          red:  '#c8102e',
          dark: '#1a1a2e',
        },
      },
    },
  },
  plugins: [],
}
