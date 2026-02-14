const { prisma } = require('../config/database');

/**
 * Calculate the next power of 2 for bye handling
 */
function nextPowerOf2(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Calculate number of byes needed
 */
function calculateByes(participantCount) {
  const nextPower = nextPowerOf2(participantCount);
  return nextPower - participantCount;
}

/**
 * Seed participants based on method
 * @param {Array} participants - Array of team objects
 * @param {String} method - RANDOM, RANKING_BASED, or MANUAL
 * @returns {Array} - Seeded participants
 */
async function seedParticipants(participants, method) {
  let seededParticipants = [...participants];

  switch (method) {
    case 'RANDOM':
      // Shuffle randomly
      for (let i = seededParticipants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seededParticipants[i], seededParticipants[j]] = [seededParticipants[j], seededParticipants[i]];
      }
      break;

    case 'RANKING_BASED':
      // Sort by player rankings (requires player statistics)
      // For teams, use average ranking of both players
      const teamsWithRankings = await Promise.all(
        seededParticipants.map(async (team) => {
          const player1Stats = await prisma.playerStatistics.findUnique({
            where: { userId: team.player1Id },
          });
          const player2Stats = await prisma.playerStatistics.findUnique({
            where: { userId: team.player2Id },
          });

          const avgRanking =
            ((player1Stats?.rankingPoints || 1000) + (player2Stats?.rankingPoints || 1000)) / 2;

          return { ...team, avgRanking };
        })
      );

      // Sort by ranking (higher ranking points = better)
      seededParticipants = teamsWithRankings.sort((a, b) => b.avgRanking - a.avgRanking);
      break;

    case 'MANUAL':
      // Use existing seed numbers from teams
      seededParticipants.sort((a, b) => (a.seedNumber || 9999) - (b.seedNumber || 9999));
      break;
  }

  // Assign seed numbers
  seededParticipants.forEach((team, index) => {
    team.seedNumber = index + 1;
  });

  return seededParticipants;
}

/**
 * Generate single elimination bracket using strategic seeding
 * 1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15
 */
async function generateSingleEliminationBracket(tournamentId, participants, seedingMethod) {
  const seededParticipants = await seedParticipants(participants, seedingMethod);
  const totalSlots = nextPowerOf2(seededParticipants.length);
  const numByes = calculateByes(seededParticipants.length);
  const numRounds = Math.log2(totalSlots);

  // Standard seeding order for single elimination
  const seedingOrder = generateSeedingOrder(totalSlots);

  // Create bracket structure
  const bracketNodes = [];
  const matchesToCreate = [];

  // Round 1: Create matches or byes
  const round1Positions = totalSlots / 2;
  for (let position = 0; position < round1Positions; position++) {
    const seed1 = seedingOrder[position * 2];
    const seed2 = seedingOrder[position * 2 + 1];

    const team1 = seed1 <= seededParticipants.length ? seededParticipants[seed1 - 1] : null;
    const team2 = seed2 <= seededParticipants.length ? seededParticipants[seed2 - 1] : null;

    // Create bracket node
    const node = {
      tournamentId,
      roundNumber: 1,
      position,
      bracketType: 'MAIN',
      seedNumber: position + 1,
    };

    // If both teams exist, create a match
    if (team1 && team2) {
      matchesToCreate.push({
        node,
        team1Id: team1.id,
        team2Id: team2.id,
        round: 'Round 1',
      });
    } else if (team1 && !team2) {
      // Team1 gets a bye - create node with just team1 advancing
      node.byeTeamId = team1.id;
    } else if (!team1 && team2) {
      // Team2 gets a bye
      node.byeTeamId = team2.id;
    }

    bracketNodes.push(node);
  }

  // Create subsequent rounds (empty nodes that will be filled as matches complete)
  for (let round = 2; round <= numRounds; round++) {
    const roundPositions = Math.pow(2, numRounds - round);
    for (let position = 0; position < roundPositions; position++) {
      bracketNodes.push({
        tournamentId,
        roundNumber: round,
        position,
        bracketType: 'MAIN',
      });
    }
  }

  // Connect nodes (determine which node winner advances to)
  bracketNodes.forEach((node, index) => {
    if (node.roundNumber < numRounds) {
      // Find the next node this winner advances to
      const nextRoundPosition = Math.floor(node.position / 2);
      const nextNode = bracketNodes.find(
        (n) => n.roundNumber === node.roundNumber + 1 && n.position === nextRoundPosition
      );

      if (nextNode) {
        node.nextNodeIndex = bracketNodes.indexOf(nextNode);
      }
    }
  });

  return { bracketNodes, matchesToCreate };
}

/**
 * Generate standard seeding order for tournament
 * For 16 participants: [1,16,8,9,5,12,4,13,3,14,6,11,7,10,2,15]
 */
function generateSeedingOrder(totalSlots) {
  if (totalSlots === 2) return [1, 2];

  const previousOrder = generateSeedingOrder(totalSlots / 2);
  const newOrder = [];

  previousOrder.forEach((seed) => {
    newOrder.push(seed);
    newOrder.push(totalSlots + 1 - seed);
  });

  return newOrder;
}

