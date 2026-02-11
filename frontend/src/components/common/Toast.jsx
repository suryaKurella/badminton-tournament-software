import { useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const variants = {
    success: {
      bg: 'bg-gradient-to-r from-brand-green/10 to-success/5 dark:from-brand-green/20 dark:to-success/10',
      border: 'border-brand-green',
      text: 'text-brand-green dark:text-green-400',
      icon: CheckCircle,
    },
    error: {
      bg: 'bg-gradient-to-r from-error/10 to-red-500/5 dark:from-error/20 dark:to-red-500/10',
      border: 'border-error',
      text: 'text-error dark:text-red-400',
      icon: XCircle,
    },
    warning: {
      bg: 'bg-gradient-to-r from-warning/10 to-yellow-500/5 dark:from-warning/20 dark:to-yellow-500/10',
      border: 'border-warning',
      text: 'text-warning dark:text-yellow-400',
      icon: AlertCircle,
    },
    info: {
      bg: 'bg-gradient-to-r from-info/10 to-blue-500/5 dark:from-info/20 dark:to-blue-500/10',
      border: 'border-info',
      text: 'text-info dark:text-blue-400',
      icon: Info,
    },
  };

  const variant = variants[type] || variants.success;
  const Icon = variant.icon;

  return (
    <div
      className={`
        ${variant.bg} ${variant.border}
        border-l-4 rounded-lg shadow-2xl
        p-4 pr-12
        flex items-start gap-3
        animate-slide-up
        backdrop-blur-sm
        min-w-[320px] max-w-md
        relative
      `}
      role="alert"
    >
      <Icon className={`${variant.text} flex-shrink-0 mt-0.5`} size={20} />

      <div className="flex-1">
        <p className={`font-medium ${variant.text}`}>
          {message}
        </p>
      </div>

      <button
        onClick={onClose}
        className={`
          absolute top-4 right-4
          ${variant.text}
          hover:opacity-70
          transition-opacity
          focus:outline-none focus:ring-2 focus:ring-brand-blue rounded
        `}
        aria-label="Close notification"
      >
        <X size={18} />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-light-border dark:bg-dark-border rounded-b-lg overflow-hidden">
        <div
          className={`h-full ${variant.text.replace('text-', 'bg-')} animate-shrink`}
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  );
};

export default Toast;
