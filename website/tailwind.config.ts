import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-anton)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"]
      },
      colors: {
        page: "var(--bg-page)",
        card: "var(--bg-card)",
        cardDeep: "var(--bg-card-deep)",
        cardAlt: "var(--bg-card-alt)",
        cardHover: "var(--bg-card-hover)",
        button: "var(--bg-button)",
        input: "var(--bg-input)",
        avatar: "var(--bg-avatar)",
        border: "var(--border)",
        borderButton: "var(--border-button)",
        borderSubtle: "var(--border-subtle)",
        textPrimary: "var(--text-primary)",
        textBright: "var(--text-bright)",
        textCard: "var(--text-card)",
        textCardTitle: "var(--text-card-title)",
        textSecondary: "var(--text-secondary)",
        textMuted: "var(--text-muted)",
        accent: "var(--accent)",
        accentDim: "var(--accent-dim)"
      }
    }
  },
  plugins: []
};

export default config;
