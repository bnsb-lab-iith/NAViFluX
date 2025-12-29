/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            animation: {
                blob: 'blob 5s infinite',
            },
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(80px, -100px) scale(1.2)' },
                    '66%': { transform: 'translate(-60px, 60px) scale(0.8)' },
                    '100%': { transform: 'translate(0, 0) scale(1)' },
                },
            },
        },
    },
    plugins: [],
}
