// Require Dependencies
// Import Dependencies
import express from "express";
import rateLimit from "express-rate-limit";
import { check, validationResult } from "express-validator";
import { validateJWT } from "../middleware/auth.js";
import {
  sendVerficationTextMessage,
  verifyTextMessageCode,
} from "../controllers/twilio.js";
import { checkInventoryForLoyaltyBadge } from "../controllers/steam.js";
import { authentication, site } from "../config/index.js";
import insertNewWalletTransaction from "../utils/insertNewWalletTransaction.js";
import { checkMaintenance } from "../middleware/maintenance.js";
import { verifyRecaptchaResponse } from "../controllers/recaptcha.js";

import User from "../models/User.js";
import WalletTransaction from "../models/WalletTransaction.js";
import CoinflipGame from "../models/CoinflipGame.js";
import CrashGame from "../models/CrashGame.js";
import JackpotGame from "../models/JackpotGame.js";
import RouletteGame from "../models/RouletteGame.js";
import TransactionHis from "../models/TransactionHistory.js";

import { Blockfrost, Lucid } from "lucid-cardano";
import axios from "axios";

// Create Express Router
const router = express.Router();

// Create request limiter
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1, // limit each IP to 100 requests per windowMs
  message: {
    error: "You can do this only every 5 minutes. Please wait",
    stack: {},
  },
});

// Combine middleware
const middleware = [checkMaintenance, validateJWT];

/**
 * @route   GET /api/user/
 * @desc    Get authenticated user
 * @access  Private
 */
