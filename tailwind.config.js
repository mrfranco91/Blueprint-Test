/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': 'var(--color-brand-primary)', 
        'brand-secondary': 'var(--color-brand-secondary)', 
        'brand-accent': 'var(--color-brand-accent)', 
        'brand-light-blue': 'var(--color-brand-light-blue)', 
        'brand-bg': 'var(--color-brand-bg)',
      },
    },
  },
  plugins: [],
};
