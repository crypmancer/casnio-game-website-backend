// Require Dependencies
import express from "express";
const router = express.Router();

import CoinflipGame from "../models/CoinflipGame.js";

/**
 * @route   GET /api/coinflip/
 * @desc    Get active coinflip games
 * @access  Public
 */
router.get("/", async (req, res, next) => {
  try {
    // Get active games
    const criteria = { status: { $gt: 1 } };
    const games = await CoinflipGame.find(criteria)
      .sort({ created: -1, totalBetAmount: -1 }).select({ privateSeed: 0 }).limit(3);

    return res.json(games);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/coinflip/history
 * @desc    Get active coinflip games
 * @access  Public
 */
router.get("/history", async (req, res, next) => {
  try {
    // Get active games
    const criteria = { status: { $gt: 1 } };
    const games = await CoinflipGame.find(criteria)
      .sort({ created: -1, totalBetAmount: -1 }).limit(30);

    return res.json(games);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/coinflip/me
 * @desc    Get user's private games
 * @access  Private
 */
router.get("/me", async (req, res, next) => {
  try {
    // Get user's private games
    const ownCriteria = {
      status: 1,
      privateGame: true,
      //_creator: req.user.id,
    };
    const ownPrivateGames = await CoinflipGame.find(ownCriteria)
      .sort({ totalBetAmount: -1 }).select({ privateSeed: 0 })   //.select({ privateSeed: 0 })
      .lean();

    // Map to differenciate from normal games
    const mapper = item => ({
      ...item,
      ownPrivateGame: true,
      inviteLink: `/coinflip/private/${item.inviteCode}`,
    });

    return res.json(ownPrivateGames.map(mapper));
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/coinflip/private/:inviteCode
 * @desc    Get private game from invite code
 * @access  Public
 */
router.get("/private/:inviteCode", async (req, res, next) => {
  try {
    // Get active games
    const criteria = {
      status: { $gt: 0 },
      privateGame: true,
      inviteCode: req.params.inviteCode,
    };
    
    const game = await CoinflipGame.findOne(criteria);

    // If game was not found
    if (!game) {
      res.status(400);
      return next(
        new Error("Couldn't find an active game with that invite code!")
      );
    } else {
      // If status is 3, show privateSeed
      if (game.status === 3) {
        return res.json(game);
      } else {
        // Otherwise, exclude privateSeed from the response
        return res.json({ ...game._doc, privateSeed: 0 });
      }
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/coinflip/me
 * @desc    Get user's private games
 * @access  Private
 */
router.get("/joinable", async (req, res, next) => {
  try {
    // Get user's private games
    const ownCriteria = {
      status: 1,
      privateGame: true,
    };
    const ownPrivateGamess = await CoinflipGame.countDocuments(ownCriteria);

    return res.json(ownPrivateGamess);
  } catch (error) {
    return next(error);
  }
});

export default router