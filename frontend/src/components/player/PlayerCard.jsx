import { Link } from 'react-router-dom';

const PlayerCard = ({ player, onClick, showStats = true }) => {
  const winRate = player.matchesPlayed > 0
    ? ((player.wins / player.matchesPlayed) * 100).toFixed(1)
    : '0.0';

  const CardWrapper = onClick ? 'button' : Link;
  const wrapperProps = onClick
    ? { onClick, type: 'button' }
    : { to: `/players/${player.id}` };

  return (
    <CardWrapper
      {...wrapperProps}
      className="card card-hover p-6 block w-full text-left interactive animate-scale-in"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-brand-blue to-brand-green flex items-center justify-center text-white font-bold text-2xl sm:text-3xl flex-shrink-0 shadow-lg">
          {(player.fullName || player.username).charAt(0).toUpperCase()}
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg sm:text-xl font-bold text-primary truncate mb-1">
            {player.fullName || player.username}
          </h3>

          {player.email && (
            <p className="text-sm text-muted truncate">{player.email}</p>
          )}

          {player.category && (
            <span className="inline-block mt-2 badge badge-info">
              {player.category}
            </span>
          )}
        </div>

        {/* Points Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className="text-3xl font-bold text-brand-blue">
            {player.points || 0}
          </div>
          <span className="text-xs text-muted">points</span>
        </div>
      </div>

      {showStats && (
        <>
          {/* Divider */}
          <div className="border-t border-light-border dark:border-dark-border my-4"></div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Matches Played */}
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {player.matchesPlayed || 0}
              </div>
              <div className="text-xs text-muted mt-1">Matches</div>
            </div>

            {/* Wins */}
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {player.wins || 0}
              </div>
              <div className="text-xs text-muted mt-1">Wins</div>
            </div>

            {/* Win Rate */}
            <div className="text-center">
              <div className="text-2xl font-bold text-info">
                {winRate}%
              </div>
              <div className="text-xs text-muted mt-1">Win Rate</div>
            </div>
          </div>

          {/* Win Rate Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Win Rate</span>
              <span>{winRate}%</span>
            </div>
            <div className="w-full h-2.5 bg-light-surface dark:bg-dark-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-success to-brand-green rounded-full transition-all duration-500"
                style={{ width: `${winRate}%` }}
              />
            </div>
          </div>
        </>
      )}
    </CardWrapper>
  );
};

export default PlayerCard;
