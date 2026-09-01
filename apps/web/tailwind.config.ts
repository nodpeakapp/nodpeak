import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Nodpeak surface ramp — void/panel/raised, darkest to lightest
        surface: {
          950: "#0A0B0D", // void — page background
          900: "#101216", // panel — card/panel background
          850: "#15181E", // panel-2 — hover / secondary panel
          800: "#22262E", // rule — hairline borders
          700: "#2E333C", // rule-2 — stronger borders, hover states
        },
        // Signature cyan accent
        cyan: {
          50: "#EAFBFD",
          200: "#A9EEF4",
          400: "#4EE0EC",
          500: "#25D6E8",
          600: "#17A8B8",
          700: "#0C6E79",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.02) inset",
        glow: "0 0 0 1px rgba(37,214,232,0.2), 0 8px 30px -8px rgba(37,214,232,0.25)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { "fade-up": "fade-up .18s ease-out both" },
    },
  },
  plugins: [],
};

export default config;
