// Require Dependencies
import { games } from "../config/index.js"
import express from "express"
import _ from "lodash"
import { validateJWT } from "../middleware/auth.js"
const router = express.Router()
import {
  getCurrentGame,
  formatGameHistory,
} from "../controllers/games/crash.js"

import CrashGame from "../models/CrashGame.js"

/**
 * @route   GET /api/crash/
 * @desc    Get crash schema
 * @access  Public
 */
router.get("/", async (req, res, next) => {
  try {
    // Get active game
    const history = await CrashGame.find({
      status: 4,
    })
      .sort({ created: -1 })
      .limit(35);

    // Get current games
    const current = await getCurrentGame();

    return res.json({
      current,
      history: history.map(formatGameHistory),
      options: _.pick(games.crash, "maxProfit"),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/crash/me
 * @desc    Get user crash data
 * @access  Private
 */
router.get("/me", validateJWT, async (req, res, next) => {
  try {
    // Get current games
    const current = await getCurrentGame();

    // Check players array for user bet
    const userBet = _.find(current.players, { playerID: req.user.id });

    return res.json({
      bet: userBet ? userBet : null,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/crash/service
 * @desc    Get crash service data
 * @access  Private
 */
router.get("/service", async (req, res, next) => {
  try {
    // Get current games
    const current = await getCurrentGame();
    const privateHash = await getPrivateHash();

    return res.json({
      ...current,
      privateHash,
    });
  } catch (error) {
    return next(error);
  }
});

export default router