// Import Dependencies
import mongoose from "mongoose";
const { Schema, SchemaTypes } = mongoose;

// Setup WalletTransaction Schema
const WalletTransactionSchema = new Schema({
  // Amount that was increased or decreased
  amount: Number,

  // Reason for this wallet transaction
  reason: String,

  // Extra data relating to this transaction
  // game data, crypto transaction data, etc.
  extraData: {
    coinflipGameId: {
      type: SchemaTypes.ObjectId,
      ref: "CoinflipGame",
    },
    jackpotGameId: {
      type: SchemaTypes.ObjectId,
      ref: "JackpotGame",
    },
    rouletteGameId: {
      type: SchemaTypes.ObjectId,
      ref: "RouletteGame",
    },
    crashGameId: {
      type: SchemaTypes.ObjectId,
      ref: "CrashGame",
    },
    transactionId: {
      type: SchemaTypes.ObjectId,
      ref: "CryptoTransaction",
    },
    couponId: {
      type: SchemaTypes.ObjectId,
      ref: "CouponCode",
    },
    affiliatorId: {
      type: SchemaTypes.ObjectId,
      ref: "User",
    },
    modifierId: {
      type: SchemaTypes.ObjectId,
      ref: "User",
    },
    raceId: {
      type: SchemaTypes.ObjectId,
      ref: "Race",
    },
    triviaGameId: {
      type: SchemaTypes.ObjectId,
      ref: "Trivia",
    },
  },

  // What user does this belong to
  _user: {
    type: SchemaTypes.ObjectId,
    ref: "User",
  },

  // When document was inserted
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const WalletTransaction = mongoose.model("WalletTransaction", WalletTransactionSchema);
export default WalletTransaction;
