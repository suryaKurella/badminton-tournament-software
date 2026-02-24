const LoadingSpinner = ({
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
        {/* Bouncing shuttlecock with fill animation */}
        <div className="relative mx-auto mb-4 w-16 h-20">
          <svg
            viewBox="0 0 64 80"
            className="w-full h-full animate-player-bounce"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="shuttleFill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#10B981">
                  <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
                </stop>
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.2">
                  <animate attributeName="offset" values="0;1;0" dur="2s" repeatCount="indefinite" />
                </stop>
              </linearGradient>
            </defs>

            {/* Shuttlecock cork (rounded bottom) */}
            <ellipse cx="32" cy="32" rx="10" ry="11" fill="url(#shuttleFill)" />

            {/* Feather skirt */}
            <path
              d="M22,30 Q20,15 18,2 L26,18 Z"
              fill="url(#shuttleFill)" opacity="0.9"
            />
            <path
              d="M27,28 Q27,13 28,0 L32,16 Z"
              fill="url(#shuttleFill)" opacity="0.9"
            />
            <path
              d="M37,28 Q37,13 36,0 L32,16 Z"
              fill="url(#shuttleFill)" opacity="0.9"
            />
            <path
              d="M42,30 Q44,15 46,2 L38,18 Z"
              fill="url(#shuttleFill)" opacity="0.9"
            />

            {/* Feather outline for definition */}
            <path
              d="M18,2 Q20,15 22,30 M28,0 Q27,13 27,28 M36,0 Q37,13 37,28 M46,2 Q44,15 42,30"
              fill="none"
              stroke="#10B981"
              strokeWidth="0.8"
              opacity="0.5"
            />

            {/* Cork rim detail */}
            <ellipse cx="32" cy="28" rx="10.5" ry="3" fill="none" stroke="#10B981" strokeWidth="0.8" opacity="0.4" />

            {/* Ground shadow */}
            <ellipse cx="32" cy="72" rx="14" ry="3" className="animate-shadow-pulse" fill="#10B981" opacity="0.15" />
          </svg>
        </div>

        {message && (
          <p className="text-sm font-medium text-light-text-muted dark:text-gray-400 animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;
