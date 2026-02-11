import { useEffect, useState, useCallback } from 'react';
import socketService from '../services/socket';

/**
 * Custom hook for real-time bracket updates via Socket.IO
 * @param {string} tournamentId - The tournament ID to listen for updates
 * @param {boolean} enabled - Whether to enable socket connection (default: true)
 * @returns {Object} - Bracket update state and methods
 */
export const useBracketUpdates = (tournamentId, enabled = true) => {
  const [bracketData, setBracketData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Handle bracket generated event
  const handleBracketGenerated = useCallback((data) => {
    console.log('Bracket generated:', data);
    setBracketData(data.bracket);
    setLastUpdate({ type: 'generated', timestamp: new Date(), data });
  }, []);

  // Handle bracket updated event
  const handleBracketUpdated = useCallback((data) => {
    console.log('Bracket updated:', data);
    setBracketData((prev) => {
      if (!prev) return prev;

      // Update the bracket nodes that changed
      const updatedNodes = data.updatedNodes || [];
      const nodeMap = new Map(updatedNodes.map(node => [node.nodeId, node]));

      return {
        ...prev,
        bracketNodes: prev.bracketNodes?.map(node =>
          nodeMap.has(node.id) ? { ...node, ...nodeMap.get(node.id) } : node
        ) || prev.bracketNodes
      };
    });
    setLastUpdate({ type: 'updated', timestamp: new Date(), data });
  }, []);

  // Handle match completed in tournament
  const handleMatchCompleted = useCallback((data) => {
    console.log('Match completed in tournament:', data);
    setLastUpdate({ type: 'matchCompleted', timestamp: new Date(), data });
  }, []);

  // Handle connection status
  const handleConnect = useCallback(() => {
    console.log('Socket connected for bracket updates');
    setIsConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('Socket disconnected for bracket updates');
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!tournamentId || !enabled) {
      return;
    }

    // Connect to socket
    const socket = socketService.connect();
    setIsConnected(socket.connected);

    // Join tournament room
    socketService.joinTournament(tournamentId);
    console.log(`Joined tournament room: ${tournamentId}`);

    // Set up event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('tournament:bracketGenerated', handleBracketGenerated);
    socketService.on('bracket:updated', handleBracketUpdated);
    socketService.on('match:completed', handleMatchCompleted);

    // Cleanup on unmount
    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('tournament:bracketGenerated', handleBracketGenerated);
      socketService.off('bracket:updated', handleBracketUpdated);
      socketService.off('match:completed', handleMatchCompleted);
      socketService.leaveTournament(tournamentId);
      console.log(`Left tournament room: ${tournamentId}`);
    };
  }, [
    tournamentId,
    enabled,
    handleConnect,
    handleDisconnect,
    handleBracketGenerated,
    handleBracketUpdated,
    handleMatchCompleted,
  ]);

  // Manual refresh method
  const refreshBracket = useCallback(async () => {
    if (!tournamentId) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/tournaments/${tournamentId}/bracket`
      );
      const data = await response.json();
      if (data.success) {
        setBracketData(data.data);
      }
    } catch (error) {
      console.error('Error refreshing bracket:', error);
    }
  }, [tournamentId]);

  return {
    bracketData,
    isConnected,
    lastUpdate,
    refreshBracket,
  };
};

export default useBracketUpdates;
