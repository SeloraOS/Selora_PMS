/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bos: {
          bg: '#0D1117',        // Main dark background
          flyout: '#161B22',    // Slightly lighter for flyouts
          accent: '#2D6BE4',    // Highlight accent color
          text: '#C9D1D9',      // Standard text
          textMuted: '#8B949E', // Muted text
          border: '#30363D'     // Borders
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
