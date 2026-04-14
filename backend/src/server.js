require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { getDatabase, closeDatabase } = require('./models/database');
const authRoutes = require('./routes/auth.routes');
const challengeRoutes = require('./routes/challenge.routes');
const { router: flagRoutes, setIO } = require('./routes/flag.routes');
const scoreboardRoutes = require('./routes/scoreboard.routes');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

setIO(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const flagLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 submissions per minute
  message: { error: 'Too many flag submissions. Please slow down.' }
});

app.use('/api/flags/submit', flagLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/scoreboard', scoreboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`CTF Platform backend running on http://${HOST}:${PORT}`);
  console.log(`Database: ctf.db`);
  console.log(`Admin credentials: admin@ctf.local / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDatabase();
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { app, server, io };
