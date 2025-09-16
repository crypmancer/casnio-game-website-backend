// Import Dependencies
import jwt from "jsonwebtoken";
import { authentication } from "../config/index.js";
import User from "../models/User.js";

// Middleware to validate JWT
const validateJWT = async (req, res, next) => {
  // Get token from header
  const token = req.header("x-auth-token");

  // Check if no token
  if (!token) {
    res.status(401);
    return next(
      new Error("No authentication token provided, authorization declined")
    );
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, authentication.jwtSecret);
    const dbUser = await User.findOne({ _id: decoded.user.id });

    if (dbUser && parseInt(dbUser.banExpires) > new Date().getTime()) {
      // console.log("banned");
      return res.status(401).json({
        msg: "You are banned!",
        expires: parseInt(dbUser.banExpires),
      });
    }

    req.authToken = token;
    req.user = decoded.user;
    return next();
  } catch (error) {
    res.status(401);
    return next(new Error("Authentication token is not valid"));
  }
};

// Middleware to allow admins only
const allowAdminsOnly = async (req, res, next) => {
  // If user is not authenticated
  if (!req.user) {
    res.status(401);
    return next(new Error("Authentication is needed!"));
  }

  try {
    // Get user from db
    const user = await User.findOne({ _id: req.user.id });

    // If user is admin / mod / dev
    if (user.rank >= 5) {
      return next();
    } else {
      res.status(401);
      return next(
        new Error("You don't have permissions to access this endpoint!")
      );
    }
  } catch (error) {
    res.status(401);
    return next(
      new Error(
        "Couldn't look up your account on the DB. Please contact administrators"
      )
    );
  }
};

// Export middlewares
export { validateJWT, allowAdminsOnly };
