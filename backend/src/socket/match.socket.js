// Socket.io event handlers for real-time match updates

const setupMatchSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Join tournament room
    socket.on('join:tournament', (tournamentId) => {
      socket.join(`tournament-${tournamentId}`);
      console.log(`Socket ${socket.id} joined tournament room: tournament-${tournamentId}`);

      socket.emit('joined:tournament', {
        success: true,
        message: `Joined tournament ${tournamentId}`,
      });
    });

    // Leave tournament room
    socket.on('leave:tournament', (tournamentId) => {
      socket.leave(`tournament-${tournamentId}`);
      console.log(`Socket ${socket.id} left tournament room: tournament-${tournamentId}`);

      socket.emit('left:tournament', {
        success: true,
        message: `Left tournament ${tournamentId}`,
      });
    });

    // Join specific match room
    socket.on('join:match', (matchId) => {
      socket.join(`match-${matchId}`);
      console.log(`Socket ${socket.id} joined match room: match-${matchId}`);

      socket.emit('joined:match', {
        success: true,
        message: `Joined match ${matchId}`,
      });
    });

    // Leave match room
    socket.on('leave:match', (matchId) => {
      socket.leave(`match-${matchId}`);
      console.log(`Socket ${socket.id} left match room: match-${matchId}`);

      socket.emit('left:match', {
        success: true,
        message: `Left match ${matchId}`,
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return io;
};

module.exports = { setupMatchSocket };
