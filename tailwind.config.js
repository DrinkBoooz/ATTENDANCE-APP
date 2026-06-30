module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'csu-green': '#0B5E2E',
        'csu-green-dark': '#073D1F',
        'csu-gold': '#FFC72C',
        'csu-cream': '#FBF8EF',
        'status-present': '#16A34A',
        'status-late': '#D97706',
        'status-absent': '#DC2626',
        'status-excused': '#2563EB',
      },
    },
  },
  plugins: [],
};