// Import Dependencies
import mongoose from "mongoose";

// Destructure Schema Types
const { Schema, Types: SchemaTypes } = mongoose;

// Setup User Schema
const UsernameChangeSchema = new Schema({
    // related fields
    id_user: String,

    // When this userID last changed his username 
    used: {
        type: Date,
        default: Date.now,
    },
});

// Create and export the new model
const UsernameChange = mongoose.model("UsernameChange", UsernameChangeSchema);

export default UsernameChange;
