import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { sendResponse, handleError } from '../utils/helpers.js';
import { answerCustomerQuestion } from '../utils/customerAssistant.js';
import {
  buildCacheKey,
  ensureAssistantCacheTable,
  getCachedAssistantResponse,
  upsertCachedAssistantResponse,
} from '../utils/assistantCache.js';

const router = express.Router();

router.post('/chat', authenticateToken, authorizeRole(['customer']), async (req, res) => {
  try {
    const { message, history } = req.body;
    const pool = req.app.locals.pool;

    if (!message || !String(message).trim()) {
      return sendResponse(res, 400, false, 'message is required');
    }

    await ensureAssistantCacheTable(pool);

    const trimmedMessage = String(message).trim();
    const safeHistory = Array.isArray(history) ? history : [];

    const { cacheKey, normalizedMessage, historyHash } = buildCacheKey({
      userId: req.user.userId,
      message: trimmedMessage,
      history: safeHistory,
    });

    const cached = await getCachedAssistantResponse({ pool, cacheKey });
    if (cached) {
      return sendResponse(res, 200, true, 'Assistant response generated (cached)', {
        ...cached,
        cached: true,
      });
    }

    const result = await answerCustomerQuestion(trimmedMessage, safeHistory);

    // Cache only non-personal, general app-help answers with reasonable confidence.
    if (result?.responseMode === 'app_help' && Number(result?.groundednessScore || 0) >= 45) {
      await upsertCachedAssistantResponse({
        pool,
        cacheKey,
        userId: req.user.userId,
        message: normalizedMessage,
        historyHash,
        response: result,
      });
    }

    sendResponse(res, 200, true, 'Assistant response generated', result);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
