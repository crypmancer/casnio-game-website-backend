// Require Dependencies
import express from 'express'
const router = express.Router()
import { getCurrentGameLow, getCurrentGameMiddle, getCurrentGameHigh } from "../controllers/games/jackpot.js"
import JackpotGame from '../models/JackpotGame.js';


/**
 * @route   GET /api/jackpot/
 * @desc    Get jackpot schema
 * @access  Public
 */
router.get("/", async (req, res, next) => {
  try {
    // Get active game
    const history = await JackpotGame.find()
      .sort({ created: -1 })
      .select({
        privateSeed: 1,
        privateHash: 1,
        publicSeed: 1,
        randomModule: 1,
        winner: 1,
        players: 1,
      })
      .limit(25);

    // Get current games
    const current = await getCurrentGameLow();
    const currentMiddle = await getCurrentGameMiddle();
    const currentHigh = await getCurrentGameHigh();

    return res.json({
      history,
      current,
      currentMiddle,
      currentHigh,
    });
  } catch (error) {
    return next(error);
  }
});

export default router