// Require Dependencies
import express from "express";
import { games } from "../../../config/index.js";
import {
  getVipLevelFromWager,
  getNextVipLevelFromWager,
} from "../../../controllers/vip.js";

import User from "../../../models/User.js";

const router = express.Router()

/**
 * @route   GET /api/external/v1/vip/list
 * @desc    Get current VIP users
 * @access  Private
 */
router.get("/list", async (req, res, next) => {
  try {
    const minWager = games.vip.levels.sort(
      (a, b) => a.wagerNeeded - b.wagerNeeded
    )[1].wagerNeeded;

    // Get all active vip users
    const users = await User.find({ wager: { $gte: minWager } }).lean();

    return res.json(
      users.map(user => ({
        ...user,
        extraStatistics: {
          currentRank: getVipLevelFromWager(user.wager),
          nextRank: getNextVipLevelFromWager(user.wager),
        },
      }))
    );
  } catch (error) {
    return next(error);
  }
});

export default router