import './normalizeCloudinaryEnv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { conversationRouter } from './routes/conversations';
import { uploadRouter } from './routes/uploads';
import { postRouter } from './routes/posts';
import { adminRouter } from './routes/admin';
import { reportRouter } from './routes/reports';
import { storyRouter } from './routes/stories';
import { setupSocketHandlers, getOnlineUsers } from './socket';
import { authenticateSocket, prisma } from './middleware/auth';

const app = express();
const server = createServer(app);

// CORS: use CORS_ORIGIN env var (comma-separated), fallback to localhost for dev
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  maxHttpBufferSize: 50 * 1024 * 1024,
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// Trust proxy for rate limiting behind reverse proxies (Railway, Render, etc.)
app.set('trust proxy', 1);

const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint (used by deployment platforms)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/posts', postRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportRouter);
app.use('/api/stories', storyRouter);

// Streak endpoint: get streaks for a conversation
app.get('/api/streaks/:conversationId', async (req, res) => {
  try {
    const streaks = await prisma.dmStreak.findMany({
      where: { conversationId: req.params.conversationId },
      include: { user: { select: { id: true, username: true } } },
    });
    res.json(streaks);
  } catch { res.status(500).json({ message: 'Error' }); }
});

app.get('/api/online', (_req, res) => {
  res.json([...getOnlineUsers()]);
});

io.use(authenticateSocket);
setupSocketHandlers(io);

// Seed owner role on startup
async function seedOwner() {
  try {
    const owner = await prisma.user.findUnique({ where: { email: 'nasstofa0@gmail.com' } });
    if (owner && owner.role !== 'owner') {
      await prisma.user.update({ where: { id: owner.id }, data: { role: 'owner' } });
      console.log(`Owner role set for ${owner.username}`);
    }
  } catch {}
}
seedOwner();

const PORT = process.env.PORT || 3001;
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  if (allowedOrigins.some((o) => o.includes('localhost'))) {
    console.log(`  CORS origins: ${allowedOrigins.join(', ')}`);
  }
});

export { io };
