import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        separator: 'var(--separator)',
        label: 'var(--label)',
        label2: 'var(--label-2)',
        accent: 'var(--accent)',
        ok: 'var(--green)',
        warn: 'var(--orange)',
        bad: 'var(--red)',
        purple: 'var(--purple)',
        teal: 'var(--teal)',
      },
      borderRadius: { control: '10px', card: '14px', sheet: '20px' },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        d1: ['34px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        d2: ['28px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        d3: ['22px', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        body: ['15px', { lineHeight: '1.45' }],
        sm2: ['13px', { lineHeight: '1.4' }],
        xs2: ['11px', { lineHeight: '1.35' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)',
        sheet: '0 10px 40px rgba(0,0,0,.18)',
      },
      keyframes: {
        in: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { in: 'in .22s ease-out both', shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [],
} satisfies Config
