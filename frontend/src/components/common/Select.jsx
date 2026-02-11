import { forwardRef } from 'react';

const Select = forwardRef(({
  label,
  error,
  required = false,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseStyles = 'w-full px-4 py-3 border-2 border-gray-300 dark:border-slate-600 rounded-md text-sm transition-all bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-slate-800';
  const errorStyles = error ? 'border-red-500 dark:border-red-500 focus:border-red-500' : '';

  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 font-semibold text-gray-900 dark:text-white text-sm">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}
      <select
        ref={ref}
        disabled={disabled}
        className={`${baseStyles} ${errorStyles} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
