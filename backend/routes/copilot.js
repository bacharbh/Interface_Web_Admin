import express from 'express';
const router = express.Router();
import copilotService from '../services/copilotService.js';

/**
 * @route POST /api/copilot/chat
 * @desc AI Copilot Chat Endpoint
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const result = await copilotService.handleChat(messages, context);
    res.json(result);

  } catch (error) {
    res.status(500).json({ error: 'Copilot failed to respond' });
  }
});

export default router;
