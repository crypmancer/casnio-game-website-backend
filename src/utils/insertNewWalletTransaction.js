// Import Dependencies
import WalletTransaction from "../models/WalletTransaction.js";

// Insert a new wallet transaction to the database
const insertNewWalletTransaction = async (userId, amount, reason, extraData) => {
  try {
    // Construct new document from given data
    const data = { _user: userId, amount, reason, extraData };
    const newTransaction = new WalletTransaction(data);

    // Save the new document
    await newTransaction.save();

    // Return created document
    return newTransaction.toObject();
  } catch (error) {
    console.error("Error while inserting wallet transaction!", error);
    throw new Error("Failed to insert wallet transaction!");
  }
};

// Export function
export default insertNewWalletTransaction;
