import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const friendRouter = Router();
const db = prisma as any;

const userSelect = {
  id: true, username: true, avatar: true, banner: true, bio: true,
  status: true, presence: true, customStatus: true, badges: true, links: true,
  nassPoints: true, lastSeen: true, createdAt: true,
};

function serializeUser(u: any) {
  return {
    ...u,
    lastSeen: u.lastSeen instanceof Date ? u.lastSeen.toISOString() : u.lastSeen,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  };
}

// GET /api/friends - list accepted friends
friendRouter.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const accepted = await db.friendRequest.findMany({
      where: {
        status: 'accepted',
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: userSelect },
        receiver: { select: userSelect },
      },
    });
    const friends = accepted.map((fr: any) => {
      const friend = fr.senderId === userId ? fr.receiver : fr.sender;
      return serializeUser(friend);
    });
    res.json(friends);
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/friends/requests - pending incoming requests
friendRouter.get('/requests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const requests = await db.friendRequest.findMany({
      where: { receiverId: userId, status: 'pending' },
      include: { sender: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests.map((r: any) => ({
      id: r.id,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      sender: serializeUser(r.sender),
    })));
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/friends/sent - sent pending requests
friendRouter.get('/sent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const requests = await db.friendRequest.findMany({
      where: { senderId: userId, status: 'pending' },
      include: { receiver: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests.map((r: any) => ({
      id: r.id,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      receiver: serializeUser(r.receiver),
    })));
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/friends/request/:userId - send friend request
friendRouter.post('/request/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.userId!;
    const receiverId = String(req.params.userId);
    if (senderId === receiverId) {
      res.status(400).json({ message: 'Cannot send friend request to yourself' });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!target) { res.status(404).json({ message: 'User not found' }); return; }

    // Check if already friends or request exists
    const existing = await db.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'accepted') {
        res.status(409).json({ message: 'Already friends' });
      } else {
        res.status(409).json({ message: 'Friend request already exists' });
      }
      return;
    }

    const fr = await db.friendRequest.create({
      data: { senderId, receiverId },
    });
    res.status(201).json({ id: fr.id, message: 'Friend request sent' });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/friends/accept/:requestId
friendRouter.post('/accept/:requestId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const requestId = String(req.params.requestId);
    const fr = await db.friendRequest.findUnique({ where: { id: requestId } });
    if (!fr || fr.receiverId !== userId) {
      res.status(404).json({ message: 'Friend request not found' });
      return;
    }
    if (fr.status !== 'pending') {
      res.status(400).json({ message: 'Request already handled' });
      return;
    }
    await db.friendRequest.update({ where: { id: requestId }, data: { status: 'accepted' } });
    res.json({ message: 'Friend request accepted' });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/friends/reject/:requestId
friendRouter.post('/reject/:requestId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const requestId = String(req.params.requestId);
    const fr = await db.friendRequest.findUnique({ where: { id: requestId } });
    if (!fr || fr.receiverId !== userId) {
      res.status(404).json({ message: 'Friend request not found' });
      return;
    }
    await db.friendRequest.update({ where: { id: requestId }, data: { status: 'rejected' } });
    res.json({ message: 'Friend request rejected' });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/friends/:userId - remove friend
friendRouter.delete('/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const targetId = String(req.params.userId);
    await db.friendRequest.deleteMany({
      where: {
        status: 'accepted',
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId },
        ],
      },
    });
    res.json({ message: 'Friend removed' });
  } catch {
    res.status(500).json({ message: 'Internal server error' });
  }
});
