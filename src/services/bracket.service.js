const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
 * Generate round robin bracket
 * All participants play each other once using circular rotation method
 */
async function generateRoundRobinBracket(tournamentId, participants, seedingMethod) {
  const seededParticipants = await seedParticipants(participants, seedingMethod);
  const n = seededParticipants.length;

  // For odd number, add a "bye" placeholder
  const teams = [...seededParticipants];
  if (n % 2 !== 0) {
    teams.push(null); // Bye placeholder
  }

  const numTeams = teams.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;

  const bracketNodes = [];
  const matchesToCreate = [];

  // Generate all rounds using circular rotation method
  for (let round = 0; round < numRounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      let home, away;

      if (match === 0) {
        home = 0; // First team stays fixed
        away = numTeams - 1 - round;
      } else {
        home = (round + match) % (numTeams - 1);
        away = (numTeams - 1 - match - round) % (numTeams - 1);

        // Adjust indices
        if (home >= away) home++;
        away++;
      }

      const team1 = teams[home];
      const team2 = teams[away];

      // Skip if either team is a bye
      if (!team1 || !team2) continue;

      const node = {
        tournamentId,
        roundNumber: round + 1,
        position: match,
        bracketType: 'MAIN',
      };

      matchesToCreate.push({
        node,
        team1Id: team1.id,
        team2Id: team2.id,
        round: `Round ${round + 1}`,
      });

      bracketNodes.push(node);
    }
  }

  return { bracketNodes, matchesToCreate };
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
      default:
        throw new Error(`Unsupported tournament format: ${format}`);
    }

    // Create bracket nodes and matches in transaction
    const result = await prisma.$transaction(async (tx) => {
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
    });

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
      const nextMatch = await prisma.match.findUnique({
        where: { id: bracketNode.nextNode.matchId },
      });

      if (nextMatch) {
        // Determine if winner goes to team1 or team2 slot
        const updateData = nextMatch.team1Id ? { team2Id: winnerId } : { team1Id: winnerId };

        await prisma.match.update({
          where: { id: nextMatch.id },
          data: updateData,
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

    return {
      success: true,
      message: 'Winner advanced successfully',
    };
  } catch (error) {
    console.error('Error advancing winner:', error);
    throw error;
  }
}

module.exports = {
  generateBracket,
  advanceWinner,
  seedParticipants,
};
