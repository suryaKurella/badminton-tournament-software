const statusStyles = {
  // Tournament statuses
  DRAFT: 'bg-light-surface dark:bg-gray-700 text-light-text-muted dark:text-gray-300',
  OPEN: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  ACTIVE: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  COMPLETED: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',

  // Match statuses
  UPCOMING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  LIVE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',

  // Registration statuses
  PENDING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  APPROVED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const StatusBadge = ({ status, className = '' }) => {
  const baseStyles = 'px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap';
  const colorStyles = statusStyles[status?.toUpperCase()] || statusStyles.DRAFT;

  return (
    <span className={`${baseStyles} ${colorStyles} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
