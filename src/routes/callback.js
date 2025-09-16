// Require Dependencies
import express from "express";
import { verify } from "coinpayments-ipn";
import {
  checkNotificationAuthenticity,
  getExchangeRate,
} from "../controllers/coinbase.js";
import colors from "colors/safe.js";
import {authentication} from "../config/index.js";
import insertNewWalletTransaction from "../utils/insertNewWalletTransaction.js";

import User from "../models/User.js";
import CryptoTransaction from "../models/CryptoTransaction.js";

const router = express.Router();

/**
 * @route   POST /api/callback/coinpayments/deposit/:userId
 * @desc    Coinpayments IPN Listener route
 * @access  Public
 */
router.post("/coinpayments/deposit/:userId", async (req, res, next) => {
  const transaction = req.body;
  const userId = req.params.userId;
  const HMAC = req.header("HMAC");

  // Validate IPN
  if (!transaction || !userId || !HMAC) {
    res.status(400);
    console.log("Invalid params! (not all found)");
    return next(new Error("Invalid params! (not all found)"));
  }

  console.log(
    colors.yellow("Coinpayments >> Verifying incoming IPN message...")
  );

  try {
    // Verify signature
    await verifySignature(
      HMAC,
      authentication.coinpayments.ipnSecret,
      transaction
    );

    console.log(colors.yellow("Coinpayments >> Valid IPN Detected!"));

    // Get user
    const user = await User.findOne({ _id: userId });

    // If user doesn't exist
    if (!user) {
      res.status(400);
      return next(new Error("Invalid UserID (not found)"));
    }

    // Get existing document from db
    const existingDocument = await CryptoTransaction.findOne({
      txid: transaction.txn_id,
    });

    // Get raw status from CoinPayments
    const rawStatus = parseInt(transaction.status);

    // Parse raw status to state number
    const stateNumber =
      rawStatus >= 100 || rawStatus === 2
        ? 3
        : rawStatus < 0
        ? 2
        : rawStatus >= 0 && rawStatus < 100
        ? 1
        : null;

    // Check if state is invalid
    if (!stateNumber) {
      console.log(
        colors.yellow("Coinpayments >> Invalid state (e.g processing)!")
      );

      res.status(400);
      return next(new Error("Invalid params! (state)"));
    }

    const newTransaction = new CryptoTransaction();

    // If there is an existing document
    if (existingDocument) {
      // Update the document
      await CryptoTransaction.updateOne(
        { txid: transaction.txn_id },
        { $set: { state: stateNumber, txid: transaction.txn_id } }
      );
    } else {
      // Create a new document
      newTransaction.type = "deposit"; // Transaction type

      newTransaction.currency = transaction.currency; // Crypto currency name
      newTransaction.siteValue = parseFloat(transaction.fiat_amount); // Value in site balance (USD)
      newTransaction.cryptoValue = parseFloat(transaction.amount); // Value in crypto currency
      newTransaction.address = transaction.address; // Crypto address

      newTransaction.txid = transaction.txn_id; // Blockchain transaction id
      newTransaction.state = stateNumber; // 1 = pending, 2 = declined, 3 = completed

      newTransaction._user = userId; // User who made this transaction

      // Save the document
      await newTransaction.save();
    }

    // Check if postback was a successful deposit ipn
    if (stateNumber === 3) {
      const payout = parseFloat(transaction.fiat_amount);

      // Update user balance
      await User.updateOne(
        { _id: userId },
        { $inc: { wallet: Math.abs(payout), totalDeposited: Math.abs(payout) } }
      );
      insertNewWalletTransaction(userId, Math.abs(payout), "Crypto Deposit", {
        transactionId: existingDocument
          ? existingDocument.id
          : newTransaction.id,
      });

      console.log(
        colors.yellow(
          `Coinpayments >> Deposit Processed. User ${userId} has been given ${Math.abs(
            payout
          )} credits. Debug:`
        ),
        { payout, real: Math.abs(payout) }
      );
    } else {
      console.log(
        colors.yellow(
          `Coinpayments >> Transaction Processed. Status: ${stateNumber}, Type: Deposit`
        )
      );
    }

    // Send HTTP 200 to the Coinpayments Server
    return res.sendStatus(200);
  } catch (error) {
    console.log(
      colors.yellow("Coinpayments >> IPN Message validation"),
      colors.red("failed!")
    );
    // console.log("There was an error while validating coinpayments IPN:", error);

    res.status(400);
    return next(new Error("Invalid postback signature."));
  }
});

/**
 * @route   POST /api/callback/coinpayments/withdraw/:withdrawId
 * @desc    Coinpayments IPN Listener route
 * @access  Public
 */
