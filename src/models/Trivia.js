// Import Dependencies
import mongoose from "mongoose";

const { Schema, SchemaTypes } = mongoose;

// Setup Trivia Schema
const TriviaSchema = new Schema({
  // Basic fields
  active: Boolean,
  prize: Number,
  question: String,
  answer: String,

  // How many winners does the game have
  winnerAmount: {
    type: Number,
    default: 1,
  },

  // Trivia winners
  winners: {
    type: [
      {
        type: SchemaTypes.ObjectId,
        ref: "User",
      },
    ],
    default: [],
  },

  // When this trivia was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const Trivia = mongoose.model("Trivia", TriviaSchema);

export default Trivia;
