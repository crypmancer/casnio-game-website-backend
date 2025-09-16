// Import Dependencies
import express from "express";
import cors from "cors";
import { Router } from "express";
import { check, validationResult } from "express-validator";
import { validateJWT } from "../../middleware/auth.js";

const router = Router();
router.use(cors());

// Declare Useful Variables
const TOKEN_STATE = []; // [{ identifier: String, token: String }]
const AUTH_PROVIDERS = [
  {
    name: "Steam",
    endpoint: "/api/auth/steam",
  },
  {
    name: "Google",
    endpoint: "/api/auth/google",
  },
  {
    name: "User",
    endpoint: "/api/auth/registration",
  },
];

/**
 * @route   GET /api/auth
 * @desc    List all authentication providers
 * @access  Public
 */
router.get("/", async (req, res) => {
  return res.json({ providers: AUTH_PROVIDERS });
});

/**
 * @route   POST /api/auth/exchange-token
 * @desc    Exchange temporary auth token into JWT
 * @access  Public
 */
router.post(
  "/exchange-token",
  check("token", "Authentication token is required").notEmpty().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;
    try {
      // Search for state
      const searchResult = TOKEN_STATE.find((el) => el.identifier === token);

      // Check if token exists in memory
      if (!searchResult) {
        res.status(400);
        return next(new Error("Invalid token"));
      }

      // Remove from state
      const searchIndex = TOKEN_STATE.findIndex((el) => el.identifier === token);
      TOKEN_STATE.splice(searchIndex, 1);

      // Return JWT
      return res.json({ token: searchResult.token });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   GET /api/auth/isAuthenticated
 * @desc    Validate user authentication token
 * @access  Private
 */
router.get("/isAuthenticated", validateJWT, async (req, res) => {
  return res.json({
    authenticated: true,
  });
});

// Function to add token to the state
const addTokenToState = (identifier, token) =>
  TOKEN_STATE.push({ identifier, token });

import steam from './steam.js'
import google from './google.js'
import registration from './registration.js'

// Import Auth Providers
router.use("/steam", steam(addTokenToState));
router.use("/google", google(addTokenToState));
router.use("/registration", registration(addTokenToState));

export default router;
