/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          900: '#0B0F14'
        },
        card: {
          800: '#141A22'
        },
        surface: {
          700: '#1B232A'
        },
        accent: {
          cyan: '#00E5FF'
        },
        success: '#2ECC71',
        danger: '#FF4D4F',
        warning: '#F1C40F',
        muted: '#9AA6B2'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '16px',
        '4': '24px',
        '5': '32px',
        '6': '48px',
        '7': '64px',
      },
      borderRadius: {
        'card': '10px',
        'btn': '8px',
      }
    },
  },
  plugins: [],
}
