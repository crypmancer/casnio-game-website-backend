// Import Dependencies
import { database } from "../config/index.js";
import mongoose from "mongoose";

// Setup Additional Variables
const MONGO_URI =
  process.env.NODE_ENV === "production"
    ? database.productionMongoURI
    : database.developmentMongoURI;

// Configure MongoDB and Mongoose
const connectDatabase = async () => {
  try {
    await mongoose
      .connect(MONGO_URI, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
      });
    console.log("MongoDB >> Connected!");
  } catch (error) {
    console.log(`MongoDB ERROR >> ${error.message}`);

    // Exit current process with failure
    process.exit(1);
  }
};

// Export the util
export default connectDatabase;
