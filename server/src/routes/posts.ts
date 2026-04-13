import { Router, Response } from 'express';
import { prisma, authenticateToken, AuthRequest } from '../middleware/auth';

export const postRouter = Router();

const userSelect = { id: true, username: true, email: true, avatar: true, banner: true, bio: true, status: true, customStatus: true, lastSeen: true, createdAt: true };

postRouter.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cursor = req.query.cursor as string | undefined;
    const posts = await prisma.post.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: userSelect },
        likes: { select: { userId: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: userSelect } },
        },
      },
    });

    res.json(posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      author: { ...p.author, lastSeen: p.author.lastSeen.toISOString(), createdAt: p.author.createdAt.toISOString() },
      likeCount: p.likes.length,
      isLiked: p.likes.some((l) => l.userId === req.userId),
      likes: undefined,
      comments: p.comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        author: { ...c.author, lastSeen: c.author.lastSeen.toISOString(), createdAt: c.author.createdAt.toISOString() },
      })),
    })));
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

postRouter.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { content, imageUrl } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ message: 'Content is required' });
      return;
    }
    if (content.length > 2000) {
      res.status(400).json({ message: 'Post content must be 2000 characters or less' });
      return;
    }

    const post = await prisma.post.create({
      data: { authorId: req.userId!, content: content.trim(), imageUrl: imageUrl || null },
      include: {
        author: { select: userSelect },
        likes: { select: { userId: true } },
      },
    });

    res.status(201).json({
      ...post,
      createdAt: post.createdAt.toISOString(),
      author: { ...post.author, lastSeen: post.author.lastSeen.toISOString(), createdAt: post.author.createdAt.toISOString() },
      likeCount: 0,
      isLiked: false,
      likes: undefined,
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

postRouter.post('/:id/like', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: req.params.id, userId: req.userId! } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      res.json({ liked: false });
    } else {
      await prisma.postLike.create({ data: { postId: req.params.id, userId: req.userId! } });
      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

postRouter.post('/:id/comments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ message: 'Content required' }); return; }
    const comment = await prisma.postComment.create({
      data: { postId: req.params.id, authorId: req.userId!, content: content.trim() },
      include: { author: { select: userSelect } },
    });
    res.status(201).json({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      author: { ...comment.author, lastSeen: comment.author.lastSeen.toISOString(), createdAt: comment.author.createdAt.toISOString() },
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

postRouter.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post || post.authorId !== req.userId) {
      res.status(403).json({ message: 'Not allowed' });
      return;
    }
    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
