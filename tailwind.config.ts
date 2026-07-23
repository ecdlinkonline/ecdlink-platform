import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1E3A8A",
          green: "#2E7D32",
          accent: "#F4F7FA",
          ink: "#111827",
          muted: "#6B7280",
          line: "#E5E7EB"
        }
      },
      boxShadow: {
        soft: "0 18px 60px rgba(15, 23, 42, 0.10)",
        panel: "0 1px 2px rgba(15, 23, 42, 0.06), 0 24px 48px rgba(30, 58, 138, 0.10)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
