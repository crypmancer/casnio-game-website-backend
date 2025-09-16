// Require Dependencies
import express from 'express'
const router = express.Router()
import fs from 'fs'
import path from 'path'

/**
 * @route   GET /api/images/user_id
 * @desc    Get user's avatar and send it
 * @access  Public
 */
router.get("/:user_id", async (req, res) => {
  try {
    fs.readFileSync(path.join(__dirname, `../temp/user_profiles/${req.params.user_id}/picture/profile.jpg`));
    let image_dir = path.join(__dirname, `../temp/user_profiles/${req.params.user_id}/picture/profile.jpg`);
    return res.sendFile(image_dir);
  } catch (e) {
    return res.sendFile(path.join(__dirname, `../temp/error.png`));
  }
});

export default router