/**
 * Generate double elimination bracket
 * Creates both winners and losers brackets
 */
async function generateDoubleEliminationBracket(tournamentId, participants, seedingMethod) {
  const seededParticipants = await seedParticipants(participants, seedingMethod);
  const totalSlots = nextPowerOf2(seededParticipants.length);
  const numRounds = Math.log2(totalSlots);

  const bracketNodes = [];
  const matchesToCreate = [];

  // Generate winners bracket (same as single elimination)
  const seedingOrder = generateSeedingOrder(totalSlots);

  // Winners Bracket - Round 1
  const winnersRound1Positions = totalSlots / 2;
  for (let position = 0; position < winnersRound1Positions; position++) {
    const seed1 = seedingOrder[position * 2];
    const seed2 = seedingOrder[position * 2 + 1];

    const team1 = seed1 <= seededParticipants.length ? seededParticipants[seed1 - 1] : null;
    const team2 = seed2 <= seededParticipants.length ? seededParticipants[seed2 - 1] : null;

    const node = {
      tournamentId,
      roundNumber: 1,
      position,
      bracketType: 'WINNERS',
      seedNumber: position + 1,
    };

    if (team1 && team2) {
      matchesToCreate.push({
        node,
        team1Id: team1.id,
        team2Id: team2.id,
        round: 'Winners Round 1',
      });
    } else if (team1 || team2) {
      node.byeTeamId = team1?.id || team2?.id;
    }

    bracketNodes.push(node);
  }

  // Winners Bracket - Subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const roundPositions = Math.pow(2, numRounds - round);
    for (let position = 0; position < roundPositions; position++) {
      bracketNodes.push({
        tournamentId,
        roundNumber: round,
        position,
        bracketType: 'WINNERS',
      });
    }
  }

  // Losers Bracket - Has (2 * numRounds - 1) rounds
  const losersRounds = 2 * numRounds - 1;
  for (let round = 1; round <= losersRounds; round++) {
    // Losers bracket is more complex - alternates between drops from winners and losers playing
    const roundPositions = calculateLosersBracketPositions(round, numRounds);
    for (let position = 0; position < roundPositions; position++) {
      bracketNodes.push({
        tournamentId,
        roundNumber: round,
        position,
        bracketType: 'LOSERS',
      });
    }
  }

  // Grand Finals
  bracketNodes.push({
    tournamentId,
    roundNumber: 1,
    position: 0,
    bracketType: 'GRAND_FINALS',
  });

  return { bracketNodes, matchesToCreate };
}

/**
 * Calculate number of positions in losers bracket round
 */
function calculateLosersBracketPositions(round, winnersRounds) {
  if (round === 1) {
    return Math.pow(2, winnersRounds - 2);
  }
  if (round % 2 === 0) {
    // Even rounds: losers from winners bracket
    return Math.pow(2, winnersRounds - Math.ceil(round / 2) - 1);
  }
  // Odd rounds: losers playing against each other
  return Math.pow(2, winnersRounds - Math.ceil((round + 1) / 2) - 1);
}

/**
 * Generate round robin bracket using the circle method
 * Each player appears exactly once per round
 */
async function generateRoundRobinBracket(tournamentId, participants, seedingMethod) {
  const seededParticipants = await seedParticipants(participants, seedingMethod);
  let n = seededParticipants.length;

  if (n < 2) {
    return { bracketNodes: [], matchesToCreate: [] };
  }

  const bracketNodes = [];
  const matchesToCreate = [];

  // Circle method for round robin scheduling
  // If odd number of players, add a "bye" placeholder
  const players = [...seededParticipants];
  const hasBye = n % 2 !== 0;
  if (hasBye) {
    players.push(null); // null represents a bye
    n = players.length;
  }

  const numRounds = n - 1;
  const matchesPerRound = n / 2;

  // Circle method: fix first player, rotate the rest
  for (let round = 0; round < numRounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = match;
      const away = n - 1 - match;

      // Get actual player indices after rotation
      const homeIdx = home === 0 ? 0 : ((home - 1 + round) % (n - 1)) + 1;
      const awayIdx = away === 0 ? 0 : ((away - 1 + round) % (n - 1)) + 1;

      const team1 = players[homeIdx];
      const team2 = players[awayIdx];

      // Skip if either team is a bye (null)
      if (team1 === null || team2 === null) {
        continue;
      }

      const roundNumber = round + 1;

      const node = {
        tournamentId,
        roundNumber,
        position: match,
        bracketType: 'MAIN',
      };

      matchesToCreate.push({
        node,
        team1Id: team1.id,
        team2Id: team2.id,
        round: `Round ${roundNumber}`,
      });

      bracketNodes.push(node);
    }
  }

  return { bracketNodes, matchesToCreate };
}

/**
 * Get group name from index (A, B, C, ...)
 */
function getGroupName(index) {
  return String.fromCharCode(65 + index); // 65 is ASCII for 'A'
}

/**
 * Get bracket type for a group
 */
