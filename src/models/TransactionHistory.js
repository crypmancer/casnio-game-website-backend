// Require Dependencies
import mongoose from 'mongoose'

const Schema = mongoose.Schema;

// Setup TransactionHis Schema
const TransactionHisSchema = new Schema({
  userid: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  tranType: {
    type: String,
    default: 'in', // when deposit 'in', withdraw 'out'
  },
  userBalance: {
    type: Number,
    required: true // User site balance before the deposit or withdraw
  },
  walletAddress: {
    type: String,
    required: true
  },
  txid: {
    type: String,
    required: true, // Transaction hashid
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  // When transaction was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const TransactionHis = mongoose.model(
  "TransactionHiss",
  TransactionHisSchema
)

export default TransactionHis;