import { useState, useEffect } from 'react';

const RoundRobinTable = ({ bracketData, onMatchClick }) => {
  const [standings, setStandings] = useState([]);

  useEffect(() => {
    if (bracketData?.bracketNodes) {
      calculateStandings();
    }
  }, [bracketData]);

  const calculateStandings = () => {
    const teamStats = {};

    // Initialize team stats
    bracketData.bracketNodes.forEach((node) => {
      if (node.match) {
        const { team1, team2, matchStatus, winnerId, team1Score, team2Score } = node.match;

        // Initialize team1
        if (team1 && !teamStats[team1.id]) {
          teamStats[team1.id] = {
            team: team1,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            gamesWon: 0,
            gamesLost: 0,
            pointsFor: 0,
            pointsAgainst: 0,
          };
        }

        // Initialize team2
        if (team2 && !teamStats[team2.id]) {
          teamStats[team2.id] = {
            team: team2,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            gamesWon: 0,
            gamesLost: 0,
            pointsFor: 0,
            pointsAgainst: 0,
          };
        }

        // Update stats for completed matches
        if (matchStatus === 'COMPLETED' && winnerId) {
          teamStats[team1.id].matchesPlayed++;
          teamStats[team2.id].matchesPlayed++;

          if (winnerId === team1.id) {
            teamStats[team1.id].wins++;
            teamStats[team2.id].losses++;
          } else {
            teamStats[team2.id].wins++;
            teamStats[team1.id].losses++;
          }

          // Calculate game and point stats if detailed scores available
          if (team1Score?.games && team2Score?.games) {
            team1Score.games.forEach((score, index) => {
              const team2GameScore = team2Score.games[index];
              if (score > team2GameScore) {
                teamStats[team1.id].gamesWon++;
                teamStats[team2.id].gamesLost++;
              } else {
                teamStats[team2.id].gamesWon++;
                teamStats[team1.id].gamesLost++;
              }
              teamStats[team1.id].pointsFor += score;
              teamStats[team1.id].pointsAgainst += team2GameScore;
              teamStats[team2.id].pointsFor += team2GameScore;
              teamStats[team2.id].pointsAgainst += score;
            });
          }
        }
      }
    });

    // Convert to array and sort
    const standingsArray = Object.values(teamStats).sort((a, b) => {
      // Sort by wins, then by games won, then by point differential
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      const aDiff = a.pointsFor - a.pointsAgainst;
      const bDiff = b.pointsFor - b.pointsAgainst;
      return bDiff - aDiff;
    });

    setStandings(standingsArray);
  };

  const getTeamName = (team) => {
    if (!team) return 'Unknown';
    if (team.teamName) return team.teamName;
    if (team.player1?.fullName === team.player2?.fullName) {
      return team.player1?.fullName || team.player1?.username || 'Unknown';
    }
    return `${team.player1?.fullName || team.player1?.username} / ${team.player2?.fullName || team.player2?.username}`;
  };

  const groupMatchesByRound = () => {
    const rounds = {};
    bracketData.bracketNodes.forEach((node) => {
      if (!rounds[node.roundNumber]) {
        rounds[node.roundNumber] = [];
      }
      rounds[node.roundNumber].push(node);
    });
    return rounds;
  };

  const rounds = bracketData?.bracketNodes ? groupMatchesByRound() : {};

  return (
    <div className="space-y-8">
      {/* Standings Table */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-bold mb-4 text-brand-green">Standings</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-sm font-semibold text-muted">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted">Team/Player</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">MP</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">W</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">L</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">GW</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">GL</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">PF</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">PA</th>
                <th className="text-center py-3 px-2 text-sm font-semibold text-muted">Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.length > 0 ? (
                standings.map((stat, index) => (
                  <tr
                    key={stat.team.id}
                    className={`border-b border-border/50 hover:bg-brand-green/5 transition-colors ${
                      index === 0 ? 'bg-brand-green/10' : ''
                    }`}
                  >
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`font-semibold ${
                          index === 0 ? 'text-brand-green text-lg' : 'text-foreground'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{getTeamName(stat.team)}</td>
                    <td className="py-3 px-2 text-center text-muted">{stat.matchesPlayed}</td>
                    <td className="py-3 px-2 text-center text-brand-green font-semibold">
                      {stat.wins}
                    </td>
                    <td className="py-3 px-2 text-center text-red-500">{stat.losses}</td>
                    <td className="py-3 px-2 text-center text-muted">{stat.gamesWon}</td>
                    <td className="py-3 px-2 text-center text-muted">{stat.gamesLost}</td>
                    <td className="py-3 px-2 text-center text-muted">{stat.pointsFor}</td>
                    <td className="py-3 px-2 text-center text-muted">{stat.pointsAgainst}</td>
                    <td
                      className={`py-3 px-2 text-center font-semibold ${
                        stat.pointsFor - stat.pointsAgainst > 0
                          ? 'text-brand-green'
                          : stat.pointsFor - stat.pointsAgainst < 0
                          ? 'text-red-500'
                          : 'text-muted'
                      }`}
                    >
                      {stat.pointsFor - stat.pointsAgainst > 0 ? '+' : ''}
                      {stat.pointsFor - stat.pointsAgainst}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-muted">
                    No matches completed yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-muted">
          <p>MP: Matches Played | W: Wins | L: Losses | GW: Games Won | GL: Games Lost</p>
          <p>PF: Points For | PA: Points Against | Diff: Point Differential</p>
        </div>
      </div>

      {/* Matches by Round */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-brand-green">Matches</h3>
        {Object.keys(rounds)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map((roundNum) => (
            <div key={roundNum} className="glass-card p-6">
              <h4 className="text-lg font-semibold mb-4">Round {roundNum}</h4>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {rounds[roundNum].map((node) => {
                  const match = node.match;
                  if (!match) return null;

                  const team1Name = getTeamName(match.team1);
                  const team2Name = getTeamName(match.team2);
                  const isCompleted = match.matchStatus === 'COMPLETED';
                  const isLive = match.matchStatus === 'LIVE';

                  return (
                    <div
                      key={node.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-brand-green/50 ${
                        isLive
                          ? 'border-brand-green/50 bg-brand-green/5'
                          : isCompleted
                          ? 'border-border/30 bg-card-dark/20'
                          : 'border-border/30'
                      }`}
                      onClick={() => onMatchClick && onMatchClick(match)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">{team1Name}</span>
                        {isCompleted && match.team1Score && (
                          <span className="font-mono text-sm">{match.team1Score.games?.join('-')}</span>
                        )}
                      </div>
                      <div className="text-center text-xs text-muted mb-2">
                        {isLive ? (
                          <span className="text-brand-green font-semibold">● LIVE</span>
                        ) : isCompleted ? (
                          <div className="flex flex-col items-center">
                            <span>Final</span>
                            <span className="text-brand-green text-[10px] font-medium">
                              Winner: {match.winnerId === match.team1Id ? team1Name : team2Name}
                            </span>
                          </div>
                        ) : (
                          'vs'
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{team2Name}</span>
                        {isCompleted && match.team2Score && (
                          <span className="font-mono text-sm">{match.team2Score.games?.join('-')}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default RoundRobinTable;
