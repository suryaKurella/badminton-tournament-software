/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    fontFamily: {
      sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        // Brand Colors
        brand: {
          blue: '#1E40AF',
          green: '#22C55E',
        },

        // Light Mode Palette - Court Green & Sky Blue
        light: {
          bg: '#F0FDFA',
          card: '#FFFFFF',
          surface: '#F0FDF4',
          border: '#D1E7DD',
          text: {
            primary: '#0F172A',
            muted: '#4B6A5E',
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
        'indeterminate-progress': 'indeterminateProgress 1.5s ease-in-out infinite',
        'player-bounce': 'playerBounce 1s ease-in-out infinite',
        'shuttle-float': 'shuttleFloat 1s ease-in-out infinite',
        'shadow-pulse': 'shadowPulse 1s ease-in-out infinite',
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
        indeterminateProgress: {
          '0%': { transform: 'translateX(-100%)', width: '40%' },
          '50%': { transform: 'translateX(100%)', width: '60%' },
          '100%': { transform: 'translateX(300%)', width: '40%' },
        },
        playerBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shuttleFloat: {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)', opacity: '1' },
          '50%': { transform: 'translate(-3px, -5px) rotate(-10deg)', opacity: '0.7' },
        },
        shadowPulse: {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.1' },
          '50%': { transform: 'scaleX(0.6)', opacity: '0.05' },
        },
      },

      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'dark-card': '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        'dark-card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',

        // Glass effect shadows
        'glass': '0 8px 32px rgba(16, 185, 129, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
        'glass-hover': '0 12px 48px rgba(16, 185, 129, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 0 0 1px rgba(20, 184, 166, 0.2)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-dark-hover': '0 12px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.3)',
      },

      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },

      // Glass-specific background colors
      backgroundColor: {
        'glass-light': 'rgba(255, 255, 255, 0.65)',
        'glass-light-hover': 'rgba(255, 255, 255, 0.8)',
        'glass-dark': 'rgba(15, 26, 43, 0.7)',
        'glass-dark-hover': 'rgba(15, 26, 43, 0.85)',
      },

      // Glass border colors
      borderColor: {
        'glass-light': 'rgba(16, 185, 129, 0.12)',
        'glass-light-hover': 'rgba(16, 185, 129, 0.2)',
        'glass-dark': 'rgba(255, 255, 255, 0.1)',
        'glass-dark-hover': 'rgba(255, 255, 255, 0.15)',
      },

      // Glass-specific gradients
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-glass-light': 'linear-gradient(135deg, rgba(240, 253, 250, 0.9) 0%, rgba(240, 253, 244, 0.6) 100%)',
        'gradient-glass-dark': 'linear-gradient(135deg, rgba(15, 26, 43, 0.9) 0%, rgba(15, 26, 43, 0.6) 100%)',
        'mesh-light': 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
        'mesh-dark': 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      },
    },
  },
  plugins: [],
}
