import { X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary' }) => {
  if (!isOpen) return null;

  const typeStyles = {
    primary: {
      bg: 'bg-brand-blue hover:bg-blue-700',
      icon: '🚀',
    },
    success: {
      bg: 'bg-brand-green hover:bg-green-700',
      icon: '✓',
    },
    warning: {
      bg: 'bg-warning hover:bg-orange-600',
      icon: '⚠️',
    },
    danger: {
      bg: 'bg-error hover:bg-red-600',
      icon: '⚠️',
    },
  };

  const style = typeStyles[type] || typeStyles.primary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-3xl"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-modal max-w-md w-full p-6 animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-primary transition-colors p-1 hover:bg-light-surface dark:hover:bg-dark-surface rounded-lg"
          aria-label="Close"
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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 glass-button text-primary font-semibold"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-6 py-3 ${style.bg} text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
