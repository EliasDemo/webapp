import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
      },
      borderRadius: { xl: '1rem', '2xl': '1.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
