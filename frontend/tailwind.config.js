/** @type {import('tailwindcss').Config} */
// Tokens are the single source of truth in src/styles/theme.css (:root).
// Here we only map them onto Tailwind utilities via var() — never hardcode hex.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: 'rgb(var(--pitch-rgb) / <alpha-value>)',
        'pitch-deep': 'rgb(var(--pitch-deep-rgb) / <alpha-value>)',
        turf: 'rgb(var(--turf-rgb) / <alpha-value>)',
        'turf-2': 'rgb(var(--turf-2-rgb) / <alpha-value>)',
        'turf-stripe-a': 'rgb(var(--turf-stripe-a-rgb) / <alpha-value>)',
        'turf-stripe-b': 'rgb(var(--turf-stripe-b-rgb) / <alpha-value>)',
        edge: 'rgb(var(--edge-rgb) / <alpha-value>)',
        'edge-2': 'rgb(var(--edge-2-rgb) / <alpha-value>)',
        line: 'var(--line)',
        chalk: 'rgb(var(--chalk-rgb) / <alpha-value>)',
        'chalk-dim': 'rgb(var(--chalk-dim-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        grass: 'rgb(var(--grass-rgb) / <alpha-value>)',
        'grass-deep': 'rgb(var(--grass-deep-rgb) / <alpha-value>)',
        flare: 'rgb(var(--flare-rgb) / <alpha-value>)',
        'flare-2': 'rgb(var(--flare-2-rgb) / <alpha-value>)',
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'ui-monospace', "'DejaVu Sans Mono'", "'SF Mono'", 'Menlo', 'monospace'],
      },
      letterSpacing: {
        eyebrow: '0.2em',
        tightest: '-0.04em',
        display: '-0.025em',
      },
      borderRadius: {
        card: '20px',
        'card-lg': '22px',
        ctrl: '14px',
      },
      maxWidth: {
        play: '640px',
        'play-tablet': '560px',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.02) inset, 0 18px 40px -24px rgba(0,0,0,0.8)',
        grass: '0 8px 30px -10px rgba(43,212,107,0.45)',
        flare: '0 8px 30px -12px rgba(255,106,0,0.5)',
      },
    },
  },
  plugins: [],
};
