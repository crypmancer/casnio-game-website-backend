// Import Dependencies
import mongoose from "mongoose";

// Destructure Schema Types
const { Schema, Types: SchemaTypes } = mongoose;

// Setup Race Schema
const RaceSchema = new Schema({
  // Basic fields
  active: Boolean,
  prize: Number,
  endingDate: Date,

  // Race winners
  winners: {
    type: [
      {
        type: SchemaTypes.ObjectId,
        ref: "User",
      },
    ],
    default: [],
  },

  // When race was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const Race = mongoose.model("Race", RaceSchema);

export default Race;
