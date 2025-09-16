// Require Dependencies
import express from "express";
const router = express.Router();

import v1 from './v1/index.js';

// Use versioned api
// router.use("/v1", v1);

export default router