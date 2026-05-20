import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { sendResponse, handleError } from '../utils/helpers.js';
import { answerCustomerQuestion } from '../utils/customerAssistant.js';

const router = express.Router();

router.post('/chat', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || !String(message).trim()) {
      return sendResponse(res, 400, false, 'message is required');
    }

    const result = await answerCustomerQuestion(String(message).trim(), history || []);

    sendResponse(res, 200, true, 'Assistant response generated', result);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
