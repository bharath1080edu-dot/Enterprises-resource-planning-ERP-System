/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Image Creator Brand Colors ──────────────────────
        navy: {
          50:  '#e8edf5',
          100: '#c5d0e6',
          200: '#9fb1d6',
          300: '#7791c5',
          400: '#587ab9',
          500: '#3963ad',
          600: '#2d5199',
          700: '#1f3c81',
          800: '#1B2A4A',   // Primary Brand Navy
          900: '#0f1c32',
          950: '#080e1c',
        },
        orange: {
          50:  '#fff8ec',
          100: '#ffefd0',
          200: '#ffdca0',
          300: '#ffc46d',
          400: '#ffa83a',
          500: '#F5A623',   // Primary Brand Orange
          600: '#e08b0e',
          700: '#bb6d0a',
          800: '#955510',
          900: '#7a4613',
          950: '#422206',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { transform: 'translateX(-10px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
