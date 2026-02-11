const sizes = {
  sm: 'h-6 w-6',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const LoadingSpinner = ({
  size = 'md',
  message = 'Loading...',
  fullScreen = false,
  className = ''
}) => {
  const containerStyles = fullScreen
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center py-12';

  return (
    <div className={`${containerStyles} ${className}`}>
      <div className="text-center">
        <div
          className={`animate-spin rounded-full border-b-2 border-primary-600 dark:border-brand-green mx-auto ${sizes[size]}`}
        />
        {message && (
          <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;
