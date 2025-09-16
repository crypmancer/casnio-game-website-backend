// Import Dependencies
import express from "express";
const router = express.Router();
import { getChatMessages, getRainStatus, getTriviaTimeStatus, getTriviaCountdownStatus } from "../controllers/chat.js";

import Trivia from "../models/Trivia.js";

/**
 * @route   GET /api/chat/history
 * @desc    Get 30 last chat messages from state
 * @access  Public
 */
router.get("/history", async (req, res, next) => {
  try {
    const messages = getChatMessages();
    const rain = getRainStatus();
    const triviaTime = getTriviaTimeStatus();
    const triviaCountdownStarted = getTriviaCountdownStatus();
    const trivia = await Trivia.findOne({ active: true }).select({
      active: 1,
      question: 1,
      prize: 1,
      winnerAmount: 1,
      winners: 1,
    });

    return res.json({
      messages: messages
        .sort((a, b) => a.created - b.created)
        .slice(Math.max(messages.length - 30, 0)),
      rain,
      triviaTime,
      triviaCountdownStarted,
      trivia,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
