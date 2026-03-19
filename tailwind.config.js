/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        orangeBrand: '#FF6A00',
        ink: '#0A0A0A',
        cloud: '#F7F7F7',
        neonLime: '#B6FF2E',
        electricBlue: '#22D3EE',
      },
    },
  },
  plugins: [],
}

