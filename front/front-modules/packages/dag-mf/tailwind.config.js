/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/Login.tsx',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false, // отключает reset стили
 },
}