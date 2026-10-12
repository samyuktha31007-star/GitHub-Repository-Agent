const express = require('express');
const router = express.Router();
const { getRepo, addChatMessage, getChatHistory, clearChat } = require('../services/repoStore');
const { answerRepoQuestion } = require('../services/aiService');

/**
 * POST /api/repos/:id/chat
 * Sends a question to the repository-aware chatbot
 */
router.post('/:id/chat', async (req, res) => {
  try {
    const repo = getRepo(req.params.id);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    const { question } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a non-empty question.' });
    }

    // 1. Record user message
    const userMsg = addChatMessage(repo.id, 'user', question.trim());

    // 2. Query AI/heuristic engine with grounded repository context
    const history = getChatHistory(repo.id);
    const answerResult = await answerRepoQuestion(repo, question.trim(), history);

    // 3. Record assistant message
    const botMsg = addChatMessage(repo.id, 'assistant', answerResult.content, {
      source: answerResult.source,
      note: answerResult.note || null
    });

    res.json({
      success: true,
      userMessage: userMsg,
      reply: botMsg,
      source: answerResult.source,
      note: answerResult.note
    });
  } catch (err) {
    res.status(500).json({ error: `Chat processing error: ${err.message}` });
  }
});

/**
 * GET /api/repos/:id/chat
 * Retrieves chat history for this repository
 */
router.get('/:id/chat', (req, res) => {
  const repo = getRepo(req.params.id);
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found.' });
  }
  res.json({ history: getChatHistory(repo.id) });
});

/**
 * DELETE /api/repos/:id/chat
 * Clears chat history for this repository
 */
router.delete('/:id/chat', (req, res) => {
  const repo = getRepo(req.params.id);
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found.' });
  }
  clearChat(repo.id);
  res.json({ success: true, message: 'Chat history cleared.' });
});

module.exports = router;
