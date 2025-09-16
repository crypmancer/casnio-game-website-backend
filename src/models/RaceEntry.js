// Require Dependencies
import mongoose from 'mongoose'
const SchemaTypes = mongoose.Schema.Types;

// Setup RaceEntry Schema
const RaceEntrySchema = new mongoose.Schema({
  // How much user has contributed to this race
  value: Number,

  // Who owns this entry
  _user: {
    type: SchemaTypes.ObjectId,
    ref: "User",
  },

  user_level: {
    type: String
  },

  user_levelColor: {
    type: String
  },

  username: {
    type: String
  },

  avatar: {
    type: String
  },

  // What race is this entry for
  _race: {
    type: SchemaTypes.ObjectId,
    ref: "Race",
  },

  // When race was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const RaceEntry = mongoose.model(
  "RaceEntry",
  RaceEntrySchema
)

export default RaceEntry;