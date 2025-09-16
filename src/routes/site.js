// Import Dependencies
import express from "express";
import { getMaintenanceState } from "../controllers/site-settings.js";

// Create Router
const router = express.Router();

/**
 * @route   GET /api/site/
 * @desc    Get site schema
 * @access  Public
 */
router.get("/", async (req, res) => {
  const launchDate = new Date("2020-07-05T19:00:00");

  return res.json({
    maintenanceEnabled: getMaintenanceState(),
    launchDate: launchDate.toISOString(),
    launched: Date.now() > launchDate.getTime(),
  });
});

// Export Router
export default router;
