import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  required = false,
  className = '',
  type = 'text',
  ...props
}, ref) => {
  const baseStyles = 'w-full px-4 py-3 border-2 border-gray-300 dark:border-slate-600 rounded-md text-sm transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30';
  const errorStyles = error ? 'border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-100' : '';

  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 font-semibold text-gray-900 dark:text-white text-sm">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={`${baseStyles} ${errorStyles} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
