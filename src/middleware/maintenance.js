// Import Dependencies
import { getMaintenanceState } from "../controllers/site-settings.js";

// Middleware to check maintenance status
const checkMaintenance = async (req, res, next) => {
  // Get toggle status
  const isMaintenance = getMaintenanceState();

  // If site is on maintenance
  if (isMaintenance) {
    res.status(503);
    return next(new Error("adashuffle.com is currently on maintenance!"));
  } else {
    return next();
  }
};

// Export middlewares
export { checkMaintenance };
