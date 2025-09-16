// Require Dependencies
import mongoose from 'mongoose'

const Schema = mongoose.Schema;

// Setup TransactionHis Schema
const RevenueSchema = new Schema({
  
  // Winner id
  userid: {
    type: Schema.Types.ObjectId,
    ref:'users',
    required: true
  },

  // Revenue type 4: coinflip, 3: jackpot, 1: roulette, 2: crash
  revenueType: {
    type: Number,
    required: true
  },

  // Balance
  revenue: {
    type: Number,
    require: true,
  },

  // Last balance
  lastBalance: {
    type: Number,
    require: true
  },

  created: {
    type: Date,
    default: Date.now
  }
});

// Create and export the new model
const RevenueLog = mongoose.model(
  "RevenueLog",
  RevenueSchema
)

export default RevenueLog;