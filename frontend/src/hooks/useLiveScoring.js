import { useEffect, useState, useCallback } from 'react';
import socketService from '../services/socket';

/**
 * Custom hook for real-time live scoring via Socket.IO
 * @param {string} matchId - The match ID to listen for score updates
 * @param {boolean} enabled - Whether to enable socket connection (default: true)
 * @returns {Object} - Live scoring state and methods
 */
export const useLiveScoring = (matchId, enabled = true) => {
  const [currentScore, setCurrentScore] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [matchStatus, setMatchStatus] = useState('SCHEDULED');
  const [lastEvent, setLastEvent] = useState(null);
  const [timeline, setTimeline] = useState([]);

  // Handle point scored event
  const handlePointScored = useCallback((data) => {
    console.log('Point scored:', data);
    setCurrentScore({
      matchId: data.matchId,
      gameNumber: data.gameNumber,
      team1Score: data.team1Score,
      team2Score: data.team2Score,
      detailedScore: data.detailedScore,
      scoringTeamId: data.scoringTeamId,
    });
    setLastEvent({
      type: 'pointScored',
      timestamp: new Date(data.timestamp),
      data,
    });
    // Add to timeline
    setTimeline((prev) => [...prev, {
      id: data.eventSequence || prev.length + 1,
      type: 'POINT_SCORED',
      gameNumber: data.gameNumber,
      team1Score: data.team1Score,
      team2Score: data.team2Score,
      scoringTeamId: data.scoringTeamId,
      timestamp: data.timestamp,
    }]);
  }, []);

  // Handle game complete event
  const handleGameComplete = useCallback((data) => {
    console.log('Game complete:', data);
    setLastEvent({
      type: 'gameComplete',
      timestamp: new Date(data.timestamp),
      data,
    });
    // Add to timeline
    setTimeline((prev) => [...prev, {
      id: prev.length + 1,
      type: 'GAME_END',
      gameNumber: data.gameNumber,
      winner: data.winningTeamId,
      timestamp: data.timestamp,
    }]);
  }, []);

  // Handle match complete event
  const handleMatchComplete = useCallback((data) => {
    console.log('Match complete:', data);
    setMatchStatus('COMPLETED');
    setLastEvent({
      type: 'matchComplete',
      timestamp: new Date(data.timestamp),
      data,
    });
    // Add to timeline
    setTimeline((prev) => [...prev, {
      id: prev.length + 1,
      type: 'MATCH_END',
      winner: data.winnerId,
      timestamp: data.timestamp,
    }]);
  }, []);

  // Handle undo point event
  const handleUndoPoint = useCallback((data) => {
    console.log('Point undone:', data);
    setCurrentScore({
      matchId: data.matchId,
      gameNumber: data.gameNumber,
      team1Score: data.team1Score,
      team2Score: data.team2Score,
      detailedScore: data.detailedScore,
    });
    setLastEvent({
      type: 'undoPoint',
      timestamp: new Date(data.timestamp),
      data,
    });
    // Remove last point from timeline
    setTimeline((prev) => prev.slice(0, -1));
  }, []);

  // Handle match started event
  const handleMatchStarted = useCallback((data) => {
    console.log('Match started:', data);
    setMatchStatus('LIVE');
    setLastEvent({
      type: 'matchStarted',
      timestamp: new Date(data.timestamp),
      data,
    });
    setTimeline([{
      id: 1,
      type: 'MATCH_START',
      timestamp: data.timestamp,
    }]);
  }, []);

  // Handle connection status
  const handleConnect = useCallback(() => {
    console.log('Socket connected for live scoring');
    setIsConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('Socket disconnected for live scoring');
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!matchId || !enabled) {
      return;
    }

    // Connect to socket
    const socket = socketService.connect();
    setIsConnected(socket.connected);

    // Join match room
    socketService.joinMatch(matchId);
    console.log(`Joined match room: ${matchId}`);

    // Set up event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('match:pointScored', handlePointScored);
    socketService.on('match:gameComplete', handleGameComplete);
    socketService.on('match:matchComplete', handleMatchComplete);
    socketService.on('match:undoPoint', handleUndoPoint);
    socketService.on('match:started', handleMatchStarted);

    // Cleanup on unmount
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('match:pointScored', handlePointScored);
      socketService.off('match:gameComplete', handleGameComplete);
      socketService.off('match:matchComplete', handleMatchComplete);
      socketService.off('match:undoPoint', handleUndoPoint);
      socketService.off('match:started', handleMatchStarted);
      socketService.leaveMatch(matchId);
      console.log(`Left match room: ${matchId}`);
    };
  }, [
    matchId,
    enabled,
    handleConnect,
    handleDisconnect,
    handlePointScored,
    handleGameComplete,
    handleMatchComplete,
    handleUndoPoint,
    handleMatchStarted,
  ]);

  // Manual refresh method to fetch current score
  const refreshScore = useCallback(async () => {
    if (!matchId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/matches/${matchId}/current-score`
      );
      const data = await response.json();
      if (data.success) {
        setCurrentScore(data.data);
        setMatchStatus(data.data.matchStatus);
      }
    } catch (error) {
      console.error('Error refreshing score:', error);
    }
  }, [matchId]);

  // Manual refresh timeline
  const refreshTimeline = useCallback(async () => {
    if (!matchId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/matches/${matchId}/timeline`
      );
      const data = await response.json();
      if (data.success) {
        setTimeline(data.data || []);
      }
    } catch (error) {
      console.error('Error refreshing timeline:', error);
    }
  }, [matchId]);

  return {
    currentScore,
    isConnected,
    matchStatus,
    lastEvent,
    timeline,
    refreshScore,
    refreshTimeline,
  };
};

export default useLiveScoring;
