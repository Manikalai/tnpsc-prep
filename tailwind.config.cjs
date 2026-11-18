/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-tamil)", "system-ui", "sans-serif"] },
      colors: {
        ink: "#1f2328",
        paper: "#fbf8f2",
        brand: { 50: "#eef6f3", 100: "#d5ebe3", 500: "#1f7a5c", 600: "#17644b", 700: "#114c39" },
        kumkum: { 500: "#b4432b", 50: "#fbeeea" },
        turmeric: { 500: "#c99a1e", 50: "#fbf3dd" },
      },
    },
  },
  plugins: [],
};
