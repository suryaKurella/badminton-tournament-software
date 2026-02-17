import { useEffect, useState, useCallback } from 'react';
import socketService from '../services/socket';
import api from '../services/api';

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
    setIsConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
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
      const response = await api.get(`/matches/${matchId}/current-score`);
      if (response.data.success) {
        setCurrentScore(response.data.data);
        setMatchStatus(response.data.data.matchStatus);
      }
    } catch (error) {
      // Silently fail
    }
  }, [matchId]);

  // Manual refresh timeline
  const refreshTimeline = useCallback(async () => {
    if (!matchId) return;

    try {
      const response = await api.get(`/matches/${matchId}/timeline`);
      if (response.data.success) {
        setTimeline(response.data.data || []);
      }
    } catch (error) {
      // Silently fail
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
