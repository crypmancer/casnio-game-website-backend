// Require Dependencies
import mongoose from "mongoose";
const SchemaTypes = mongoose.Schema.Types;

// Setup CouponCode Schema
const CouponCodeSchema = new mongoose.Schema({
  // Basic fields
  code: String,
  message: String,
  payout: Number,

  // Whether this coupon is active
  active: {
    type: Boolean,
    default: true,
  },

  // How many times this coupon can be used
  uses: {
    type: Number,
    default: 1,
  },

  // Minimum level that users have to be to use the coupon
  minLevel: {
    type: Number,
    default: 1,
  },

  // Users who have claimed this coupon code
  claimedUsers: {
    type: Array,
    default: [],
  },

  // When coupon code was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const CouponCode = mongoose.model(
  "CouponCode",
  CouponCodeSchema
);

export default CouponCode