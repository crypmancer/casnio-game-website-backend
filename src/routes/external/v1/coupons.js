// Require Dependencies
import express from "express";
import { check, validationResult } from "express-validator";

import CouponCode from "../../../models/CouponCode.js";

const router = express.Router()

/**
 * @route   GET /api/external/v1/coupons/list
 * @desc    List all coupons at that time
 * @access  Private
 */
router.get("/list", async (req, res, next) => {
  try {
    const coupons = await CouponCode.find().sort({ created: -1 });

    return res.json(coupons);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/external/v1/coupons/lookup/:couponId
 * @desc    Lookup a single coupon
 * @access  Private
 */
router.get("/lookup/:couponId", async (req, res, next) => {
  try {
    const coupon = await CouponCode.findOne({
      _id: req.params.couponId,
    });

    // If user was not found
    if (!coupon) {
      res.status(404);
      return next(new Error("Couldn't find an coupon with that CouponID!"));
    }

    return res.json(coupon);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   PUT /api/external/v1/coupons/add
 * @desc    Add a new coupon
 * @access  Private
 */
const validationChecks = [
  check("code", "Code is required!")
    .notEmpty()
    .isString()
    .withMessage("Invalid code type, must be an string"),
  check("message", "Message is required!")
    .notEmpty()
    .isString()
    .withMessage("Invalid message type, must be an string"),
  check("uses", "Uses allowed amount is required!")
    .isInt()
    .withMessage("Invalid uses allowed amount type, must be an integer")
    .toInt(),
  check("payout", "Payout amount is required!")
    .isFloat()
    .withMessage("Invalid payout amount type, must be an float")
    .toFloat(),
  check("minLevel", "Minimum level is required!")
    .isInt()
    .withMessage("Invalid minimum level type, must be an integer")
    .toInt(),
];
router.put("/add", validationChecks, async (req, res, next) => {
  const errors = validationResult(req);

  // Check for validation errors
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, uses, message, payout, minLevel } = req.body;
  try {
    // Get coupons with that code
    const existingCoupon = await CouponCode.findOne({ code, active: true });

    // If coupon with that code already exists
    if (existingCoupon) {
      res.status(400);
      return new Error("There is already an active coupon with that code!");
    }

    // Create a new coupon
    const newCoupon = new CouponCode({
      code,
      uses,
      message,
      payout,
      minLevel,
    });

    // Save the new document
    await newCoupon.save();

    return res.json(newCoupon.toObject());
  } catch (error) {
    return next(error);
  }
});

export default router