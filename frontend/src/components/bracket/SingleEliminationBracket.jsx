import { useState } from 'react';

const SingleEliminationBracket = ({ bracketData, onMatchClick, showSeeds = true }) => {
  if (!bracketData?.bracketNodes) {
    return <div className="text-center py-8 text-muted">No bracket data available</div>;
  }

  // Group nodes by round
  const nodesByRound = bracketData.bracketNodes.reduce((acc, node) => {
    if (!acc[node.roundNumber]) {
      acc[node.roundNumber] = [];
    }
    acc[node.roundNumber].push(node);
    return acc;
  }, {});

  const rounds = Object.keys(nodesByRound).sort((a, b) => parseInt(a) - parseInt(b));
  const numRounds = rounds.length;

  const getRoundName = (roundIndex, totalRounds) => {
    const remaining = totalRounds - roundIndex;
    if (remaining === 0) return 'Champion';
    if (remaining === 1) return 'Finals';
    if (remaining === 2) return 'Semi-Finals';
    if (remaining === 3) return 'Quarter-Finals';
    return `Round ${roundIndex + 1}`;
  };

  const getTeamName = (team) => {
    if (!team) return 'TBD';
    if (team.teamName) return team.teamName;
    if (team.player1?.fullName === team.player2?.fullName) {
      return team.player1?.fullName || team.player1?.username || 'Unknown';
    }
    return `${team.player1?.fullName || team.player1?.username} / ${team.player2?.fullName || team.player2?.username}`;
  };

  const MatchCard = ({ node }) => {
    const match = node.match;

    if (!match) {
      return (
        <div className="glass-card p-3 min-w-[200px] border border-border/30">
          <div className="text-sm text-muted text-center">
            {node.seedNumber && showSeeds && (
              <span className="text-xs text-muted">Seed {node.seedNumber}</span>
            )}
            <p className="mt-1">TBD</p>
          </div>
        </div>
      );
    }

    const team1Name = getTeamName(match.team1);
    const team2Name = getTeamName(match.team2);
    const isCompleted = match.matchStatus === 'COMPLETED';
    const isLive = match.matchStatus === 'LIVE';
    const team1Won = isCompleted && match.winnerId === match.team1Id;
    const team2Won = isCompleted && match.winnerId === match.team2Id;
    const winnerName = team1Won ? team1Name : team2Won ? team2Name : null;

    return (
      <div
        className={`glass-card p-3 min-w-[220px] border transition-all cursor-pointer hover:border-brand-green/50 hover:shadow-lg ${
          isLive ? 'border-brand-green/50 animate-pulse' : 'border-border/30'
        }`}
        onClick={() => onMatchClick && onMatchClick(match)}
      >
        {/* Team 1 */}
        <div
          className={`flex justify-between items-center p-2 rounded ${
            team1Won ? 'bg-brand-green/20 font-semibold' : 'bg-card-dark/20'
          }`}
        >
          <span className="text-sm truncate flex-1">
            {showSeeds && node.seedNumber && (
              <span className="text-xs text-muted mr-2">{node.seedNumber}</span>
            )}
            {team1Name}
          </span>
          {isCompleted && match.team1Score && (
            <span className="text-sm ml-2 font-mono">
              {match.team1Score.games?.join('-') || '0'}
            </span>
          )}
        </div>

        {/* VS or status */}
        <div className="text-center text-xs text-muted py-1">
          {isLive ? (
            <span className="text-brand-green font-semibold">● LIVE</span>
          ) : isCompleted ? (
            <div className="flex flex-col items-center">
              <span className="text-muted">Final</span>
              {winnerName && (
                <span className="text-brand-green text-[10px] font-medium truncate max-w-[180px]">
                  Winner: {winnerName}
                </span>
              )}
            </div>
          ) : (
            <span>vs</span>
          )}
        </div>

        {/* Team 2 */}
        <div
          className={`flex justify-between items-center p-2 rounded ${
            team2Won ? 'bg-brand-green/20 font-semibold' : 'bg-card-dark/20'
          }`}
        >
          <span className="text-sm truncate flex-1">
            {showSeeds && node.seedNumber && (
              <span className="text-xs text-muted mr-2">{node.seedNumber + 1}</span>
            )}
            {team2Name}
          </span>
          {isCompleted && match.team2Score && (
            <span className="text-sm ml-2 font-mono">
              {match.team2Score.games?.join('-') || '0'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="inline-flex gap-8 min-w-full px-4">
        {rounds.map((roundNum, roundIndex) => {
          const roundNodes = nodesByRound[roundNum].sort((a, b) => a.position - b.position);
          const roundName = getRoundName(roundIndex, numRounds);

          return (
            <div key={roundNum} className="flex flex-col min-w-[240px]">
              {/* Round header */}
              <div className="text-center mb-4 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                <h3 className="font-semibold text-lg text-brand-green">{roundName}</h3>
                <p className="text-xs text-muted">{roundNodes.length} matches</p>
              </div>

              {/* Matches in this round */}
              <div className="flex flex-col gap-4 justify-around flex-1">
                {roundNodes.map((node) => (
                  <div
                    key={node.id}
                    className="relative"
                    style={{
                      marginTop: roundIndex > 0 ? `${Math.pow(2, roundIndex) * 8}px` : '0',
                      marginBottom: roundIndex > 0 ? `${Math.pow(2, roundIndex) * 8}px` : '0',
                    }}
                  >
                    <MatchCard node={node} />

                    {/* Connecting line to next round */}
                    {node.nextNodeId && roundIndex < numRounds - 1 && (
                      <div className="absolute left-full top-1/2 w-8 h-px bg-border"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex justify-center gap-4 text-xs text-muted">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-green"></div>
          <span>Live Match</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-brand-green/20"></div>
          <span>Winner</span>
        </div>
      </div>
    </div>
  );
};

export default SingleEliminationBracket;
