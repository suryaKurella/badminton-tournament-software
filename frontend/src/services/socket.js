import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Tournament room methods
  joinTournament(tournamentId) {
    if (this.socket) {
      this.socket.emit('join:tournament', tournamentId);
    }
  }

  leaveTournament(tournamentId) {
    if (this.socket) {
      this.socket.emit('leave:tournament', tournamentId);
    }
  }

  // Match room methods
  joinMatch(matchId) {
    if (this.socket) {
      this.socket.emit('join:match', matchId);
    }
  }

  leaveMatch(matchId) {
    if (this.socket) {
      this.socket.emit('leave:match', matchId);
    }
  }

  // Event listeners
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Match event listeners
  onMatchCreated(callback) {
    this.on('match:created', callback);
  }

  onMatchUpdated(callback) {
    this.on('match:updated', callback);
  }

  onMatchScoreUpdate(callback) {
    this.on('match:scoreUpdate', callback);
  }

  onMatchStarted(callback) {
    this.on('match:started', callback);
  }

  onMatchCompleted(callback) {
    this.on('match:completed', callback);
  }

  // Tournament event listeners
  onTournamentUpdated(callback) {
    this.on('tournament:updated', callback);
  }

  onTournamentReset(callback) {
    this.on('tournament:reset', callback);
  }

  onBracketGenerated(callback) {
    this.on('tournament:bracketGenerated', callback);
  }
}

const socketService = new SocketService();
export default socketService;
