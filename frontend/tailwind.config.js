/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand Colors
        brand: {
          blue: '#1E40AF',
          green: '#22C55E',
        },

        // Light Mode Palette
        light: {
          bg: '#F9FAFB',
          card: '#FFFFFF',
          surface: '#F3F4F6',
          border: '#E5E7EB',
          text: {
            primary: '#0F172A',
            muted: '#64748B',
          },
        },

        // Dark Mode Palette
        dark: {
          bg: '#0B1220',
          card: '#0F1A2B',
          surface: '#12213A',
          border: '#20314F',
          text: {
            primary: '#E5E7EB',
            muted: '#94A3B8',
          },
        },

        // Semantic States
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#38BDF8',
      },

      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'shrink': 'shrink linear forwards',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        shrink: {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
      },

      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'dark-card': '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        'dark-card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',

        // Glass effect shadows
        'glass': '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
        'glass-hover': '0 12px 48px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 0 0 1px rgba(59, 130, 246, 0.2)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-dark-hover': '0 12px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.3)',
      },

      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },

      // Glass-specific background colors
      backgroundColor: {
        'glass-light': 'rgba(255, 255, 255, 0.7)',
        'glass-light-hover': 'rgba(255, 255, 255, 0.85)',
        'glass-dark': 'rgba(15, 26, 43, 0.7)',
        'glass-dark-hover': 'rgba(15, 26, 43, 0.85)',
      },

      // Glass border colors
      borderColor: {
        'glass-light': 'rgba(255, 255, 255, 0.2)',
        'glass-light-hover': 'rgba(255, 255, 255, 0.3)',
        'glass-dark': 'rgba(255, 255, 255, 0.1)',
        'glass-dark-hover': 'rgba(255, 255, 255, 0.15)',
      },

      // Glass-specific gradients
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-glass-light': 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
        'gradient-glass-dark': 'linear-gradient(135deg, rgba(15, 26, 43, 0.9) 0%, rgba(15, 26, 43, 0.6) 100%)',
        'mesh-light': 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
        'mesh-dark': 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      },
    },
  },
  plugins: [],
}
