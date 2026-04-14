import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { closeDatabase } from './models/database';
import authRoutes from './routes/auth.routes';
import challengeRoutes from './routes/challenge.routes';
import { router as flagRoutes, setIO } from './routes/flag.routes';
import scoreboardRoutes from './routes/scoreboard.routes';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

setIO(io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const flagLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many flag submissions. Please slow down.' }
});

app.use('/api/flags/submit', flagLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/scoreboard', scoreboardRoutes);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`CTF Platform backend running on http://${HOST}:${PORT}`);
  console.log('Database: ctf.db');
  console.log(`Admin credentials: admin@ctf.local / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  closeDatabase();
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, io };