function getGroupBracketType(groupIndex) {
  const types = ['GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D', 'GROUP_E', 'GROUP_F', 'GROUP_G', 'GROUP_H'];
  return types[groupIndex] || 'MAIN';
}

/**
 * Distribute participants into groups using snake seeding
 * Snake seeding ensures balanced groups: 1,2,3,4 -> A,B,C,D then 5,6,7,8 -> D,C,B,A
 */
function distributeIntoGroups(participants, numberOfGroups) {
  const groups = Array.from({ length: numberOfGroups }, () => []);

  participants.forEach((participant, index) => {
    const round = Math.floor(index / numberOfGroups);
    let groupIndex;

    if (round % 2 === 0) {
      // Forward: 0, 1, 2, 3
      groupIndex = index % numberOfGroups;
    } else {
      // Backward (snake): 3, 2, 1, 0
      groupIndex = numberOfGroups - 1 - (index % numberOfGroups);
    }

    groups[groupIndex].push(participant);
  });

  return groups;
}

/**
 * Generate group stage bracket with round robin within each group
 * Uses manual group assignments from registrations if available, otherwise snake seeding
 */
async function generateGroupStageBracket(tournamentId, participants, seedingMethod, numberOfGroups, advancingPerGroup, registrations = []) {
  const seededParticipants = await seedParticipants(participants, seedingMethod);
  const n = seededParticipants.length;

  if (n < numberOfGroups * 2) {
    throw new Error(`Need at least ${numberOfGroups * 2} participants for ${numberOfGroups} groups`);
  }

  // Check if there are any manual group assignments
  const hasManualAssignments = registrations.some((reg) => reg.groupAssignment);

  let groups;
  if (hasManualAssignments) {
    // Use manual assignments - create a map from userId to groupAssignment
    const userGroupMap = {};
    registrations.forEach((reg) => {
      if (reg.groupAssignment) {
        userGroupMap[reg.userId] = reg.groupAssignment;
      }
    });

    // Initialize groups
    groups = Array.from({ length: numberOfGroups }, () => []);

    // Assign participants based on manual assignments
    const unassigned = [];
    seededParticipants.forEach((team) => {
      // For singles, player1Id is the user; for doubles, check both players
      const groupName = userGroupMap[team.player1Id] || userGroupMap[team.player2Id];
      if (groupName) {
        const groupIndex = groupName.charCodeAt(0) - 65; // A=0, B=1, etc.
        if (groupIndex >= 0 && groupIndex < numberOfGroups) {
          groups[groupIndex].push(team);
        } else {
          unassigned.push(team);
        }
      } else {
        unassigned.push(team);
      }
    });

    // Distribute unassigned participants using snake seeding
    if (unassigned.length > 0) {
      // Count current group sizes
      const groupSizes = groups.map((g) => g.length);
      const avgSize = Math.ceil(seededParticipants.length / numberOfGroups);

      unassigned.forEach((team) => {
        // Find the group with the fewest members
        let minIndex = 0;
        let minSize = groupSizes[0];
        for (let i = 1; i < numberOfGroups; i++) {
          if (groupSizes[i] < minSize) {
            minSize = groupSizes[i];
            minIndex = i;
          }
        }
        groups[minIndex].push(team);
        groupSizes[minIndex]++;
      });
    }
  } else {
    // No manual assignments - use snake seeding
    groups = distributeIntoGroups(seededParticipants, numberOfGroups);
  }

  const bracketNodes = [];
  const matchesToCreate = [];
  const teamUpdates = []; // Track team group assignments

  // Generate round robin matches within each group
  for (let groupIndex = 0; groupIndex < numberOfGroups; groupIndex++) {
    const groupParticipants = groups[groupIndex];
    const groupName = getGroupName(groupIndex);
    const bracketType = getGroupBracketType(groupIndex);
    const groupSize = groupParticipants.length;

    // Track team group assignments
    groupParticipants.forEach((team) => {
      teamUpdates.push({ teamId: team.id, groupName });
    });

    // Generate round robin for this group using circle method
    // This ensures each player plays exactly once per round
    const participants = [...groupParticipants];
    const numParticipants = participants.length;

    // If odd number, add a "bye" placeholder
    if (numParticipants % 2 === 1) {
      participants.push(null); // bye
    }

    const n = participants.length;
    const numRounds = n - 1;
    const matchesPerRound = n / 2;

    // Circle method: fix first participant, rotate the rest
    for (let round = 0; round < numRounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const home = match === 0 ? 0 : (n - 1 - ((round + match - 1) % (n - 1)));
        const away = (round + match) % (n - 1) + 1;

        // Simplified pairing using rotation
        let homeIdx, awayIdx;
        if (match === 0) {
          homeIdx = 0;
          awayIdx = (round % (n - 1)) + 1;
        } else {
          homeIdx = ((round + match) % (n - 1)) + 1;
          awayIdx = ((round + n - 1 - match) % (n - 1)) + 1;
        }

        const team1 = participants[homeIdx];
        const team2 = participants[awayIdx];

        // Skip if either team is a bye (null)
        if (!team1 || !team2) continue;

        const node = {
          tournamentId,
          roundNumber: round + 1,
          position: match,
          bracketType,
        };

        matchesToCreate.push({
          node,
          team1Id: team1.id,
          team2Id: team2.id,
          round: `Group ${groupName} - Round ${round + 1}`,
        });

        bracketNodes.push(node);
      }
    }
  }

  return { bracketNodes, matchesToCreate, teamUpdates, groups };
}

