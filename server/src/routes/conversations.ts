import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const conversationRouter = Router();

conversationRouter.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        members: { some: { userId: req.userId } },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = conversations.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      avatar: c.avatar,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
      members: c.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: { ...m.user, lastSeen: m.user.lastSeen.toISOString(), createdAt: m.user.createdAt.toISOString() },
      })),
      lastMessage: c.messages[0]
        ? {
            ...c.messages[0],
            readBy: JSON.parse(c.messages[0].readBy),
            createdAt: c.messages[0].createdAt.toISOString(),
            sender: { ...c.messages[0].sender, lastSeen: c.messages[0].sender.lastSeen.toISOString(), createdAt: c.messages[0].sender.createdAt.toISOString() },
            replyTo: null,
          }
        : null,
      unreadCount: 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

conversationRouter.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type, name, memberIds } = req.body;

    if (!type || !memberIds || !Array.isArray(memberIds)) {
      res.status(400).json({ message: 'Type and memberIds are required' });
      return;
    }

    if (type === 'dm') {
      if (memberIds.length !== 1) {
        res.status(400).json({ message: 'DM requires exactly one other member' });
        return;
      }

      const existingDm = await prisma.conversation.findFirst({
        where: {
          type: 'dm',
          AND: [
            { members: { some: { userId: req.userId } } },
            { members: { some: { userId: memberIds[0] } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true },
              },
            },
          },
        },
      });

      if (existingDm) {
        res.json({
          id: existingDm.id,
          type: existingDm.type,
          name: existingDm.name,
          avatar: existingDm.avatar,
          createdBy: existingDm.createdBy,
          createdAt: existingDm.createdAt.toISOString(),
          members: existingDm.members.map((m) => ({
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt.toISOString(),
            user: { ...m.user, lastSeen: m.user.lastSeen.toISOString(), createdAt: m.user.createdAt.toISOString() },
          })),
          lastMessage: null,
          unreadCount: 0,
        });
        return;
      }
    }

    const allMemberIds = [req.userId!, ...memberIds];

    const conversation = await prisma.conversation.create({
      data: {
        type,
        name: type === 'group' ? name || 'Group Chat' : null,
        createdBy: req.userId!,
        members: {
          create: allMemberIds.map((id, i) => ({
            userId: id,
            role: i === 0 ? 'admin' : 'member',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true },
            },
          },
        },
      },
    });

    const result = {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      avatar: conversation.avatar,
      createdBy: conversation.createdBy,
      createdAt: conversation.createdAt.toISOString(),
      members: conversation.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: { ...m.user, lastSeen: m.user.lastSeen.toISOString(), createdAt: m.user.createdAt.toISOString() },
      })),
      lastMessage: null,
      unreadCount: 0,
    };

    res.status(201).json(result);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

conversationRouter.post('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId: targetUserId } = req.body;
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv || conv.type !== 'group') { res.status(400).json({ message: 'Not a group' }); return; }
    const myMember = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: req.userId! } },
    });
    if (!myMember) { res.status(403).json({ message: 'Not a member' }); return; }
    const existing = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: targetUserId } },
    });
    if (existing) { res.status(400).json({ message: 'Already a member' }); return; }
    await prisma.conversationMember.create({ data: { conversationId: id, userId: targetUserId, role: 'member' } });
    const userSelect = { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true };
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: id },
      include: { user: { select: userSelect } },
    });
    res.json(members.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt.toISOString(), user: { ...m.user, lastSeen: m.user.lastSeen.toISOString(), createdAt: m.user.createdAt.toISOString() } })));
  } catch (error) { console.error('Add member error:', error); res.status(500).json({ message: 'Internal server error' }); }
});

conversationRouter.delete('/:id/members/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv || conv.type !== 'group') { res.status(400).json({ message: 'Not a group' }); return; }
    if (conv.createdBy !== req.userId && req.userId !== targetUserId) {
      res.status(403).json({ message: 'Only group leader can remove members' }); return;
    }
    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId: id, userId: targetUserId } },
    });
    res.json({ removed: true });
  } catch (error) { console.error('Remove member error:', error); res.status(500).json({ message: 'Internal server error' }); }
});

conversationRouter.post('/:id/leave', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId: id, userId: req.userId! } },
    });
    res.json({ left: true });
  } catch (error) { console.error('Leave group error:', error); res.status(500).json({ message: 'Internal server error' }); }
});

conversationRouter.get('/:id/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: req.userId! } },
    });

    if (!member) {
      res.status(403).json({ message: 'Not a member of this conversation' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true },
        },
        replyTo: {
          include: {
            sender: {
              select: { id: true, username: true, email: true, avatar: true, status: true, lastSeen: true, createdAt: true },
            },
          },
        },
      },
    });

    const result = messages.map((m) => ({
      ...m,
      readBy: JSON.parse(m.readBy),
      createdAt: m.createdAt.toISOString(),
      sender: { ...m.sender, lastSeen: m.sender.lastSeen.toISOString(), createdAt: m.sender.createdAt.toISOString() },
      replyTo: m.replyTo
        ? {
            ...m.replyTo,
            readBy: JSON.parse(m.replyTo.readBy),
            createdAt: m.replyTo.createdAt.toISOString(),
            sender: { ...m.replyTo.sender, lastSeen: m.replyTo.sender.lastSeen.toISOString(), createdAt: m.replyTo.sender.createdAt.toISOString() },
            replyTo: null,
          }
        : null,
    }));

    res.json(result);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
