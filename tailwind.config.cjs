/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-tamil)", "system-ui", "sans-serif"] },
      keyframes: {
        velglow: { "0%,100%": { transform: "translateY(0) scale(1)", filter: "drop-shadow(0 0 2px #ffd76a)" }, "50%": { transform: "translateY(-3px) scale(1.06)", filter: "drop-shadow(0 0 10px #ffd76a)" } },
        fadein: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      colors: {
        ink: "#1f2328",
        paper: "#fcf6ec",
        // Murugan theme: peacock teal (primary), Vel gold / saffron (accent), kumkum red (warnings), maroon (hero)
        brand: { 50: "#eaf5f6", 100: "#cde8eb", 500: "#0d6e7a", 600: "#0a5a64", 700: "#08434b" },
        kumkum: { 500: "#b4232a", 50: "#fbeceb" },
        turmeric: { 500: "#e08a1e", 50: "#fdf2e1" },
        maroon: { 500: "#a01d1d", 700: "#6d1010", 900: "#4a0a0a" },
        saffron: { 400: "#f6a33a", 500: "#ec7f1f" },
        gold: { 400: "#f2c14e", 500: "#d4a017" },
      },
    },
  },
  plugins: [],
};
