import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./modules/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        ring: "var(--ring)",
        navy: "var(--navy-900)",
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        primary: {
          DEFAULT: "var(--primary-600)",
          hover: "var(--primary-700)",
          foreground: "var(--primary-foreground)",
          accent: "var(--primary-500)",
        },
        accent: { DEFAULT: "var(--accent-500)", foreground: "var(--accent-foreground)" },
        danger: { DEFAULT: "var(--danger)", foreground: "var(--danger-foreground)" },
        success: { DEFAULT: "var(--success)", foreground: "var(--success-foreground)" },
      },
      borderRadius: { sm: "6px", md: "10px", lg: "16px" },
      fontFamily: {
        sans: ["Inter", "Plus Jakarta Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        sm: "0 1px 2px rgba(15,23,42,0.06)",
        md: "0 4px 12px rgba(15,23,42,0.08)",
        lg: "0 12px 32px rgba(15,23,42,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
