/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'regal-blue': '#1E3A8A', // Deep blue for a regal look
        'regal-gold': '#D4AF37', // Gold accent for premium feel
        'soft-gray': '#F1F5F9', // Light background
        'dark-gray': '#2D3748', // Darker text/icons
      },
    },
  },
  plugins: [],
}