router.post("/coinpayments/withdraw/:withdrawId", async (req, res, next) => {
  const transaction = req.body;
  const withdrawId = req.params.withdrawId;
  const HMAC = req.header("HMAC");

  // Validate IPN
  if (!transaction || !withdrawId || !HMAC) {
    res.status(400);
    console.log("Invalid params! (not all found)");
    return next(new Error("Invalid params! (not all found)"));
  }

  console.log(
    colors.yellow("Coinpayments >> Verifying incoming IPN message...")
  );

  try {
    // Verify signature
    await verifySignature(
      HMAC,
      authentication.coinpayments.ipnSecret,
      transaction
    );

    console.log(colors.yellow("Coinpayments >> Valid IPN Detected!"));

    // Get existing document from db
    const existingDocument = await CryptoTransaction.findOne({
      _id: withdrawId,
    });

    // If withdraw doesn't exist
    if (!existingDocument) {
      res.status(400);
      return next(new Error("Invalid Withdraw (not found)"));
    }

    // Get raw status from CoinPayments
    const rawStatus = parseInt(transaction.status);

    // Parse raw status to state number
    const stateNumber =
      rawStatus === 2
        ? 3
        : rawStatus < 0
        ? 2
        : rawStatus >= 0 && rawStatus < 2
        ? 1
        : null;

    // Check if state is invalid
    if (!stateNumber) {
      console.log(
        colors.yellow("Coinpayments >> Invalid state (e.g processing)!")
      );

      res.status(400);
      return next(new Error("Invalid params! (state)"));
    }

    // Update the document
    await CryptoTransaction.updateOne(
      { _id: withdrawId },
      { $set: { state: stateNumber, txid: transaction.txn_id } }
    );

    console.log(
      colors.yellow(
        `Coinpayments >> Transaction Processed. Status: ${stateNumber}, Type: Withdraw`
      )
    );

    // Send HTTP 200 to the Coinpayments Server
    return res.sendStatus(200);
  } catch (error) {
    console.log(
      colors.yellow("Coinpayments >> IPN Message validation"),
      colors.red("failed!")
    );
    // console.log("There was an error while validating coinpayments IPN:", error);

    res.status(400);
    return next(new Error("Invalid postback signature."));
  }
});

/**
 * @route   POST /api/callback/coinbase
 * @desc    Coinbase IPN Listener route
 * @access  Public
 */
router.post("/coinbase", async (req, res, next) => {
  try {
    const signature = req.header("CB-SIGNATURE");

    // Verify signature
    const isValid = await checkNotificationAuthenticity(
      JSON.stringify(req.body),
      signature
    );

    // Check if signature was valid
    if (isValid) {
      const notification = req.body;

      console.log(
        "Coinbase >> NOTIFICATION TYPE:",
        notification.type,
        notification
      );

      // Check that this is an IPN
      if (notification.type === "wallet:addresses:new-payment") {
        const cryptoAmount = parseFloat(
          notification.additional_data.amount.amount
        );
        const currency = notification.additional_data.amount.currency;

        // Get user who made this deposit
        const user = await User.findOne({
          [`crypto.${currency.toLowerCase()}.coinbaseId`]: notification.data.id,
        });

        // If user was not found in our database (not a site deposit)
        if (!user) {
          return console.log(
            colors.blue("Coinbase >> IPN verified! (not a deposit to the site)")
          );
        }

        // Get exchange rate
        const exchangeRate = await getExchangeRate(currency, "USD");

        // Calculate site amount
        const exchangedAmount = parseFloat(
          (cryptoAmount * exchangeRate).toFixed(2)
        );

        // Create a new document
        const newTransaction = new CryptoTransaction({
          type: "deposit", // Transaction type

          currency, // Crypto currency name
          siteValue: exchangedAmount, // Value in site balance (USD)
          cryptoValue: cryptoAmount, // Value in crypto currency
          address: notification.data.address, // Crypto address

          txid: notification.additional_data.hash, // Blockchain transaction id
          state: 3, // 1 = pending, 2 = declined, 3 = completed

          _user: user.id, // User who made this transaction
        });

        // Save the document
        await newTransaction.save();

        // Update user document
        await User.updateOne(
          { _id: user.id },
          {
            $inc: {
              wallet: exchangedAmount,
              totalDeposited: exchangedAmount,
              wagerNeededForWithdraw:
                user.wagerNeededForWithdraw < 0
                  ? Math.abs(user.wagerNeededForWithdraw) + exchangedAmount
                  : exchangedAmount, // Add 100% to required wager amount
            },
          }
        );
        insertNewWalletTransaction(user.id, exchangedAmount, "Crypto deposit", {
          transactionId: newTransaction.id,
        });

        // Log debug info
        console.log(
          colors.blue("Coinbase >> IPN verified! Gave"),
          colors.cyan(exchangedAmount),
          colors.blue("credits to"),
          colors.cyan(user.username)
        );
      }

      // Return 200, so the notification doesn't get put on retry list
      return res.sendStatus(200);
    } else {
      res.status(400);
      return next(new Error("Invalid signature!"));
    }
  } catch (error) {
    // console.log(error);
    return next(
      new Error("Something went wrong, couldn't process notification!")
    );
  }
});

// Functions
async function verifySignature(hmac, ipnSecret, payload) {
  return new Promise((resolve, reject) => {
    let isValid, error;

    try {
      isValid = verify(hmac, ipnSecret, payload);
    } catch (e) {
      error = e;
    }

    if (error) {
      reject(error);
    }

    if (isValid) {
      // valid
      resolve();
    } else {
      // invalid
      reject();
    }
  });
}

export default router