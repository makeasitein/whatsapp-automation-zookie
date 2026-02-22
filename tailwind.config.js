/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          light: 'rgba(79, 70, 229, 0.2)'
        },
        secondary: {
          DEFAULT: '#10B981',
          hover: '#059669'
        },
        background: {
          dark: '#0F172A',
          surface: '#1E293B'
        },
        text: {
          main: '#F8FAFC',
          muted: '#94A3B8'
        },
        border: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        success: '#10B981',
        error: '#EF4444'
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}

