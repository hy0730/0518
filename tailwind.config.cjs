/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F4EBD9',
        paper2: '#F8F1E3',
        ink: '#4A3728',
        stamp: '#D9534F',
        olive: '#6B705C',
      },
      fontFamily: {
        note: ['ExplorerNote', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 14px 30px rgba(74,55,40,0.18)',
      },
    },
  },
  // 기존 CSS(Module) 기반 UI가 많아서, 전역 reset(preflight)으로 인한 사이드이펙트를 피함
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
