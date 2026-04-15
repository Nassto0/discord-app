import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';

export const aiRouter = Router();

const NASSAI_URL = process.env.NASSAI_URL || 'http://localhost:7777';

aiRouter.post('/chat', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { messages, model } = req.body;
    const response = await fetch(`${NASSAI_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer change-secret-key-2026',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
      }),
    });
    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown error');
      res.status(502).json({ message: `NassAI upstream error: ${err}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('AI proxy error:', error);
    res.status(503).json({ message: 'NassAI is offline - please make sure the NassAI server is running on port 7777' });
  }
});
