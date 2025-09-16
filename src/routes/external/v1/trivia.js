// Require Dependencies
import express from "express";
import colors from "colors/safe.js";
import { check, validationResult } from "express-validator";

import Trivia from "../../../models/Trivia.js";

const router = express.Router()

/**
 * @route   GET /api/external/v1/trivia/
 * @desc    Get active trivia
 * @access  Private
 */
router.get("/", async (req, res, next) => {
  try {
    // Get active trivia from db
    const game = await Trivia.findOne({ active: true });

    return res.json(game);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/external/v1/trivia/end
 * @desc    End current active trivia
 * @access  Private
 */
router.post("/end", async (req, res, next) => {
  try {
    // Get active game from db
    const game = await Trivia.findOne({ active: true });

    // If there is no active game
    if (!game) {
      res.status(400);
      return next(new Error("No active trivia found!"));
    }

    // Update trivia document
    await Trivia.updateOne(
      { _id: game.id },
      {
        $set: {
          active: false,
          winners: [],
        },
      }
    );

    // Notify users
    req.app.get("socketio").of("/chat").emit("trivia-state-changed", null);

    console.log(colors.green("Trivia >> Manually ended trivia"), game.id);
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   PUT /api/external/v1/trivia/create
 * @desc    Create new trivia
 * @access  Private
 */
const validationChecks = [
  check("question", "Question is required!")
    .notEmpty()
    .withMessage("Invalid question type, must be a string"),
  check("answer", "Answer is required!")
    .notEmpty()
    .withMessage("Invalid question type, must be a string"),
  check("winnerAmount", "Winner amount is required!")
    .isInt()
    .withMessage("Invalid winner amount type, must be an integer")
    .toInt(),
  check("prize", "Prize amount is required!")
    .isFloat()
    .withMessage("Invalid prize amount type, must be an float")
    .toFloat(),
];
router.put("/create", validationChecks, async (req, res, next) => {
  const errors = validationResult(req);

  // Check for validation errors
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { question, answer, winnerAmount, prize } = req.body;
  try {
    // Get active trivia from db
    const game = await Trivia.findOne({ active: true });

    // If there is active game
    if (game) {
      res.status(400);
      return next(
        new Error("Please end the current trivia before starting a new one!")
      );
    }

    // Create a new trivia document
    const newGame = new Trivia({
      // Basic fields
      active: true,
      prize,
      question,
      answer,
      winnerAmount,
    });

    // Save new document
    await newGame.save();

    // Notify users
    req.app.get("socketio").of("/chat").emit("trivia-state-changed", {
      active: true,
      question,
      prize,
      winnerAmount,
    });

    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

export default router;