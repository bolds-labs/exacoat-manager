/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          amber: '#f3aa18',
          'amber-hover': '#ffc119',
          'amber-muted': 'rgba(243, 170, 24, 0.15)',
          black: '#000000',
          dark: '#08080a',
          surface: '#0d0d11',
          'surface-hover': '#15151b',
          card: '#111116',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-focus': 'rgba(243, 170, 24, 0.5)',
        },
      },
      fontFamily: {
        chakra: ['"Chakra Petch"', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
