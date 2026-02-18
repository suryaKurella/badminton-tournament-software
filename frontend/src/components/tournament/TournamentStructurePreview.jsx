import { Trophy, Users } from 'lucide-react';

// --- Utility functions ---
const nextPowerOf2 = (n) => Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))));
const calcRounds = (n) => Math.ceil(Math.log2(Math.max(n, 2)));
const calcRoundRobinMatches = (n) => (n * (n - 1)) / 2;
const calcRoundRobinRounds = (n) => (n % 2 === 0 ? n - 1 : n);

const getRoundName = (roundIndex, totalRounds) => {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return 'Finals';
  if (remaining === 2) return 'Semi-Finals';
  if (remaining === 3) return 'Quarter-Finals';
  return `Round ${roundIndex + 1}`;
};

// Generate round-robin schedule using circle method
const generateRRSchedule = (n) => {
  const count = n % 2 === 0 ? n : n + 1; // add a BYE slot if odd
  const totalRounds = count - 1;
  const half = count / 2;
  const players = Array.from({ length: count }, (_, i) => i + 1);
  const rounds = [];

  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = [];
    for (let m = 0; m < half; m++) {
      const p1 = players[m];
      const p2 = players[count - 1 - m];
      // Skip byes (player n+1 is the BYE)
      if (n % 2 !== 0 && (p1 > n || p2 > n)) continue;
      roundMatches.push({ p1, p2 });
    }
    rounds.push(roundMatches);
    // Rotate: fix position 0, rotate the rest
    const last = players.pop();
    players.splice(1, 0, last);
  }
  return rounds;
};

// --- Shared sub-components ---
const StatPill = ({ label, value }) => (
  <div className="glass-surface px-3 py-2 flex flex-col items-center min-w-[70px]">
    <span className="text-lg font-bold text-brand-green">{value}</span>
    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
  </div>
);

const MatchNode = ({ label, accent = 'green' }) => {
  const borderColor = accent === 'amber' ? 'border-amber-500/30' : 'border-brand-green/30';
  const textColor = accent === 'amber' ? 'text-amber-400' : 'text-brand-green';
  return (
    <div className={`glass-surface px-2.5 py-1.5 rounded-lg text-center border ${borderColor}`} style={{ minWidth: 88 }}>
      <span className={`text-[10px] font-medium ${textColor}`}>{label}</span>
    </div>
  );
};

const PlayerSlot = ({ label }) => (
  <div className="glass-surface px-2 py-1 rounded text-center border border-gray-300/30 dark:border-gray-600/30" style={{ minWidth: 56 }}>
    <span className="text-[10px] text-gray-400 dark:text-gray-500">{label}</span>
  </div>
);

const ChampionNode = () => (
  <div className="glass-surface px-3 py-2.5 rounded-lg text-center border-2 border-brand-green/40 bg-brand-green/5">
    <Trophy size={18} className="text-brand-green mx-auto" />
    <p className="text-[10px] font-semibold text-brand-green mt-0.5">Champion</p>
  </div>
);