router.get("/", validateJWT, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id }).select({
      crypto: 0,
      phoneVerificationCode: 0,
    });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }
    return res.json({
      user,
      token: req.authToken,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/user/history
 * @desc    Get authenticated user's games history
 * @access  Private
 */
router.get("/history", middleware, async (req, res, next) => {
  try {
    // Get user
    const user = await User.findOne({ _id: req.user.id });
    const query = { "players._id": user.id };

    // Get user jackpot games
    const jackpotQuery = { "_winner._id": user.id };
    const jackpotGames = await JackpotGame.find(query).lean();
    const jackpotGamesWon = await JackpotGame.find(jackpotQuery).lean();

    // Convert every document to a game object
    const gamesPlayed = [
      ...jackpotGames.map(g => ({
        ...g,
        gamemode: "jackpot",
        ownBetAmount: g.players.find(player => player._id === user.id)
          .betAmount,
      })),
    ];

    // Convert every document to a game object
    const gamesWon = [
      ...jackpotGamesWon.map(g => ({
        ...g,
        gamemode: "jackpot",
        ownBetAmount: g.players.reduce((a, b) => a.betAmount + b.betAmount, 0),
      })),
    ];

    return res.json(
      [
        ...gamesPlayed.map(game => ({ ...game, won: false })),
        ...gamesWon.map(game => ({ ...game, won: true })),
      ].sort((a, b) => b.created - a.created)
    );
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/user/profile
 * @desc    Get authenticated user's profile info
 * @access  Private
 */
router.get("/profile", middleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }

    // Get wallet transactions
    const transactions = await WalletTransaction.find({
      _user: user.id,
    }).sort({ created: -1 });

    // Get user games
    const coinflipGames = await CoinflipGame.find({ "players._id": user.id });
    const coinflipGamesWon = await CoinflipGame.find({ _winner: user.id });
    const jackpotGames = await JackpotGame.find({ "players._id": user.id });
    const jackpotGamesWon = await JackpotGame.find({ "_winner._id": user.id });
    const rouletteGames = await RouletteGame.find({
      "players._id": user.id,
    }).lean();

    const crashGames = await CrashGame.find({ _players: user.id });

    const rouletteGamesWon = rouletteGames.filter(
      game =>
        game.winner ===
        game.players.find(player => player._id === user.id).color
    );

    // Convert every document to a game object
    const gamesPlayed = [
      ...coinflipGames,
      ...jackpotGames,
      ...rouletteGames,
      ...crashGames,
    ];

    // Convert every document to a game object
    const gamesWon = [
      ...coinflipGamesWon,
      ...jackpotGamesWon,
      ...rouletteGamesWon,
    ];

    return res.json({
      gamesPlayed: gamesPlayed.length,
      gamesWon: gamesWon.length,
      totalDeposited: user.totalDeposited.toFixed(2),
      totalWithdrawn: user.totalWithdrawn.toFixed(2),
      wager: user.wager.toFixed(2),
      avatar: user.avatar,
      username: user.username,
      hasVerifiedAccount: user.hasVerifiedAccount,
      transactions,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route  POST /api/user/deposit
 * @desc   Set deposit value
 * @access Private
 */
router.post('/deposit', middleware, async (req, res, next) => {
  const { txHash } = req.body;
  const { id: userId } = req.user;

  if (!txHash) return res.status(400).json("Not found txHash");
  console.log(`${userId} is trying to deposit ...`);

  const user = await User.findById(userId);
  if (!user) {
    return res.status(400).json("Invalid userId")
  }

  setTimeout(async () => {
    try {
      const transactionHistory = await TransactionHis.findOne({ txid: txHash });
      if (transactionHistory) {
        return res.status(400).json("TxHash: Already used")
      }

      const url = `https://mainnet.gomaestro-api.org/v1/transactions/${txHash}`
      const apiKey = "PdWqWqI3mamC6VcAUBop74xhyHUnYqFN";

      const { data } = await axios.get(
        url,
        {
          headers: {
            'api-key': apiKey,
            "Accept": "application/json",
          }
        }
      );

      const { outputs, inputs, block_timestamp } = data.data;

      if (block_timestamp + 2 * 60 < Math.round((new Date().getTime()) / 1000)) {
        return res.status(400).json("Expired Transaction");
      }

      if (outputs[0].address == authentication.siteWallet) {
        const depositAmount = Math.round(outputs[0].assets[0].amount / 1000000).toFixed(3);
        const newBalance = user?.wallet || 0 + depositAmount;

        const newTransaction = new TransactionHis({
          userid: userId,
          tranType: 'in',
          userBalance: newBalance,
          walletAddress: inputs[0].address,
          txid: txHash,
          amount: depositAmount
        })

        await newTransaction.save();
        await User.findByIdAndUpdate(userId, { wallet: newBalance, totalDeposited: depositAmount });

        return res.json(newTransaction)
      } else {
        res.status(500).json("Invalid Transactin!")
      }
    } catch (error) {
      console.error(error)
      res.status(500).json(error)
    }
  },
    60000
  )
})

/**
 * @route  POST /api/user/withdraw
 * @desc   Withdraw balance
 * @access Private
 */
router.post('/withdraw', middleware, async (req, res, next) => {
  const { withdrawmount, addr } = req.body;
  const { id: userId } = req.user;

  if (Number(withdrawmount) <= 0) return res.status(400).json("Please set the correct amount.")
  else if (Number(withdrawmount) >= 2000) return res.status(400).json("You can't withdraw 2000 or more in day.")

  const user = await User.findById(userId);
  if (!user) {
    return res.status(400).json("Invalid userId")
  }

  try {
    if (Number(withdrawmount) > user.wallet) {
      return res.status(400).json("You don't have enough balance to withdraw!")
    }

    const now = new Date().getTime();
    const lastUpdateTime = user?.updated || now;
    const prevAmount = user?.dailyAmount || 0;

    if (now < lastUpdateTime + 1 * 240 * 3600 * 1000) {
      if (prevAmount + Number(withdrawmount) > 5) {
        return res.status(400).json("Excceeded daily withdraw amount")
      }
      await User.findByIdAndUpdate(
        userId,
        {
          $inc: { wallet: -Number(withdrawmount), totalWithdrawn: Number(withdrawmount) },
          $set: { dailyAmount: prevAmount + Number(withdrawmount) }
        });
    } else {
      await User.findByIdAndUpdate(
        userId,
        {
          $inc: { wallet: -Number(withdrawmount), totalWithdrawn: Number(withdrawmount) },
          $set: { updated: now, dailyAmount: 0 }
        });
    }

    const lucid = await Lucid.new(
      new Blockfrost("https://cardano-mainnet.blockfrost.io/api/v0", "mainnetPyANQaTTEveFQJYxdBE7QS0P57BxJgqE"), //mainnetPyANQaTTEveFQJYxdBE7QS0P57BxJgqE
      "Mainnet",
    );

    lucid.selectWalletFromSeed('napkin talent dentist ecology invite script swear rent visit finger dry correct gold scout basket');

    const tx = await lucid.newTx()
      .payToAddress(addr, { lovelace: (Number(withdrawmount) - 1) * 1000000 })
      .complete();
    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();

    const newTransaction = new TransactionHis({
      userid: userId,
      tranType: 'out',
      userBalance: user.wallet,
      walletAddress: addr,
      txid: txHash,
      amount: Number(withdrawmount) - 1
    })
    await newTransaction.save();

    res.json(newTransaction);
  } catch (error) {
    console.error(error)
    res.status(500).json(error)
  }
})

/**
 * @route   GET /api/user/affiliates
 * @desc    Get authenticated user's affiliate info
 * @access  Private
 */
router.get("/affiliates", middleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }

    // Get user's affiliator
    const affiliator = await User.findOne({ _id: user._affiliatedBy });
    const affiliatedUsers = await User.find({
      _affiliatedBy: user.id,
    }).select({ username: 1, avatar: 1, wager: 1 });

    return res.json({
      affiliateCode: user.affiliateCode || "",
      affiliateLink: user.affiliateCode
        ? `${site.frontend.productionUrl}/a/${user.affiliateCode}`
        : "Set affiliate code first!",
      affiliateMoney: user.affiliateMoney,
      affiliateMoneyAvailable:
        user.affiliateMoney - user.affiliateMoneyCollected,
      affiliateMoneyCollected: user.affiliateMoneyCollected,
      usersAffiliated: affiliatedUsers.length,
      currentlySupporting: affiliator
        ? { code: affiliator.affiliateCode, username: affiliator.username }
        : null,
      affiliatedUsers,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/user/affiliates/update-code
 * @desc    Update user's affiliate code
 * @access  Private
 */
router.post(
  "/affiliates/update-code",
  [
    checkMaintenance,
    validateJWT,
    check("code", "New affiliate code is required")
      .notEmpty()
      .isString()
      .withMessage("Invalid affiliate code type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      // Remove any illegal characters
      const parsedCode = encodeURI(
        code
          .replace(/[^\w\s]/gi, "")
          .replace(/\s/g, "")
          .toLowerCase()
      );

      // If still not valid
      if (parsedCode.length < 3) {
        res.status(400);
        return next(
          new Error(
            "Your code must be atleast 3 characters long and musn't contain special characters!"
          )
        );
      }

      // Get existing user with that affiliate code
      const existingUser = await User.findOne({
        affiliateCode: parsedCode,
      });

      // If affiliate code is already in-use
      if (existingUser && existingUser.id !== req.user.id) {
        res.status(400);
        return next(new Error("This affiliate code is already in-use!"));
      }

      // Update user document
      await User.updateOne(
        { _id: req.user.id },
        { $set: { affiliateCode: parsedCode } }
      );

      return res.json({ newAffiliateCode: parsedCode });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   POST /api/user/affiliates/redeem
 * @desc    Redeem affiliate code and receive first time $0.10
 * @access  Private
 */
router.post(
  "/affiliates/redeem",
  [
    checkMaintenance,
    validateJWT,
    check("code", "Affiliate code is required")
      .notEmpty()
      .isString()
      .withMessage("Invalid affiliate code type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      // Get user from db
      const user = await User.findOne({ _id: req.user.id });

      // If user is not found
      if (!user) {
        return next(
          new Error("Couldn't find user! Maybe database did an error?")
        );
      }

      // If user isn't verified   !user.hasVerifiedAccount
      //if (user.totalDeposited < 5) {
      //  res.status(400);
      //  return next(
      //    new Error(
      //      "You must deposit min. $5.00 before redeeming an affiliate code!"
      //    )
      //  );
      //}

      // Get existing user with that affiliate code
      const existingUser = await User.findOne({
        affiliateCode: code.toLowerCase(),
      });

      // If affiliate code isn't valid
      if (!existingUser) {
        res.status(400);
        return next(
          new Error(
            "This affiliate code doesn't belong to anyone! Please double-check your input"
          )
        );
      }

      // If user is trying to affiliate himself
      if (existingUser.id === user.id) {
        res.status(400);
        return next(new Error("You can't affiliate yourself :)"));
      }

      // If this is user's first time redeeming a code
      if (!user._affiliatedBy) {
        // Update user
        await User.updateOne(
          { _id: user.id },
          {
            $inc: { wallet: 0.1 },
            $set: {
              _affiliatedBy: existingUser.id,
              affiliateClaimed: new Date().toISOString(),
            },
          }
        );
        insertNewWalletTransaction(
          user.id,
          0.1,
          "First time affiliate redeem",
          { affiliatorId: existingUser.id }
        );

        return res.json({
          code,
          username: existingUser.username,
          freeMoneyClaimed: true,
        });
      } else {
        // Update user
        await User.updateOne(
          { _id: user.id },
          { $set: { _affiliatedBy: existingUser.id } }
        );

        return res.json({
          code,
          username: existingUser.username,
          freeMoneyClaimed: false,
        });
      }
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   POST /api/user/affiliates/claim
 * @desc    Claim user's affiliate earnings
 * @access  Private
 */
router.post("/affiliates/claim", middleware, async (req, res, next) => {
  try {
    // Get user from DB
    const user = await User.findOne({ _id: req.user.id });

    // If user doesn't exist
    if (!user) {
      res.status(400);
      return next(new Error("User not found! (database error)"));
    }

    // User affiliate revenue
    const affiliateRevenue = user.affiliateMoney - user.affiliateMoneyCollected;

    // Check if user has enough revenue to collect it
    if (affiliateRevenue < 1) {
      res.status(400);
      return next(
        new Error("You must have collected atleast $1.00 before claiming it!")
      );
    }

    // Update user document
    await User.updateOne(
      { _id: user.id },
      {
        $inc: {
          wallet: Math.abs(affiliateRevenue),
          affiliateMoneyCollected: Math.abs(affiliateRevenue),
        },
      }
    );
    insertNewWalletTransaction(
      user.id,
      Math.abs(affiliateRevenue),
      "Affiliate revenue claim"
    );

    return res.json({ claimedAmount: parseFloat(affiliateRevenue.toFixed(2)) });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/user/verify
 * @desc    Return data required to verify user's account
 * @access  Private
 */
router.get("/verify", middleware, async (req, res, next) => {
  try {
    // Get user from DB
    const user = await User.findOne({ _id: req.user.id });

    // If user doesn't exist
    if (!user) {
      res.status(400);
      return next(new Error("User not found! (database error)"));
    }

    return res.json({
      hasVerifiedAccount: user.hasVerifiedAccount,
      verifiedPhoneNumber: user.verifiedPhoneNumber,
      verificationType: "textmessage",
      // user.provider === "steam" ? "loyaltybadge" : "textmessage",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/user/verify/check
 * @desc    Check Steam user's inventory for Loyalty Badge
 * @access  Private
 */
router.post(
  "/verify/check",
  [checkMaintenance, validateJWT, limiter],
  async (req, res, next) => {
    res.status(400);
    return next(
      new Error(
        "We have removed this verification method, please use the SMS verification instead!"
      )
    );
    try {
      const user = await User.findOne({ _id: req.user.id });

      // If user doesn't exist
      if (!user) {
        res.status(400);
        return next(new Error("User not found! (database error)"));
      }

      // Check that user has registered with Steam
      if (user.hasVerifiedAccount || user.provider !== "steam") {
        res.status(400);
        return next(new Error("You can't verify using this method!"));
      }

      // Check if user has loyalty badge
      const hasBadge = await checkInventoryForLoyaltyBadge(user.providerId);

      // If user doesn't have the badge
      if (!hasBadge) {
        res.status(400);
        return next(
          new Error(
            "Couldn't find the Loyalty Badge in your CS:GO inventory. Unfortunately you cannot verify your account at the moment."
          )
        );
      }

      // Update user
      await User.updateOne(
        { _id: user.id },
        {
          $set: {
            hasVerifiedAccount: true,
            accountVerified: new Date().toISOString(),
          },
        }
      );

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   POST /api/user/verify/send
 * @desc    Send an SMS verification code to user's phone number
 * @access  Private
 */
router.post(
  "/verify/send",
  [
    checkMaintenance,
    validateJWT,
    check("number", "Phone number is required")
      .notEmpty()
      .bail()
      .isString()
      .withMessage("Invalid phone number type")
      .bail(),
    // .isMobilePhone("any", { strictMode: true })
    // .withMessage("Please enter a valid phone number"),
    check("recaptchaResponse", "Please check the ReCAPTCHA field").notEmpty(),
    limiter,
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { number, recaptchaResponse } = req.body;
    try {
      // Verify reCaptcha response
      const valid = await verifyRecaptchaResponse(recaptchaResponse);

      // If captcha wasn't valid
      if (!valid) {
        res.status(400);
        return next(
          new Error("Invalid ReCAPTCHA response, please try again later!")
        );
      }

      const user = await User.findOne({ _id: req.user.id });

      // If user doesn't exist
      if (!user) {
        res.status(400);
        return next(new Error("User not found! (database error)"));
      }

      // // If user has registered with steam
      // if (user.provider === "steam") {
      //   res.status(400);
      //   return next(
      //     new Error(
      //       "You can't use this verification method because you registered with Steam!"
      //     )
      //   );
      // }

      // Get account registered with this number
      const registeredUser = await User.findOne({
        verifiedPhoneNumber: number,
      });

      // If number is registered to another user
      if (registeredUser && registeredUser.id !== user.id) {
        res.status(400);
        return next(
          new Error(
            "This phone number has been used to register another user, please use a different phone number."
          )
        );
      }

      // Try to send the message
      await sendVerficationTextMessage(number);

      // Update user
      await User.updateOne(
        { _id: user.id },
        { $set: { verifiedPhoneNumber: number } }
      );

      return res.json({ mobileNumber: number });
    } catch (error) {
      console.log(
        "Error while sending verification code:",
        error.message,
        error.code,
        error.moreInfo
      );

      // Check if this was valid twilio error
      if (error.code && error.moreInfo) {
        // Filter common statuses
        if (error.code === 20003) {
          return next(
            new Error(
              "We are currently unavailable to send your verification code, please contact admins with this error code: 20003"
            )
          );
        } else {
          return next(
            new Error(
              "Couldn't send your verification code! Error: " + error.code
            )
          );
        }
      } else {
        return next(error);
      }
    }
  }
);

/**
 * @route   POST /api/user/verify/submit
 * @desc    Check verification code to verify user
 * @access  Private
 */
router.post(
  "/verify/submit",
  [
    checkMaintenance,
    validateJWT,
    check("code", "Verification code is required")
      .notEmpty()
      .bail()
      .isString()
      .withMessage("Invalid verification code type")
      .bail()
      .isLength({ min: 6, max: 6 })
      .withMessage("Invalid verification code!"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      const user = await User.findOne({ _id: req.user.id });

      // If user doesn't exist
      if (!user) {
        res.status(400);
        return next(new Error("User not found! (database error)"));
      }

      // Check that user hasn't registered with Steam
      if (user.hasVerifiedAccount /* || user.provider === "steam" */) {
        res.status(400);
        return next(new Error("You can't verify using this method!"));
      }

      // Check if code is valid
      const verification = await verifyTextMessageCode(
        user.verifiedPhoneNumber,
        code
      );

      // Update user
      await User.updateOne(
        { _id: user.id },
        {
          $set: {
            hasVerifiedAccount: true,
            accountVerified: new Date().toISOString(),
          },
        }
      );

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
