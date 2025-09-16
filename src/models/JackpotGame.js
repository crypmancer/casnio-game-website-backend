// Require Dependencies
import mongoose from 'mongoose';

// Setup JackpotGame Schema
const JackpotGameSchema = new mongoose.Schema({
  // Basic fields
  winner: Object,
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
const JackpotGame = mongoose.model(
  "JackpotGame",
  JackpotGameSchema
)

export default JackpotGame;
