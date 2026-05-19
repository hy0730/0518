/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  // 기존 CSS(Module) 기반 UI가 많아서, 전역 reset(preflight)으로 인한 사이드이펙트를 피함
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};

