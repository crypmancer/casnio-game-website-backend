// Require Dependencies
import mongoose from 'mongoose'

// Setup sbTransaction Schema
const sbTransactionSchema = new mongoose.Schema({
  // Basic fields
  user_id: String,
  order_id: String,
  tid: String,
  hash: String,

  amount: {
    type: Number,
    default: 0,
  },
  user_amount: {
    type: Number,
    default: 0,
  },

  status: {
    type: Number,
    default: 0,
  },

  unixtime: {
    type: Number,
    default: Date.now(),
  },

  // When transaction was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const sbTransaction = mongoose.model(
  "sbTransaction",
  sbTransactionSchema
)

export default sbTransaction;