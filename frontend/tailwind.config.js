/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: { 950:'#0B0F14', 900:'#101620', 800:'#141A22', 700:'#1B232A', 600:'#252E38' },
        cyan:     { 500:'#00E5FF', 400:'#33EBFF', 300:'#66F0FF', glow:'rgba(0,229,255,0.3)' },
        orange:   { 500:'#FF6B2C', 400:'#FF8A56', glow:'rgba(255,107,44,0.3)' },
        green:    { 500:'#2ECC71', 400:'#4BD88B' },
        red:      { 500:'#FF4D4F', 400:'#FF7173', glow:'rgba(255,77,79,0.4)' },
        muted:    '#9AA6B2',
        txtprimary: '#EEF0F8',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['Roboto Mono', 'monospace'],
      },
      borderRadius: { card:'12px', modal:'18px' },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(0,229,255,0.25), 0 0 60px rgba(0,229,255,0.1)',
        'glow-orange': '0 0 20px rgba(255,107,44,0.25), 0 0 60px rgba(255,107,44,0.1)',
        'glow-red':    '0 0 15px rgba(255,77,79,0.4)',
        'float':       '0 20px 50px rgba(0,229,255,0.12)',
        'float-orange':'0 20px 50px rgba(255,107,44,0.12)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':      'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
