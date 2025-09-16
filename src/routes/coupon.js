// Require Dependencies
import express from "express";
const router = express.Router();
import { validateJWT } from  "../middleware/auth.js";
import { check, validationResult } from  "express-validator";
import insertNewWalletTransaction from  "../utils/insertNewWalletTransaction.js";
import {getVipLevelFromWager} from  "../controllers/vip.js";

import User from  "../models/User.js";
import CouponCode from  "../models/CouponCode.js";

/**
 * @route   POST /api/coupon/redeem
 * @desc    Redeem a coupon code
 * @access  Private
 */
router.post(
  "/redeem",
  [
    validateJWT,
    check("code", "Coupon code is required")
      .notEmpty()
      .isString()
      .withMessage("Invalid coupon code type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      // Get user
      const user = await User.findOne({ _id: req.user.id });

      // If user is not found
      if (!user) {
        return next(
          new Error("Couldn't find user! Maybe database did an error?")
        );
      }

      // If user has restricted transactions
      if (user.transactionsLocked) {
        res.status(403);
        return next(
          new Error(
            "Your account has a transaction restriction. Please contact support for more information."
          )
        );
      }

      // If user isn't verified     !user.hasVerifiedAccount
      // if (user.totalDeposited < 5) {
      //   res.status(400);
      //   return next(
      //     new Error(
      //       "You must deposit min. $5.00 before redeeming a coupon code!"
      //     )
      //   );
      // }

      // Get coupon code
      const coupon = await CouponCode.findOne({ code, active: true });

      // If coupon doesn't exist
      if (!coupon) {
        res.status(400);
        return next(
          new Error("This coupon code doesn't exist or has been expired!")
        );
      }

      // Check if user has already claimed this code
      if (coupon.claimedUsers.includes(user.id)) {
        res.status(403);
        return next(new Error("You have already used this coupon code!"));
      }

      // Check for VIP level requirements
      if (+getVipLevelFromWager(user.wager).name < coupon.minLevel) {
        res.status(400);
        return next(
          new Error(
            `You must be at least level ${coupon.minLevel} to use this coupon code!`
          )
        );
      }

      // Check if this is final claim
      if (coupon.claimedUsers.length + 1 >= coupon.uses) {
        // Update document
        await CouponCode.updateOne(
          { _id: coupon.id },
          { $set: { active: false }, $push: { claimedUsers: user.id } }
        );
      } else {
        // Update document
        await CouponCode.updateOne(
          { _id: coupon.id },
          { $push: { claimedUsers: user.id } }
        );
      }

      // Update user balance
      await User.updateOne(
        { _id: user.id },
        { $inc: { wallet: coupon.payout } }
      );
      insertNewWalletTransaction(user.id, coupon.payout, "Coupon redeemed", {
        couponId: coupon.id,
      });

      return res.json({ message: coupon.message, payout: coupon.payout });
    } catch (error) {
      return next(error);
    }
  }
);

export default router