// Tailwind v4: la configuración principal vive en index.css con @theme.
// Este archivo existe para compatibilidad con herramientas externas (editores, linters).
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#0B0316',
        midnight: '#161344',
        eclipse: '#490F7C',
        moonlight: '#F2F2F2',
        neon: {
          purple: '#b026ff',
          blue: '#00f0ff',
          green: '#00ff9d',
        },
        mostaza: {
          DEFAULT: '#EAB308',
          light: '#FDE047',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
    },
  },
};