/**
 * Generate knockout bracket from group stage winners
 * Called when group stage is complete
 */
async function generateKnockoutFromGroups(tournamentId) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: true,
      matches: {
        include: {
          team1: true,
          team2: true,
        },
      },
    },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Note: groupStageComplete check is done in completeGroupStage() which calls this function
  // The flag gets set AFTER this function returns, so we don't check it here

  const numberOfGroups = tournament.numberOfGroups;
  const advancingPerGroup = tournament.advancingPerGroup || 2;

  // Calculate standings for each group
  const groupStandings = {};

  // Initialize groups
  tournament.teams.forEach((team) => {
    if (team.groupName) {
      if (!groupStandings[team.groupName]) {
        groupStandings[team.groupName] = {};
      }
      groupStandings[team.groupName][team.id] = {
        team,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
    }
  });

  // Calculate stats from completed group matches
  tournament.matches.forEach((match) => {
    if (match.matchStatus !== 'COMPLETED' || !match.winnerId) return;

    const team1 = match.team1;
    const team2 = match.team2;

    if (!team1?.groupName || !team2?.groupName) return;
    if (team1.groupName !== team2.groupName) return; // Only group matches

    const groupName = team1.groupName;
    const stats1 = groupStandings[groupName]?.[team1.id];
    const stats2 = groupStandings[groupName]?.[team2.id];

    if (!stats1 || !stats2) return;

    if (match.winnerId === team1.id) {
      stats1.wins++;
      stats2.losses++;
    } else {
      stats2.wins++;
      stats1.losses++;
    }

    // Add game/point stats if available
    if (match.team1Score?.games && match.team2Score?.games) {
      match.team1Score.games.forEach((score, idx) => {
        const team2Score = match.team2Score.games[idx];
        stats1.pointsFor += score;
        stats1.pointsAgainst += team2Score;
        stats2.pointsFor += team2Score;
        stats2.pointsAgainst += score;

        if (score > team2Score) {
          stats1.gamesWon++;
          stats2.gamesLost++;
        } else {
          stats2.gamesWon++;
          stats1.gamesLost++;
        }
      });
    }
  });

  // Get top teams from each group
  const knockoutParticipants = [];

  Object.keys(groupStandings).sort().forEach((groupName) => {
    const groupTeams = Object.values(groupStandings[groupName]);

    // Sort by wins, then games won, then point differential
    groupTeams.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      const aDiff = a.pointsFor - a.pointsAgainst;
      const bDiff = b.pointsFor - b.pointsAgainst;
      return bDiff - aDiff;
    });

    // Take top N teams from this group
    for (let i = 0; i < advancingPerGroup && i < groupTeams.length; i++) {
      knockoutParticipants.push({
        ...groupTeams[i].team,
        groupRank: i + 1,
        fromGroup: groupName,
      });
    }
  });

  if (knockoutParticipants.length < 2) {
    throw new Error('Not enough teams qualified for knockout stage');
  }

  // Arrange knockout seeding: 1A vs 2B, 1B vs 2A, etc. (for 2 groups)
  // For more groups, use standard bracket seeding
  const totalSlots = nextPowerOf2(knockoutParticipants.length);
  const seedingOrder = generateSeedingOrder(totalSlots);

  // Sort knockout participants: alternating group winners then runners-up
  // This ensures 1A meets 2B, 1B meets 2A pattern
  knockoutParticipants.sort((a, b) => {
    if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank;
    return a.fromGroup.localeCompare(b.fromGroup);
  });

  // Generate single elimination bracket for knockout
  const numRounds = Math.log2(totalSlots);
  const bracketNodes = [];
  const matchesToCreate = [];

  // Round 1
  const round1Positions = totalSlots / 2;
  for (let position = 0; position < round1Positions; position++) {
    const seed1 = seedingOrder[position * 2];
    const seed2 = seedingOrder[position * 2 + 1];

    const team1 = seed1 <= knockoutParticipants.length ? knockoutParticipants[seed1 - 1] : null;
    const team2 = seed2 <= knockoutParticipants.length ? knockoutParticipants[seed2 - 1] : null;

    const node = {
      tournamentId,
      roundNumber: 1,
      position,
      bracketType: 'KNOCKOUT',
      seedNumber: position + 1,
    };

    if (team1 && team2) {
      matchesToCreate.push({
        node,
        team1Id: team1.id,
        team2Id: team2.id,
        round: getRoundName(1, numRounds),
      });
    } else if (team1 && !team2) {
      node.byeTeamId = team1.id;
    } else if (!team1 && team2) {
      node.byeTeamId = team2.id;
    }

    bracketNodes.push(node);
  }

  // Subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const roundPositions = Math.pow(2, numRounds - round);
    for (let position = 0; position < roundPositions; position++) {
      bracketNodes.push({
        tournamentId,
        roundNumber: round,
        position,
        bracketType: 'KNOCKOUT',
      });
    }
  }

  // Connect nodes
  bracketNodes.forEach((node) => {
    if (node.roundNumber < numRounds) {
      const nextRoundPosition = Math.floor(node.position / 2);
      const nextNode = bracketNodes.find(
        (n) => n.roundNumber === node.roundNumber + 1 && n.position === nextRoundPosition
      );
      if (nextNode) {
        node.nextNodeIndex = bracketNodes.indexOf(nextNode);
      }
    }
  });

  // Process byes - create matches for subsequent rounds where bye teams advance
  // This handles the case where 5 teams qualify and 3 get byes
  const processedRounds = new Set();
  for (let round = 1; round < numRounds; round++) {
    const roundNodes = bracketNodes.filter(n => n.roundNumber === round);
    const nextRoundNodes = bracketNodes.filter(n => n.roundNumber === round + 1);

    for (const nextNode of nextRoundNodes) {
      // Find the two nodes that feed into this next node
      const feedingNodes = roundNodes.filter(n => {
        const nextRoundPosition = Math.floor(n.position / 2);
        return nextRoundPosition === nextNode.position;
      });

      if (feedingNodes.length !== 2) continue;

      // Check if either or both are byes
      const byeTeams = feedingNodes.filter(n => n.byeTeamId).map(n => n.byeTeamId);
      const matchNodes = feedingNodes.filter(n => !n.byeTeamId);

      if (byeTeams.length === 2) {
        // Both are byes - create a match between them for the next round
        matchesToCreate.push({
          node: nextNode,
          team1Id: byeTeams[0],
          team2Id: byeTeams[1],
          round: getRoundName(round + 1, numRounds),
        });
      } else if (byeTeams.length === 1 && matchNodes.length === 1) {
        // One bye, one match - the bye team advances and waits for match winner
        // Create a placeholder match for the next round with the bye team
        nextNode.byeAdvanceTeamId = byeTeams[0];
      }
    }
  }

  return { bracketNodes, matchesToCreate, knockoutParticipants };
}

