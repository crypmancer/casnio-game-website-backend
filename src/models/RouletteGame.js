// Require Dependencies
import mongoose from 'mongoose'

// Setup RouletteGame Schema
const RouletteGameSchema = new mongoose.Schema({
  // Basic fields
  joinable: Boolean,
  winner: String, // Winning color
  winningMultiplier: Number, // Final multiplier
  players: Array,

  // Provably Fair fields
  privateSeed: String,
  privateHash: String,
  publicSeed: {
    type: String,
    default: null,
  },
  randomModule: {
    type: Number,
    default: null,
  },

  // When game was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const RouletteGame = mongoose.model(
  "RouletteGame",
  RouletteGameSchema
)

export default RouletteGame
