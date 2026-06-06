/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F3A',
          light: '#12294E',
        },
        teal: {
          DEFAULT: '#0D9E8C',
          light: '#E6FBF8',
          dark: '#0b8a7a',
        },
        gold: {
          DEFAULT: '#F5A623',
          light: '#FEF6E4',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