/**
 * Get round name for knockout stage
 */
function getRoundName(round, totalRounds) {
  const remaining = Math.pow(2, totalRounds - round + 1);
  if (remaining === 2) return 'Final';
  if (remaining === 4) return 'Semi-Final';
  if (remaining === 8) return 'Quarter-Final';
  return `Round of ${remaining}`;
}

/**
 * Main function to generate bracket for a tournament
 */
async function generateBracket(tournamentId, format, seedingMethod = 'RANDOM') {
  try {
    // Get tournament and approved teams
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: true,
        registrations: {
          where: { registrationStatus: 'APPROVED' },
          include: { user: true },
        },
      },
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Check if bracket already generated
    if (tournament.bracketGenerated) {
      throw new Error('Bracket already generated for this tournament');
    }

    // Get participants (teams for doubles/mixed, create solo teams for singles)
    let participants = tournament.teams;

    // If singles tournament and no teams, create teams from registrations
    if (tournament.tournamentType === 'SINGLES' && participants.length === 0) {
      participants = await Promise.all(
        tournament.registrations.map(async (reg) => {
          return await prisma.team.create({
            data: {
              tournamentId,
              player1Id: reg.userId,
              player2Id: reg.userId, // Same player for both fields in singles
              teamName: reg.user.fullName || reg.user.username,
            },
          });
        })
      );
    }

    // If doubles/mixed tournament and no teams, create teams from registrations with partners
    if ((tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && participants.length === 0) {
      // Get registrations that have partners
      const pairedRegistrations = tournament.registrations.filter(reg => reg.partnerId);
      const processedUserIds = new Set();
      const teamsToCreate = [];

      for (const reg of pairedRegistrations) {
        // Skip if already processed (either as player1 or player2)
        if (processedUserIds.has(reg.userId)) continue;

        // Find partner's registration
        const partnerReg = tournament.registrations.find(r => r.userId === reg.partnerId);
        if (!partnerReg) continue;

        // Mark both as processed
        processedUserIds.add(reg.userId);
        processedUserIds.add(reg.partnerId);

        const player1Name = reg.user?.fullName || reg.user?.username || 'Player';
        const player2Name = partnerReg.user?.fullName || partnerReg.user?.username || 'Player';

        teamsToCreate.push({
          tournamentId,
          player1Id: reg.userId,
          player2Id: reg.partnerId,
          teamName: `${player1Name} & ${player2Name}`,
        });
      }

      // Auto-pair remaining unpartnered registrations
      const unpairedRegistrations = tournament.registrations.filter(
        reg => !processedUserIds.has(reg.userId)
      );

      if (unpairedRegistrations.length >= 2) {
        // Shuffle randomly
        const shuffled = [...unpairedRegistrations].sort(() => Math.random() - 0.5);

        // Pair them up
        for (let i = 0; i < shuffled.length - 1; i += 2) {
          const reg1 = shuffled[i];
          const reg2 = shuffled[i + 1];

          processedUserIds.add(reg1.userId);
          processedUserIds.add(reg2.userId);

          const player1Name = reg1.user?.fullName || reg1.user?.username || 'Player';
          const player2Name = reg2.user?.fullName || reg2.user?.username || 'Player';

          teamsToCreate.push({
            tournamentId,
            player1Id: reg1.userId,
            player2Id: reg2.userId,
            teamName: `${player1Name} & ${player2Name}`,
          });
        }
      }

      if (teamsToCreate.length > 0) {
        participants = await Promise.all(
          teamsToCreate.map(async (teamData) => {
            return await prisma.team.create({ data: teamData });
          })
        );
      }
    }

    if (participants.length < 2) {
      throw new Error('Need at least 2 participants to generate bracket');
    }

    // Generate bracket based on format
    let bracketData;
    switch (format) {
      case 'SINGLE_ELIMINATION':
        bracketData = await generateSingleEliminationBracket(tournamentId, participants, seedingMethod);
        break;
      case 'DOUBLE_ELIMINATION':
        bracketData = await generateDoubleEliminationBracket(tournamentId, participants, seedingMethod);
        break;
      case 'ROUND_ROBIN':
        bracketData = await generateRoundRobinBracket(tournamentId, participants, seedingMethod);
        break;
      case 'GROUP_KNOCKOUT':
        const numberOfGroups = tournament.numberOfGroups || Math.min(4, Math.floor(participants.length / 2));
        const advancingPerGroup = tournament.advancingPerGroup || 2;
        bracketData = await generateGroupStageBracket(
          tournamentId,
          participants,
          seedingMethod,
          numberOfGroups,
          advancingPerGroup,
          tournament.registrations // Pass registrations for manual group assignments
        );
        break;
      default:
        throw new Error(`Unsupported tournament format: ${format}`);
    }

    // Create bracket nodes and matches in transaction
    // Increase timeout to 30 seconds for large tournaments
    const result = await prisma.$transaction(async (tx) => {
      // For GROUP_KNOCKOUT, update team group assignments first
      if (bracketData.teamUpdates) {
        for (const update of bracketData.teamUpdates) {
          await tx.team.update({
            where: { id: update.teamId },
            data: { groupName: update.groupName },
          });
        }
      }

      // Create all bracket nodes first
      const createdNodes = [];
      for (const nodeData of bracketData.bracketNodes) {
        const { nextNodeIndex, byeTeamId, ...nodeCreateData } = nodeData;
        const node = await tx.bracketNode.create({
          data: nodeCreateData,
        });
        createdNodes.push({ ...node, nextNodeIndex, byeTeamId });
      }

      // Create matches and link to bracket nodes
      for (const matchData of bracketData.matchesToCreate) {
        const { node: nodeRef, ...matchCreateData } = matchData;

        // Find the created node
        const nodeIndex = bracketData.bracketNodes.findIndex(
          (n) =>
            n.roundNumber === nodeRef.roundNumber &&
            n.position === nodeRef.position &&
            n.bracketType === nodeRef.bracketType
        );

        const createdNode = createdNodes[nodeIndex];

        // Create match
        const match = await tx.match.create({
          data: {
            ...matchCreateData,
            tournamentId,
            matchStatus: 'UPCOMING',
          },
        });

        // Update bracket node with match reference
        await tx.bracketNode.update({
          where: { id: createdNode.id },
          data: { matchId: match.id },
        });
      }

      // Update bracket node connections (nextNodeId)
      for (let i = 0; i < createdNodes.length; i++) {
        const node = createdNodes[i];
        if (node.nextNodeIndex !== undefined) {
          const nextNode = createdNodes[node.nextNodeIndex];
          await tx.bracketNode.update({
            where: { id: node.id },
            data: { nextNodeId: nextNode.id },
          });
        }
      }

      // Mark bracket as generated
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          bracketGenerated: true,
          bracketGeneratedAt: new Date(),
        },
      });

      return { nodes: createdNodes };
    }, { timeout: 30000 }); // 30 second timeout for large tournaments

    return {
      success: true,
      message: 'Bracket generated successfully',
      data: result,
    };
  } catch (error) {
    console.error('Error generating bracket:', error);
    throw error;
  }
}

