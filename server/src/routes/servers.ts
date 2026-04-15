import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';
import { io } from '../index';

export const serverRouter = Router();
const db = prisma as any;

const userSelect = { id: true, username: true, avatar: true, status: true, lastSeen: true, createdAt: true, presence: true };

function serializeUser(u: any) {
  return {
    ...u,
    lastSeen: u.lastSeen instanceof Date ? u.lastSeen.toISOString() : u.lastSeen,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  };
}

function serializeServer(s: any) {
  return {
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

// GET /api/servers - get user's servers
serverRouter.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const members = await db.serverMember.findMany({
      where: { userId: req.userId },
      include: {
        server: {
          include: {
            members: { include: { user: { select: { id: true, username: true, avatar: true, status: true, presence: true } } } },
            channels: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    res.json(members.map((m: any) => serializeServer(m.server)));
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/servers/public - list public servers
serverRouter.get('/public', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const servers = await db.server.findMany({
      where: { isPublic: true },
      include: { members: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(servers.map(serializeServer));
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/servers - create server
serverRouter.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, isPublic } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ message: 'Server name required' }); return; }
    const server = await db.server.create({
      data: {
        name: name.trim(),
        description: description || null,
        isPublic: !!isPublic,
        ownerId: req.userId,
      },
    });
    // Auto-join owner as member
    await db.serverMember.create({
      data: { serverId: server.id, userId: req.userId, role: 'owner' },
    });
    // Create default general channel
    await db.serverChannel.create({
      data: { serverId: server.id, name: 'general', type: 'text', position: 0 },
    });
    const full = await db.server.findUnique({
      where: { id: server.id },
      include: {
        members: { include: { user: { select: userSelect } } },
        channels: { orderBy: { position: 'asc' } },
      },
    });
    res.status(201).json(serializeServer(full));
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/servers/join/:inviteCode - join by invite code
serverRouter.post('/join/:inviteCode', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const server = await db.server.findUnique({ where: { inviteCode: req.params.inviteCode } });
    if (!server) { res.status(404).json({ message: 'Invalid invite code' }); return; }
    const existing = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: server.id, userId: req.userId } },
    });
    if (existing) { res.status(409).json({ message: 'Already a member' }); return; }
    await db.serverMember.create({ data: { serverId: server.id, userId: req.userId, role: 'member' } });
    const full = await db.server.findUnique({
      where: { id: server.id },
      include: {
        members: { include: { user: { select: userSelect } } },
        channels: { orderBy: { position: 'asc' } },
      },
    });
    res.json(serializeServer(full));
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/servers/:id - get server with channels and members
serverRouter.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const server = await db.server.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: { user: { select: userSelect } } },
        channels: { orderBy: { position: 'asc' } },
      },
    });
    if (!server) { res.status(404).json({ message: 'Server not found' }); return; }
    const isMember = server.members.some((m: any) => m.userId === req.userId);
    if (!isMember && !server.isPublic) { res.status(403).json({ message: 'Not a member' }); return; }
    res.json({
      ...serializeServer(server),
      members: server.members.map((m: any) => ({
        ...m,
        joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : m.joinedAt,
        user: serializeUser(m.user),
      })),
    });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/servers/:id/channels - create channel
serverRouter.post('/:id/channels', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const member = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: req.params.id, userId: req.userId } },
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      res.status(403).json({ message: 'Not authorized' }); return;
    }
    const { name, type, description } = req.body;
    if (!name) { res.status(400).json({ message: 'Channel name required' }); return; }
    const count = await db.serverChannel.count({ where: { serverId: req.params.id } });
    const channel = await db.serverChannel.create({
      data: { serverId: req.params.id, name, type: type || 'text', description: description || null, position: count },
    });
    res.status(201).json(channel);
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/servers/:id - delete server
serverRouter.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const server = await db.server.findUnique({ where: { id: req.params.id } });
    if (!server) { res.status(404).json({ message: 'Server not found' }); return; }
    if (server.ownerId !== req.userId) { res.status(403).json({ message: 'Only the owner can delete the server' }); return; }
    await db.server.delete({ where: { id: req.params.id } });
    res.json({ message: 'Server deleted' });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/servers/:id/leave - leave server
serverRouter.post('/:id/leave', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const server = await db.server.findUnique({ where: { id: req.params.id } });
    if (!server) { res.status(404).json({ message: 'Server not found' }); return; }
    if (server.ownerId === req.userId) { res.status(400).json({ message: 'Owner cannot leave - delete the server instead' }); return; }
    await db.serverMember.deleteMany({ where: { serverId: req.params.id, userId: req.userId } });
    res.json({ message: 'Left server' });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/servers/:id/channels/:channelId/messages
serverRouter.get('/:id/channels/:channelId/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const member = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: req.params.id, userId: req.userId } },
    });
    if (!member) { res.status(403).json({ message: 'Not a member' }); return; }
    const messages = await db.serverMessage.findMany({
      where: { channelId: req.params.channelId, deletedAt: null },
      include: { sender: { select: userSelect } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    res.json(messages.map((m: any) => ({
      ...m,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
      updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
      editedAt: m.editedAt instanceof Date ? m.editedAt.toISOString() : (m.editedAt || null),
      sender: serializeUser(m.sender),
    })));
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/servers/:id/channels/:channelId/messages
serverRouter.post('/:id/channels/:channelId/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const member = await db.serverMember.findUnique({
      where: { serverId_userId: { serverId: req.params.id, userId: req.userId } },
    });
    if (!member) { res.status(403).json({ message: 'Not a member' }); return; }
    const { content } = req.body;
    if (!content || !content.trim()) { res.status(400).json({ message: 'Content required' }); return; }
    const message = await db.serverMessage.create({
      data: { channelId: req.params.channelId, senderId: req.userId, content: content.trim() },
      include: { sender: { select: userSelect } },
    });
    const serialized = {
      ...message,
      createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
      updatedAt: message.updatedAt instanceof Date ? message.updatedAt.toISOString() : message.updatedAt,
      editedAt: null,
      sender: serializeUser(message.sender),
    };
    // Emit to server channel room
    if (io) {
      io.to(`server:${req.params.id}:channel:${req.params.channelId}`).emit('server:message:received', serialized);
    }
    res.status(201).json(serialized);
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});
