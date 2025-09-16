// Require Dependencies
import express from "express";
import { check, validationResult } from "express-validator";
import insertNewWalletTransaction from "../../../utils/insertNewWalletTransaction.js";

import User from "../../../models/User.js";
import CouponCode from "../../../models/CouponCode.js";
import WalletTransaction from "../../../models/WalletTransaction.js";

const router = express.Router()

/**
 * @route   GET /api/external/v1/users/list
 * @desc    List all users at that time
 * @access  Private
 */
router.get("/list", async (req, res, next) => {
  try {
    const users = await User.find().sort({ created: -1 });

    return res.json(users);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/external/v1/users/lookup/:userId
 * @desc    Lookup player information
 * @access  Private
 */
router.get("/lookup/:userId", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId }).lean();
    const userCoupons = await CouponCode.find({
      claimedUsers: req.params.userId,
    }).lean();

    // If user was not found
    if (!user) {
      res.status(404);
      return next(new Error("Couldn't find an user with that UserID!"));
    }

    // Generate extra statistics for user
    const extraStatistics = {
      couponsClaimed: userCoupons
        .map(coupon => coupon.payout)
        .reduce((a, b) => a + b, 0),
      banned: parseInt(user.banExpires) > Date.now(),
      muted: parseInt(user.muteExpires) > Date.now(),
    };

    return res.json({ ...user, extraStatistics });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/external/v1/users/update
 * @desc    Update user's data
 * @access  Private
 */
const validationChecks = [
  check("_id", "UserID is required!")
    .notEmpty()
    .isMongoId()
    .withMessage("Invalid UserID type, must be an MongoID"),
  // check("banned", "Banned status is required!")
  //   .isBoolean()
  //   .withMessage("Invalid banned status type, must be a boolean")
  //   .toBoolean(),
  // check("muted", "Muted status is required!")
  //   .isBoolean()
  //   .withMessage("Invalid muted status type, must be a boolean")
  //   .toBoolean(),
  check("banExpires", "Ban expires timestamp is required")
    .notEmpty()
    .isInt({ min: 0 })
    .withMessage(
      "Invalid ban expiry type, must be an UNIX timestamp greater than 0"
    ),
  check("muteExpires", "Mute expires timestamp is required")
    .notEmpty()
    .isInt({ min: 0 })
    .withMessage(
      "Invalid mute expiry type, must be an UNIX timestamp greater than 0"
    ),
  check("verified", "Verified status is required!")
    .isBoolean()
    .withMessage("Invalid verified status type, must be a boolean")
    .toBoolean(),
  check("transactionsLocked", "Transactions locked status is required!")
    .isBoolean()
    .withMessage("Invalid transactions locked status type, must be a boolean")
    .toBoolean(),
  check("betsLocked", "Bets locked status is required!")
    .isBoolean()
    .withMessage("Invalid bets locked status type, must be a boolean")
    .toBoolean(),
  check("rank", "Rank is required!")
    .isInt({ min: 1, max: 5 })
    .withMessage("Invalid rank type, must be an integer between 1-5")
    .toInt(),
  check("wallet", "Wallet amount is required!")
    .isFloat()
    .withMessage("Invalid wallet amount type, must be an float")
    .toFloat(),
  check("customWagerLimit", "Custom wager limit amount is required!")
    .isFloat()
    .withMessage("Invalid custom wager limit amount type, must be an float")
    .toFloat(),
];
router.post("/update", validationChecks, async (req, res, next) => {
  const errors = validationResult(req);

  // Check for validation errors
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    _id,
    banExpires,
    muteExpires,
    transactionsLocked,
    betsLocked,
    rank,
    wallet,
    customWagerLimit,
    verified,
  } = req.body;
  try {
    // Get user from db
    const user = await User.findOne({ _id });

    // If user was not found
    if (!user) {
      res.status(404);
      return next(new Error("Couldn't find an user with that UserID!"));
    }

    // Update document
    await User.updateOne(
      { _id },
      {
        $set: {
          banExpires,
          muteExpires,
          transactionsLocked,
          betsLocked,
          rank,
          wallet,
          customWagerLimit,
          hasVerifiedAccount: verified,
          accountVerified: verified ? Date.now() : null,
        },
      }
    );

    // If user wallet was modified
    if (user.wallet !== wallet) {
      const modifiedAmount =
        user.wallet > wallet
          ? -Math.abs(user.wallet - wallet)
          : user.wallet < wallet
          ? Math.abs(wallet - user.wallet)
          : 0;
      insertNewWalletTransaction(
        _id,
        modifiedAmount,
        "Admin user modification",
        {
          modifierId: req.user.id,
        }
      );
    }
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/external/v1/users/wallet-history/:userId
 * @desc    Get user's wallet history
 * @access  Private
 */
router.get("/wallet-history/:userId", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.userId }).lean();

    // If user was not found
    if (!user) {
      res.status(404);
      return next(new Error("Couldn't find an user with that UserID!"));
    }

    // Get wallet transactions
    const transactions = await WalletTransaction.find({
      _user: req.params.userId,
    }).sort({ created: -1 });

    return res.json(transactions);
  } catch (error) {
    return next(error);
  }
});

export default router;