/**
 * Create 3rd place match when both semi-finals are completed
 */
async function createThirdPlaceMatchIfReady(tournamentId) {
  try {
    // Check if 3rd place match already exists
    const existingThirdPlaceMatch = await prisma.match.findFirst({
      where: {
        tournamentId,
        round: '3rd Place',
      },
    });

    if (existingThirdPlaceMatch) {
      console.log('3rd place match already exists');
      return null;
    }

    // Find all semi-final matches for this tournament
    const semiMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        round: 'Semi-Final',
        matchStatus: 'COMPLETED',
      },
      include: {
        team1: true,
        team2: true,
      },
    });

    // Need exactly 2 completed semi-finals to create 3rd place match
    if (semiMatches.length !== 2) {
      console.log(`Only ${semiMatches.length} semi-finals completed, need 2`);
      return null;
    }

    // Get the losers from each semi-final
    const losers = semiMatches.map((match) => {
      return match.winnerId === match.team1Id ? match.team2Id : match.team1Id;
    });

    if (losers.length !== 2 || !losers[0] || !losers[1]) {
      console.log('Could not determine semi-final losers');
      return null;
    }

    // Create the 3rd place match
    const thirdPlaceMatch = await prisma.match.create({
      data: {
        tournamentId,
        team1Id: losers[0],
        team2Id: losers[1],
        round: '3rd Place',
        matchStatus: 'UPCOMING',
      },
      include: {
        team1: {
          include: {
            player1: { select: { id: true, username: true, fullName: true } },
            player2: { select: { id: true, username: true, fullName: true } },
          },
        },
        team2: {
          include: {
            player1: { select: { id: true, username: true, fullName: true } },
            player2: { select: { id: true, username: true, fullName: true } },
          },
        },
      },
    });

    console.log(`3rd place match created: ${thirdPlaceMatch.id}`);
    return thirdPlaceMatch;
  } catch (error) {
    console.error('Error creating 3rd place match:', error);
    // Don't throw - this is an optional enhancement
    return null;
  }
}

