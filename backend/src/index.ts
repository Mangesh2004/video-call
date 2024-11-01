import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }));
app.use(express.json());

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, username }) => {
    console.log(`User ${username} joining room ${roomId}`);
    socket.join(roomId);
    rooms.set(socket.id, { roomId, username });
    
    // Notify others in room
    socket.to(roomId).emit('user-connected', { username, socketId: socket.id });
    console.log(`Notified others about ${username} joining room ${roomId}`);
    
    // Handle WebRTC signaling
    socket.on('offer', ({ to, offer }) => {
      console.log(`Offer received from ${socket.id} to ${to}`);
      socket.to(to).emit('offer', { from: socket.id, offer });
      console.log('Offer forwarded');
    });

    socket.on('answer', ({ to, answer }) => {
      console.log(`Answer received from ${socket.id} to ${to}`);
      socket.to(to).emit('answer', { from: socket.id, answer });
      console.log('Answer forwarded');
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      console.log(`ICE candidate received from ${socket.id} to ${to}`);
      socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
      console.log('ICE candidate forwarded');
    });

    socket.on('send-message', ({ roomId, message, sender }) => {
      console.log(`Message from ${sender} in room ${roomId}: ${message}`);
      io.to(roomId).emit('receive-message', {
        message,
        sender,
        timestamp: new Date().toISOString(),
      });
    });
  });

  socket.on('disconnect', () => {
    const userData = rooms.get(socket.id);
    if (userData) {
      console.log(`User disconnected from room ${userData.roomId}: ${userData.username}`);
      socket.to(userData.roomId).emit('user-disconnected', socket.id);
      rooms.delete(socket.id);
    }
  });
});
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});