import { useState, useEffect } from 'react';
import { Clock, Pause, Timer } from 'lucide-react';

const TournamentTimer = ({ startedAt, startDate, status, isPaused, pausedAt, totalPausedTime = 0, compact = false }) => {
  const [elapsedTime, setElapsedTime] = useState('');
  const [countdown, setCountdown] = useState('');

  // Countdown timer for upcoming tournaments (OPEN/DRAFT)
  useEffect(() => {
    if (status === 'ACTIVE' || !startDate) {
      setCountdown('');
      return;
    }

    const calculateCountdown = () => {
      const now = new Date();
      const start = new Date(startDate);
      let diff = Math.floor((start - now) / 1000); // difference in seconds

      // If the tournament start date has passed, don't show countdown
      if (diff <= 0) {
        return '';
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (days > 0) {
        return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
      }
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // Initial calculation
    setCountdown(calculateCountdown());

    const interval = setInterval(() => {
      setCountdown(calculateCountdown());
    }, 1000);

    return () => clearInterval(interval);
  }, [startDate, status]);

  // Elapsed timer for active tournaments
  useEffect(() => {
    if (status !== 'ACTIVE' || !startedAt) {
      setElapsedTime('');
      return;
    }

    const calculateElapsedTime = () => {
      const now = new Date();
      const start = new Date(startedAt);
      let diff = Math.floor((now - start) / 1000); // difference in seconds

      // Subtract total paused time
      diff -= totalPausedTime;

      // If currently paused, also subtract the current pause duration
      if (isPaused && pausedAt) {
        const currentPauseDuration = Math.floor((now - new Date(pausedAt)) / 1000);
        diff -= currentPauseDuration;
      }

      // Ensure diff is not negative
      if (diff < 0) diff = 0;

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // Initial calculation
    setElapsedTime(calculateElapsedTime());

    // Only update every second if not paused
    if (!isPaused) {
      const interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [startedAt, status, isPaused, pausedAt, totalPausedTime]);

  // Show countdown for upcoming tournaments
  if (status !== 'ACTIVE' && countdown) {
    if (compact) {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-md">
          <Timer size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400">
            {countdown}
          </span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-2 border-blue-500/30 rounded-lg">
        <Timer size={20} className="text-blue-600 dark:text-blue-400" />
        <div className="flex flex-col">
          <span className="text-xs text-muted font-medium">Starts In</span>
          <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">
            {countdown}
          </span>
        </div>
      </div>
    );
  }

  // Show elapsed time for active tournaments
  if (status !== 'ACTIVE' || !elapsedTime) {
    return null;
  }

  // Compact version for tournament cards
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${
        isPaused
          ? 'bg-yellow-500/10 border border-yellow-500/30'
          : 'bg-brand-green/10 border border-brand-green/30'
      } rounded-md`}>
        {isPaused ? (
          <Pause size={14} className="text-yellow-600 dark:text-yellow-500" />
        ) : (
          <Clock size={14} className="text-brand-green animate-pulse" />
        )}
        <span className={`text-sm font-mono font-semibold ${
          isPaused ? 'text-yellow-600 dark:text-yellow-500' : 'text-brand-green'
        }`}>
          {elapsedTime}
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 ${
      isPaused
        ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30'
        : 'bg-gradient-to-r from-brand-green/10 to-green-600/10 border-2 border-brand-green/30'
    } rounded-lg`}>
      {isPaused ? (
        <Pause size={20} className="text-yellow-600 dark:text-yellow-500" />
      ) : (
        <Clock size={20} className="text-brand-green animate-pulse" />
      )}
      <div className="flex flex-col">
        <span className="text-xs text-muted font-medium">
          {isPaused ? 'Tournament Paused' : 'Tournament Running'}
        </span>
        <span className={`text-lg font-mono font-bold ${
          isPaused ? 'text-yellow-600 dark:text-yellow-500' : 'text-brand-green'
        }`}>
          {elapsedTime}
        </span>
      </div>
    </div>
  );
};

export default TournamentTimer;