/**
 * Advance winner to next bracket node
 * Called when a match is completed
 */
async function advanceWinner(matchId, winnerId) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        bracketNode: {
          include: {
            nextNode: true,
            loserNextNode: true,
          },
        },
        tournament: true,
      },
    });

    if (!match || !match.bracketNode) {
      throw new Error('Match or bracket node not found');
    }

    const { bracketNode } = match;
    const loserId = winnerId === match.team1Id ? match.team2Id : match.team1Id;

    // Advance winner to next node
    if (bracketNode.nextNode) {
      let nextMatch = null;

      if (bracketNode.nextNode.matchId) {
        nextMatch = await prisma.match.findUnique({
          where: { id: bracketNode.nextNode.matchId },
        });
      }

      if (nextMatch) {
        // Determine if winner goes to team1 or team2 slot
        const updateData = nextMatch.team1Id ? { team2Id: winnerId } : { team1Id: winnerId };

        await prisma.match.update({
          where: { id: nextMatch.id },
          data: updateData,
        });
      } else {
        // No match exists for the next node yet - create it
        // Determine round name based on bracket structure
        const nextNode = bracketNode.nextNode;
        const totalKnockoutNodes = await prisma.bracketNode.count({
          where: {
            tournamentId: match.tournamentId,
            bracketType: nextNode.bracketType,
          },
        });
        const numRounds = Math.ceil(Math.log2(totalKnockoutNodes + 1));
        const roundName = getRoundName(nextNode.roundNumber, numRounds);

        // Create the next match with the winner as team1
        const newMatch = await prisma.match.create({
          data: {
            tournamentId: match.tournamentId,
            team1Id: winnerId,
            round: roundName,
            matchStatus: 'UPCOMING',
          },
        });

        // Link the match to the bracket node
        await prisma.bracketNode.update({
          where: { id: nextNode.id },
          data: { matchId: newMatch.id },
        });
      }
    }

    // For double elimination, advance loser to losers bracket
    if (bracketNode.bracketType === 'WINNERS' && bracketNode.loserNextNode) {
      const loserNextMatch = await prisma.match.findUnique({
        where: { id: bracketNode.loserNextNode.matchId },
      });

      if (loserNextMatch) {
        const updateData = loserNextMatch.team1Id ? { team2Id: loserId } : { team1Id: loserId };

        await prisma.match.update({
          where: { id: loserNextMatch.id },
          data: updateData,
        });
      }
    }

    // Check if this was a Semi-Final and create 3rd Place Match
    if (match.round === 'Semi-Final') {
      await createThirdPlaceMatchIfReady(match.tournamentId);
    }

    return {
      success: true,
      message: 'Winner advanced successfully',
    };
  } catch (error) {
    console.error('Error advancing winner:', error);
    throw error;
  }
}

/**
 * Complete group stage and generate knockout bracket
 */
