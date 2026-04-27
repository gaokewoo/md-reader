/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: '#f3f4f6',
        'sidebar-dark': '#1f2937',
        preview: '#ffffff',
        'markdown-bg': '#f9fafb',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
