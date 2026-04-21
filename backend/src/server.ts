import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

import { closeDatabase, getDatabase, getDatabasePath } from './models/database';
import { JwtUser } from './types';
import authRoutes from './routes/auth.routes';
import challengeRoutes from './routes/challenge.routes';
import { router as flagRoutes, setIO } from './routes/flag.routes';
import scoreboardRoutes from './routes/scoreboard.routes';
import { logAction } from './utils/action-logger';

if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  process.env.JWT_SECRET = 'change-me-dev-secret';
  console.warn('JWT_SECRET is not set. Falling back to an insecure development default.');
}

const app = express();
const server = http.createServer(app);
const frontendOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
  : true;

const io = new Server(server, {
  cors: {
    origin: frontendOrigins,
    methods: ['GET', 'POST']
  }
});

io.use((socket, next) => {
  const tokenFromAuth = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
  const token = tokenFromAuth.trim();
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtUser;
    socket.data.user = decoded;
    next();
  } catch {
    next();
  }
});

setIO(io);
app.set('io', io);

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
  const user = socket.data.user as JwtUser | undefined;
  if (user?.id) {
    socket.join(`team:${user.id}`);
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

getDatabase();

server.listen(PORT, HOST, () => {
  logAction('server.start', `url=http://${HOST}:${PORT} db=${getDatabasePath()}`);
});

process.on('SIGINT', () => {
  logAction('server.stop', 'SIGINT');
  closeDatabase();
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, io };