async function completeGroupStage(tournamentId) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.format !== 'GROUP_KNOCKOUT') {
      throw new Error('Tournament is not in GROUP_KNOCKOUT format');
    }

    if (tournament.groupStageComplete) {
      throw new Error('Group stage is already complete');
    }

    // Check if all group stage matches are completed
    const incompleteMatches = await prisma.match.count({
      where: {
        tournamentId,
        matchStatus: { not: 'COMPLETED' },
        round: { contains: 'Group' },
      },
    });

    if (incompleteMatches > 0) {
      throw new Error(`${incompleteMatches} group stage matches are not yet completed`);
    }

    // Generate knockout bracket
    const knockoutData = await generateKnockoutFromGroups(tournamentId);

    // Create knockout bracket nodes and matches
    const result = await prisma.$transaction(async (tx) => {
      // Mark group stage as complete
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { groupStageComplete: true },
      });

      // Create knockout bracket nodes
      const createdNodes = [];
      for (const nodeData of knockoutData.bracketNodes) {
        const { nextNodeIndex, byeTeamId, byeAdvanceTeamId, ...nodeCreateData } = nodeData;
        const node = await tx.bracketNode.create({
          data: nodeCreateData,
        });
        createdNodes.push({ ...node, nextNodeIndex, byeTeamId, byeAdvanceTeamId });
      }

      // Create knockout matches
      for (const matchData of knockoutData.matchesToCreate) {
        const { node: nodeRef, ...matchCreateData } = matchData;

        const nodeIndex = knockoutData.bracketNodes.findIndex(
          (n) =>
            n.roundNumber === nodeRef.roundNumber &&
            n.position === nodeRef.position &&
            n.bracketType === nodeRef.bracketType
        );

        const createdNode = createdNodes[nodeIndex];

        const match = await tx.match.create({
          data: {
            ...matchCreateData,
            tournamentId,
            matchStatus: 'UPCOMING',
          },
        });

        await tx.bracketNode.update({
          where: { id: createdNode.id },
          data: { matchId: match.id },
        });
      }

      // Update knockout node connections
      for (let i = 0; i < createdNodes.length; i++) {
        const node = createdNodes[i];
        if (node.nextNodeIndex !== undefined) {
          const nextNode = createdNodes[node.nextNodeIndex];
          await tx.bracketNode.update({
            where: { id: node.id },
            data: { nextNodeId: nextNode.id },
          });
        }
      }

      // Handle nodes where one team advances via bye (byeAdvanceTeamId)
      // Create matches with the bye team as team1, team2 will be filled when match completes
      const totalSlots = Math.pow(2, Math.ceil(Math.log2(knockoutData.knockoutParticipants.length)));
      const numRounds = Math.log2(totalSlots);

      for (const node of createdNodes) {
        if (node.byeAdvanceTeamId) {
          // Create a match with the bye team as team1
          const match = await tx.match.create({
            data: {
              tournamentId,
              team1Id: node.byeAdvanceTeamId,
              round: getRoundName(node.roundNumber, numRounds),
              matchStatus: 'UPCOMING',
            },
          });

          await tx.bracketNode.update({
            where: { id: node.id },
            data: { matchId: match.id },
          });
        }
      }

      return { nodes: createdNodes, qualifiedTeams: knockoutData.knockoutParticipants };
    }, { timeout: 30000 }); // 30 second timeout

    return {
      success: true,
      message: 'Group stage completed and knockout bracket generated',
      data: result,
    };
  } catch (error) {
    console.error('Error completing group stage:', error);
    throw error;
  }
}

/**
 * Get group standings for a tournament
 */
async function getGroupStandings(tournamentId) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: {
        include: {
          player1: { select: { id: true, username: true, fullName: true } },
          player2: { select: { id: true, username: true, fullName: true } },
        },
      },
      matches: {
        where: {
          round: { contains: 'Group' },
        },
        include: {
          team1: true,
          team2: true,
        },
      },
    },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Initialize standings by group
  const standings = {};

  tournament.teams.forEach((team) => {
    if (team.groupName) {
      if (!standings[team.groupName]) {
        standings[team.groupName] = [];
      }
      standings[team.groupName].push({
        team,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }
  });

  // Calculate stats from matches
  tournament.matches.forEach((match) => {
    if (match.matchStatus !== 'COMPLETED' || !match.winnerId) return;

    const team1 = match.team1;
    const team2 = match.team2;

    if (!team1?.groupName || team1.groupName !== team2?.groupName) return;

    const groupName = team1.groupName;
    const stats1 = standings[groupName]?.find((s) => s.team.id === team1.id);
    const stats2 = standings[groupName]?.find((s) => s.team.id === team2.id);

    if (!stats1 || !stats2) return;

    stats1.matchesPlayed++;
    stats2.matchesPlayed++;

    if (match.winnerId === team1.id) {
      stats1.wins++;
      stats2.losses++;
    } else {
      stats2.wins++;
      stats1.losses++;
    }

    // Game and point stats
    if (match.team1Score?.games && match.team2Score?.games) {
      match.team1Score.games.forEach((score, idx) => {
        const team2Score = match.team2Score.games[idx];
        stats1.pointsFor += score;
        stats1.pointsAgainst += team2Score;
        stats2.pointsFor += team2Score;
        stats2.pointsAgainst += score;

        if (score > team2Score) {
          stats1.gamesWon++;
          stats2.gamesLost++;
        } else {
          stats2.gamesWon++;
          stats1.gamesLost++;
        }
      });
    }
  });

  // Sort each group
  Object.keys(standings).forEach((groupName) => {
    standings[groupName].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      const aDiff = a.pointsFor - a.pointsAgainst;
      const bDiff = b.pointsFor - b.pointsAgainst;
      return bDiff - aDiff;
    });
  });

  return standings;
}

module.exports = {
  generateBracket,
  advanceWinner,
  seedParticipants,
  completeGroupStage,
  getGroupStandings,
  generateKnockoutFromGroups,
};
