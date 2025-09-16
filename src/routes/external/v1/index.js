// Require Dependencies
import { Router } from "express";
import { validateJWT, allowAdminsOnly } from "../../../middleware/auth.js";

import controls from './controls.js';
import users from './users.js';
import statistics from "./statistics.js";
import coupons from "./coupons.js";
import race from "./race.js";
import trivia from "./trivia.js";
import vip from "./vip.js";

const router = Router();

// Authentication middleware
router.use(validateJWT);
router.use(allowAdminsOnly);

// Authentication test endpoint
router.get("/testAuthentication", (req, res) => {
  return res.json({
    success: true,
  });
});

// Define endpoints
router.use("/controls", controls);
router.use("/users", users);
router.use("/statistics", statistics);
router.use("/coupons", coupons);
router.use("/race", race);
router.use("/trivia", trivia);
router.use("/vip", vip);

export default router
