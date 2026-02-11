const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-lg transition-all duration-150 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5';

  const variants = {
    primary: 'btn-primary',
    success: 'btn-success',
    secondary: 'btn-secondary',
    outline: 'bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-600/20 hover:border-blue-600',
    error: 'bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 hover:border-error',
    warning: 'bg-warning/10 text-warning hover:bg-warning hover:text-white border border-warning/20 hover:border-warning',
    ghost: 'hover:bg-light-surface dark:hover:bg-dark-surface text-primary hover:shadow-none hover:translate-y-0',
    google: 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