// SVG connector that merges pairs from one round into the next
const BracketConnector = ({ matchCount, totalH }) => {
  if (matchCount < 2) {
    // Single match → just a horizontal line
    return (
      <div className="flex-shrink-0" style={{ width: 24, height: totalH, marginTop: 26 }}>
        <svg width="24" height={totalH} className="block">
          <line x1="0" y1={totalH / 2} x2="24" y2={totalH / 2} stroke="#22C55E" strokeOpacity="0.35" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0" style={{ width: 24, height: totalH, marginTop: 26 }}>
      <svg width="24" height={totalH} className="block">
        {Array.from({ length: Math.floor(matchCount / 2) }, (_, pIdx) => {
          const sectionH = totalH / matchCount;
          const y1 = sectionH * (pIdx * 2) + sectionH / 2;
          const y2 = sectionH * (pIdx * 2 + 1) + sectionH / 2;
          const yMid = (y1 + y2) / 2;
          return (
            <path
              key={pIdx}
              d={`M 0 ${y1} H 12 V ${yMid} H 24 M 0 ${y2} H 12 V ${yMid}`}
              fill="none"
              stroke="#22C55E"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
    </div>
  );
};

// --- SINGLE ELIMINATION ---
const SingleEliminationPreview = ({ participantCount }) => {
  const bracketSize = nextPowerOf2(participantCount);
  const numRounds = calcRounds(bracketSize);
  const byes = bracketSize - participantCount;

  const rounds = [];
  for (let r = 0; r < numRounds; r++) {
    rounds.push({
      name: getRoundName(r, numRounds),
      matchCount: bracketSize / Math.pow(2, r + 1),
    });
  }

  const NODE_H = 32;
  const GAP = 10;
  const totalH = rounds[0].matchCount * (NODE_H + GAP);

  return (
    <div className="inline-flex items-start">
      {/* Seeded players column */}
      <div className="flex flex-col mr-1" style={{ minWidth: 60 }}>
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">Seeds</span>
        </div>
        <div className="flex flex-col justify-around" style={{ height: totalH }}>
          {Array.from({ length: bracketSize }, (_, i) => (
            <PlayerSlot key={i} label={i < participantCount ? `P${i + 1}` : 'BYE'} />
          ))}
        </div>
      </div>

      {/* Seed-to-R1 connector */}
      <div className="flex-shrink-0" style={{ width: 20, height: totalH, marginTop: 26 }}>
        <svg width="20" height={totalH} className="block">
          {Array.from({ length: rounds[0].matchCount }, (_, mIdx) => {
            const seedSectionH = totalH / bracketSize;
            const y1 = seedSectionH * (mIdx * 2) + seedSectionH / 2;
            const y2 = seedSectionH * (mIdx * 2 + 1) + seedSectionH / 2;
            const yMid = (y1 + y2) / 2;
            return (
              <path
                key={mIdx}
                d={`M 0 ${y1} H 10 V ${yMid} H 20 M 0 ${y2} H 10 V ${yMid}`}
                fill="none"
                stroke="#22C55E"
                strokeOpacity="0.25"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>

      {/* Round columns */}
      {rounds.map((round, rIdx) => (
        <div key={rIdx} className="flex items-start">
          <div className="flex flex-col" style={{ minWidth: 96 }}>
            <div className="text-center mb-2">
              <span className="text-[10px] font-semibold text-brand-green">{round.name}</span>
            </div>
            <div className="flex flex-col justify-around" style={{ height: totalH }}>
              {Array.from({ length: round.matchCount }, (_, mIdx) => (
                <MatchNode key={mIdx} label={`M${mIdx + 1}`} />
              ))}
            </div>
          </div>

          {/* Connector to next round */}
          {rIdx < rounds.length - 1 && (
            <BracketConnector matchCount={round.matchCount} totalH={totalH} />
          )}
        </div>
      ))}

      {/* Final connector + champion */}
      <div className="flex-shrink-0" style={{ width: 24, height: totalH, marginTop: 26 }}>
        <svg width="24" height={totalH} className="block">
          <line x1="0" y1={totalH / 2} x2="24" y2={totalH / 2} stroke="#22C55E" strokeOpacity="0.35" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="flex flex-col" style={{ minWidth: 80 }}>
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold text-brand-green opacity-0">.</span>
        </div>
        <div className="flex items-center justify-center" style={{ height: totalH }}>
          <ChampionNode />
        </div>
      </div>
    </div>
  );
};

// --- ROUND ROBIN ---
const RoundRobinPreview = ({ participantCount, entityLabel = 'Players' }) => {
  const count = Math.max(participantCount, 2);
  const prefix = entityLabel === 'Teams' ? 'T' : 'P';
  const schedule = generateRRSchedule(count);
  const totalRounds = schedule.length;
  // Show up to 5 rounds, then collapse
  const displayRounds = Math.min(totalRounds, 5);
  const matchesPerRound = schedule[0]?.length || 0;

  const NODE_H = 28;
  const GAP = 6;
  const totalH = Math.max(matchesPerRound * (NODE_H + GAP), 80);

  return (
    <div className="inline-flex items-start">
      {/* Player list column */}
      <div className="flex flex-col mr-1" style={{ minWidth: 56 }}>
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">{entityLabel}</span>
        </div>
        <div className="flex flex-col justify-around" style={{ height: totalH }}>
          {Array.from({ length: Math.min(count, 8) }, (_, i) => (
            <PlayerSlot key={i} label={`${prefix}${i + 1}`} />
          ))}
          {count > 8 && (
            <span className="text-[9px] text-gray-400 text-center mt-1">+{count - 8} more</span>
          )}
        </div>
      </div>

      {/* Connector lines from players to rounds */}
      <div className="flex-shrink-0 flex items-center" style={{ width: 20, marginTop: 26 }}>
        <svg width="20" height={totalH} className="block">
          {Array.from({ length: matchesPerRound }, (_, i) => {
            const y = (totalH / matchesPerRound) * i + (totalH / matchesPerRound) / 2;
            return <line key={i} x1="0" y1={y} x2="20" y2={y} stroke="#22C55E" strokeOpacity="0.2" strokeWidth="1" />;
          })}
        </svg>
      </div>

      {/* Round columns */}
      {schedule.slice(0, displayRounds).map((roundMatches, rIdx) => (
        <div key={rIdx} className="flex items-start">
          <div className="flex flex-col" style={{ minWidth: 88 }}>
            <div className="text-center mb-2">
              <span className="text-[10px] font-semibold text-brand-green">Round {rIdx + 1}</span>
            </div>
            <div className="flex flex-col justify-around" style={{ height: totalH }}>
              {roundMatches.map((m, mIdx) => (
                <div key={mIdx} className="glass-surface px-2 py-1 rounded-lg text-center border border-brand-green/30" style={{ minWidth: 80 }}>
                  <span className="text-[10px] font-medium text-brand-green">{prefix}{m.p1} vs {prefix}{m.p2}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Thin separator between rounds */}
          {rIdx < displayRounds - 1 && (
            <div className="flex-shrink-0 flex items-center" style={{ width: 12, marginTop: 26 }}>
              <svg width="12" height={totalH} className="block">
                {roundMatches.map((_, mIdx) => {
                  const y = (totalH / roundMatches.length) * mIdx + (totalH / roundMatches.length) / 2;
                  return <line key={mIdx} x1="0" y1={y} x2="12" y2={y} stroke="#22C55E" strokeOpacity="0.15" strokeWidth="1" />;
                })}
              </svg>
            </div>
          )}
        </div>
      ))}

      {/* More rounds indicator */}
      {totalRounds > displayRounds && (
        <div className="flex flex-col items-center justify-center ml-2" style={{ height: totalH, marginTop: 26 }}>
          <div className="glass-surface px-3 py-2 rounded-lg border border-gray-300/30 dark:border-gray-600/30">
            <span className="text-[10px] text-gray-400">+{totalRounds - displayRounds} more</span>
            <br />
            <span className="text-[10px] text-gray-400">rounds</span>
          </div>
        </div>
      )}

      {/* Arrow to standings */}
      <div className="flex-shrink-0 flex items-center" style={{ width: 24, marginTop: 26 }}>
        <svg width="24" height={totalH} className="block">
          <line x1="0" y1={totalH / 2} x2="24" y2={totalH / 2} stroke="#22C55E" strokeOpacity="0.35" strokeWidth="1.5" />
          <path d={`M 16 ${totalH / 2 - 4} L 24 ${totalH / 2} L 16 ${totalH / 2 + 4}`} fill="none" stroke="#22C55E" strokeOpacity="0.35" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Final standings */}
      <div className="flex flex-col" style={{ minWidth: 80 }}>
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold text-brand-green opacity-0">.</span>
        </div>
        <div className="flex flex-col items-center justify-center" style={{ height: totalH }}>
          <div className="glass-surface px-3 py-3 rounded-lg text-center border-2 border-brand-green/40 bg-brand-green/5">
            <Trophy size={18} className="text-brand-green mx-auto mb-1" />
            <p className="text-[10px] font-semibold text-brand-green">Final</p>
            <p className="text-[10px] font-semibold text-brand-green">Standings</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- GROUP KNOCKOUT ---
const GroupKnockoutPreview = ({ participantCount, numberOfGroups = 4, advancingPerGroup = 2 }) => {
  const groups = numberOfGroups;
  const playersPerGroup = Math.ceil(participantCount / groups);
  const advancingTotal = groups * advancingPerGroup;
  const koBracketSize = nextPowerOf2(advancingTotal);
  const koRounds = calcRounds(koBracketSize);

  const groupLabels = Array.from({ length: groups }, (_, i) => String.fromCharCode(65 + i));

  const GROUP_H = 52;
  const GROUP_GAP = 8;
  const groupsTotalH = groups * (GROUP_H + GROUP_GAP);

  const koMatchesR1 = koBracketSize / 2;
  const KO_NODE_H = 32;
  const KO_GAP = 10;
  const koTotalH = koMatchesR1 * (KO_NODE_H + KO_GAP);

  const totalH = Math.max(groupsTotalH, koTotalH);

  const koRoundData = [];
  for (let r = 0; r < koRounds; r++) {
    koRoundData.push({
      name: getRoundName(r, koRounds),
      matchCount: koBracketSize / Math.pow(2, r + 1),
    });
  }

  return (
    <div className="inline-flex items-start">
      {/* Group Stage */}
      <div className="flex flex-col" style={{ minWidth: 100 }}>
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold text-brand-blue uppercase tracking-wide">Group Stage</span>
        </div>
        <div className="flex flex-col justify-around" style={{ height: totalH }}>
          {groupLabels.map((letter) => (
            <div key={letter} className="glass-surface px-3 py-2 rounded-lg text-center border border-brand-blue/30" style={{ minWidth: 96 }}>
              <span className="text-xs font-bold text-brand-blue">Group {letter}</span>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">{playersPerGroup} players</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">{calcRoundRobinMatches(playersPerGroup)} matches</p>
            </div>
          ))}
        </div>
      </div>

      {/* Groups to knockout connector with label */}
      <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ width: 60, marginTop: 26 }}>
        <div className="relative" style={{ height: totalH }}>
          <svg width="60" height={totalH} className="block">
            {/* Lines from each group converging to center */}
            {groupLabels.map((_, gIdx) => {
              const gy = (totalH / groups) * gIdx + (totalH / groups) / 2;
              return (
                <path
                  key={gIdx}
                  d={`M 0 ${gy} H 20 V ${totalH / 2} H 60`}
                  fill="none"
                  stroke="#22C55E"
                  strokeOpacity="0.3"
                  strokeWidth="1.5"
                />
              );
            })}
            {/* Arrow head */}
            <path d={`M 52 ${totalH / 2 - 4} L 60 ${totalH / 2} L 52 ${totalH / 2 + 4}`} fill="none" stroke="#22C55E" strokeOpacity="0.4" strokeWidth="1.5" />
          </svg>
          {/* Label overlay */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-center" style={{ backgroundColor: 'var(--tw-bg-opacity, 1)' }}>
            <div className="glass-surface px-1.5 py-1 rounded">
              <span className="text-[9px] text-brand-green font-semibold block">Top {advancingPerGroup}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Knockout bracket rounds */}
      {koRoundData.map((round, rIdx) => (
        <div key={rIdx} className="flex items-start">
          <div className="flex flex-col" style={{ minWidth: 88 }}>
            <div className="text-center mb-2">
              <span className="text-[10px] font-semibold text-brand-green">{round.name}</span>
            </div>
            <div className="flex flex-col justify-around" style={{ height: totalH }}>
              {Array.from({ length: round.matchCount }, (_, mIdx) => (
                <MatchNode key={mIdx} label={`M${mIdx + 1}`} />
              ))}
            </div>
          </div>

          {rIdx < koRoundData.length - 1 && (
            <BracketConnector matchCount={round.matchCount} totalH={totalH} />
          )}
        </div>
      ))}

      {/* Champion */}
      <div className="flex-shrink-0" style={{ width: 24, height: totalH, marginTop: 26 }}>
        <svg width="24" height={totalH} className="block">
          <line x1="0" y1={totalH / 2} x2="24" y2={totalH / 2} stroke="#22C55E" strokeOpacity="0.35" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="flex flex-col" style={{ minWidth: 80 }}>
        <div className="text-center mb-2">
          <span className="text-[10px] font-semibold text-brand-green opacity-0">.</span>
        </div>
        <div className="flex items-center justify-center" style={{ height: totalH }}>
          <ChampionNode />
        </div>
      </div>
    </div>
  );
};

// --- DOUBLE ELIMINATION ---
const DoubleEliminationPreview = ({ participantCount }) => {
  const bracketSize = nextPowerOf2(participantCount);
  const winnersRounds = calcRounds(bracketSize);
  const losersRounds = Math.max(1, (winnersRounds - 1) * 2);

  const wRoundData = [];
  for (let r = 0; r < winnersRounds; r++) {
    wRoundData.push({
      name: getRoundName(r, winnersRounds),
      matchCount: bracketSize / Math.pow(2, r + 1),
    });
  }

  const lRoundData = [];
  for (let r = 0; r < losersRounds; r++) {
    const mc = Math.max(1, Math.ceil(bracketSize / Math.pow(2, Math.floor(r / 2) + 2)));
    lRoundData.push({ name: `LR${r + 1}`, matchCount: mc });
  }

  const W_NODE_H = 30;
  const W_GAP = 8;
  const wTotalH = wRoundData[0].matchCount * (W_NODE_H + W_GAP);

  const L_NODE_H = 28;
  const L_GAP = 6;
  const lTotalH = lRoundData[0].matchCount * (L_NODE_H + L_GAP);

  const displayLRounds = Math.min(losersRounds, 5);

  return (
    <div className="space-y-6">
      {/* Winners bracket */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />
          <span className="text-xs font-semibold text-brand-green">Winners Bracket</span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="inline-flex items-start">
            {wRoundData.map((round, rIdx) => (
              <div key={rIdx} className="flex items-start">
                <div className="flex flex-col" style={{ minWidth: 88 }}>
                  <div className="text-center mb-2">
                    <span className="text-[10px] font-semibold text-brand-green">{round.name}</span>
                  </div>
                  <div className="flex flex-col justify-around" style={{ height: wTotalH }}>
                    {Array.from({ length: round.matchCount }, (_, mIdx) => (
                      <MatchNode key={mIdx} label={`W${mIdx + 1}`} />
                    ))}
                  </div>
                </div>
                {rIdx < wRoundData.length - 1 && (
                  <BracketConnector matchCount={round.matchCount} totalH={wTotalH} />
                )}
              </div>
            ))}

            {/* Arrow to Grand Final */}
            <div className="flex-shrink-0" style={{ width: 24, height: wTotalH, marginTop: 26 }}>
              <svg width="24" height={wTotalH} className="block">
                <line x1="0" y1={wTotalH / 2} x2="24" y2={wTotalH / 2} stroke="#22C55E" strokeOpacity="0.35" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Grand Final + Champion */}
            <div className="flex flex-col" style={{ minWidth: 90 }}>
              <div className="text-center mb-2">
                <span className="text-[10px] font-semibold text-brand-green">Grand Final</span>
              </div>
              <div className="flex flex-col items-center justify-center" style={{ height: wTotalH }}>
                <div className="glass-surface px-3 py-2 rounded-lg text-center border-2 border-brand-green/40 bg-brand-green/5" style={{ minWidth: 80 }}>
                  <span className="text-[10px] font-bold text-brand-green">GF</span>
                </div>
                <div className="mt-2">
                  <Trophy size={16} className="text-brand-green mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Losers bracket */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs font-semibold text-amber-500">Losers Bracket</span>
          <span className="text-[10px] text-gray-400">({losersRounds} rounds → feeds into Grand Final)</span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="inline-flex items-start">
            {lRoundData.slice(0, displayLRounds).map((round, rIdx) => (
              <div key={rIdx} className="flex items-start">
                <div className="flex flex-col" style={{ minWidth: 80 }}>
                  <div className="text-center mb-2">
                    <span className="text-[10px] font-semibold text-amber-400">{round.name}</span>
                  </div>
                  <div className="flex flex-col justify-around" style={{ height: lTotalH }}>
                    {Array.from({ length: round.matchCount }, (_, mIdx) => (
                      <MatchNode key={mIdx} label={`L${mIdx + 1}`} accent="amber" />
                    ))}
                  </div>
                </div>
                {rIdx < displayLRounds - 1 && (
                  <div className="flex-shrink-0 flex items-center" style={{ width: 12, marginTop: 26 }}>
                    <svg width="12" height={lTotalH} className="block">
                      {Array.from({ length: round.matchCount }, (_, mIdx) => {
                        const y = (lTotalH / round.matchCount) * mIdx + (lTotalH / round.matchCount) / 2;
                        return <line key={mIdx} x1="0" y1={y} x2="12" y2={y} stroke="#F59E0B" strokeOpacity="0.25" strokeWidth="1" />;
                      })}
                    </svg>
                  </div>
                )}
              </div>
            ))}

            {losersRounds > displayLRounds && (
              <div className="flex flex-col items-center justify-center ml-2" style={{ height: lTotalH, marginTop: 26 }}>
                <div className="glass-surface px-3 py-2 rounded-lg border border-amber-500/20">
                  <span className="text-[10px] text-amber-400">+{losersRounds - displayLRounds} more</span>
                  <br />
                  <span className="text-[10px] text-amber-400">rounds</span>
                </div>
              </div>
            )}

            {/* Arrow up to grand final */}
            <div className="flex-shrink-0 flex items-center ml-2" style={{ width: 24, marginTop: 26 }}>
              <svg width="24" height={lTotalH} className="block">
                <path d={`M 0 ${lTotalH / 2} H 12 V 4 H 24`} fill="none" stroke="#F59E0B" strokeOpacity="0.35" strokeWidth="1.5" />
                <path d={`M 16 0 L 24 4 L 16 8`} fill="none" stroke="#F59E0B" strokeOpacity="0.35" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="flex flex-col" style={{ marginTop: 26 }}>
              <div className="glass-surface px-2 py-1 rounded text-center border border-amber-500/30">
                <span className="text-[9px] text-amber-400 font-medium">→ Grand Final</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const TournamentStructurePreview = ({ format, tournamentType, participantCount, maxParticipants, numberOfGroups, advancingPerGroup }) => {
  const count = participantCount || 0;

  if (count < 2) {
    return (
      <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Users size={20} className="text-brand-green" />
          Tournament Structure
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Structure preview will appear once at least 2 participants are registered.
        </p>
      </div>
    );
  }

  // Calculate stats per format
  const isTeamFormat = tournamentType === 'DOUBLES' || tournamentType === 'MIXED';
  const entityLabel = isTeamFormat ? 'Teams' : 'Players';
  const perEntityLabel = isTeamFormat ? 'Per Team' : 'Per Player';
  let stats = [];
  if (format === 'SINGLE_ELIMINATION') {
    const bracketSize = nextPowerOf2(count);
    const byes = bracketSize - count;
    stats = [
      { label: entityLabel, value: count },
      { label: 'Rounds', value: calcRounds(bracketSize) },
      { label: 'Matches', value: bracketSize - 1 },
    ];
    if (byes > 0) stats.push({ label: 'Byes', value: byes });
  } else if (format === 'DOUBLE_ELIMINATION') {
    const bracketSize = nextPowerOf2(count);
    stats = [
      { label: entityLabel, value: count },
      { label: 'W. Rounds', value: calcRounds(bracketSize) },
      { label: 'Matches', value: `${2 * bracketSize - 2}–${2 * bracketSize - 1}` },
    ];
  } else if (format === 'ROUND_ROBIN') {
    stats = [
      { label: entityLabel, value: count },
      { label: 'Rounds', value: calcRoundRobinRounds(count) },
      { label: 'Matches', value: calcRoundRobinMatches(count) },
      { label: perEntityLabel, value: count - 1 },
    ];
  } else if (format === 'GROUP_KNOCKOUT') {
    const groups = numberOfGroups || 4;
    const advancing = advancingPerGroup || 2;
    const ppg = Math.ceil(count / groups);
    const groupMatches = groups * calcRoundRobinMatches(ppg);
    const koTeams = groups * advancing;
    stats = [
      { label: 'Groups', value: groups },
      { label: 'Per Group', value: ppg },
      { label: 'Group Matches', value: groupMatches },
      { label: 'KO Matches', value: nextPowerOf2(koTeams) - 1 },
    ];
  }

  return (
    <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Users size={20} className="text-brand-green" />
        Tournament Structure
      </h2>

      {/* Stats */}
      <div className="flex flex-wrap gap-2 mb-5">
        {stats.map((s) => (
          <StatPill key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {/* Visualization */}
      <div className="overflow-x-auto pb-2">
        {format === 'SINGLE_ELIMINATION' && <SingleEliminationPreview participantCount={count} />}
        {format === 'DOUBLE_ELIMINATION' && <DoubleEliminationPreview participantCount={count} />}
        {format === 'ROUND_ROBIN' && <RoundRobinPreview participantCount={count} entityLabel={entityLabel} />}
        {format === 'GROUP_KNOCKOUT' && (
          <GroupKnockoutPreview participantCount={count} numberOfGroups={numberOfGroups} advancingPerGroup={advancingPerGroup} />
        )}
      </div>
    </div>
  );
};

export default TournamentStructurePreview;
