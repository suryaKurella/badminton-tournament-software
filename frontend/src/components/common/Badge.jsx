const Badge = ({
  children,
  variant = 'info',
  size = 'md',
  className = '',
}) => {
  const baseStyles = 'badge';

  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    primary: 'bg-brand-blue/10 text-brand-blue border border-brand-blue/20',
    secondary: 'bg-light-surface dark:bg-dark-surface text-muted border border-light-border dark:border-dark-border',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
