// Require Dependencies
import express from "express";

import BattlesGame from "../models/BattlesGame.js";

const router = express.Router()

/**
 * @route   GET /api/battles/
 * @desc    Get active battles games
 * @access  Public`
 */
router.get("/", async (req, res, next) => {
  try {
    const waiting = await BattlesGame.find({ status: 1 })
    const active = await BattlesGame.find({ status: 2 });

    const games = [...waiting, ...active];
    
    // Create new objects with desired properties
    const modifiedGames = games.map(game => {

      return {
        id: game._id,  
        price: game.betAmount,
        cases: game.cases,
        casesRoundResults: [],
        players: game.players,
        isCrazyMode: game.isCrazyMode,
        hash: game.privateHash,
        gameType: game.game_type,
        status: game.status,
        playerCount: game.game_type == 1 ? 2 : game.game_type == 2 ? 3 : game.game_type == 3 ? 4 : game.game_type == 4 ? 4 : 0,
      };
    });

    return res.json(modifiedGames);
  } catch (error) {
    return next(error);
  }
});

router.get("/cases", async (req, res, next) => {
  try {
    const cases = require("../controllers/games/cases.js");

    return res.json(cases);
  } catch (error) {
    return next(error);
  }
});

export default router