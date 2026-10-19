/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: "rgb(var(--bg) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        raised: "rgb(var(--panel-2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        mute: "rgb(var(--mute) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        // thin rules and hairlines: white on dark, ink on light
        rule: "rgb(var(--rule) / <alpha-value>)",
        // one colour per agent; every accent on the site maps to one of these
        planner: "rgb(var(--planner) / <alpha-value>)",
        researcher: "rgb(var(--researcher) / <alpha-value>)",
        builder: "rgb(var(--builder) / <alpha-value>)",
        reviewer: "rgb(var(--reviewer) / <alpha-value>)",
        brain: "rgb(var(--brain) / <alpha-value>)",
        alert: "rgb(var(--alert) / <alpha-value>)",
        // signboard yellow and its navy lettering, identical in both themes
        sun: "rgb(var(--sun) / <alpha-value>)",
        onsun: "rgb(var(--on-sun) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        idle: { "0%,100%": { opacity: 0.55, transform: "scale(1)" }, "50%": { opacity: 1, transform: "scale(1.06)" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
      },
      animation: { idle: "idle 3.2s ease-in-out infinite", scan: "scan 6s linear infinite" },
    },
  },
  plugins: [],
};
