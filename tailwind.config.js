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
          300: '#ffd37a',
          400: '#f5b838',
          500: '#f3aa18',
          600: '#d9940c',
        },
        dark: {
          800: '#18181d',
          850: '#141417',
          900: '#101014',
          950: '#08080a',
        },
        primary: {
          DEFAULT: '#f3aa18',
          hover: '#f5b838',
          dark: '#d9940c',
          foreground: '#080808',
        },
      },
      fontFamily: {
        heading: ['"Chakra Petch"', 'sans-serif'],
        chakra: ['"Chakra Petch"', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        bebas: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 18px 50px -24px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
}
