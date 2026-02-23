import { useState } from 'react';
import { X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary' }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const typeStyles = {
    primary: {
      bg: 'bg-brand-blue hover:bg-blue-700',
      barColor: 'bg-brand-blue',
      icon: '🚀',
    },
    success: {
      bg: 'bg-brand-green hover:bg-green-700',
      barColor: 'bg-brand-green',
      icon: '✓',
    },
    warning: {
      bg: 'bg-warning hover:bg-orange-600',
      barColor: 'bg-warning',
      icon: '⚠️',
    },
    danger: {
      bg: 'bg-error hover:bg-red-600',
      barColor: 'bg-error',
      icon: '⚠️',
    },
  };

  const style = typeStyles[type] || typeStyles.primary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-3xl"
        onClick={loading ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative glass-modal max-w-md w-full p-6 animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-primary transition-colors p-1 hover:bg-light-surface dark:hover:bg-dark-surface rounded-lg disabled:opacity-30"
          aria-label="Close"
          disabled={loading}
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-full ${style.bg} bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center text-4xl`}>
            {style.icon}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-primary mb-3">
          {title}
        </h2>

        {/* Message */}
        <p className="text-center text-muted mb-6 leading-relaxed">
          {message}
        </p>

        {/* Loading progress bar */}
        {loading && (
          <div className="mb-4 overflow-hidden rounded-full h-1.5 bg-light-border dark:bg-slate-700 relative">
            <div
              className={`absolute top-0 h-full rounded-full ${style.barColor}`}
              style={{
                animation: 'modalProgress 1.5s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes modalProgress {
                0% { left: -40%; width: 40%; }
                50% { left: 30%; width: 50%; }
                100% { left: 110%; width: 40%; }
              }
            `}</style>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 glass-button text-primary font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm();
              } finally {
                setLoading(false);
              }
              onClose();
            }}
            disabled={loading}
            className={`flex-1 px-6 py-3 ${style.bg} text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
