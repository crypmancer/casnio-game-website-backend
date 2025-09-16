// Require Dependencies
import express from 'express';
import {google} from 'googleapis'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import {v4} from 'uuid'
import {site, authentication} from '../../config/index.js'

import User from '../../models/User.js'

const router = express.Router()

// Additional variables
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const BACKEND_URL = IS_PRODUCTION
  ? site.backend.productionUrl
  : site.backend.developmentUrl;
const FRONTEND_URL = IS_PRODUCTION
  ? site.frontend.productionUrl
  : site.frontend.developmentUrl;
const ADMINPANEL_URL = IS_PRODUCTION
  ? site.adminFrontend.productionUrl
  : site.adminFrontend.developmentUrl;
const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  // "https://www.googleapis.com/auth/userinfo.email"
];

// Create a new OAuth2 client with the configured keys.
const oauth2Client = new google.auth.OAuth2(
  authentication.googleOauth.clientId,
  authentication.googleOauth.clientSecret,
  BACKEND_URL + "/api/auth/google/callback"
);


// This is one of the many ways you can configure googleapis to use authentication credentials.
// In this method, we're setting a global reference for all APIs.
// Any other API you use here, like google.drive('v3'), will now use this auth client.
// You can also override the auth client at the service and method call levels.
google.options({ auth: oauth2Client });

export default addTokenToState => {
  /**
   * @route   /api/auth/google
   * @desc    Redirect to authenticate using Steam OAuth
   * @access  Public
   */
  router.get("/", async (req, res, next) => {
    console.log('call back url',  BACKEND_URL + "/api/auth/google/callback")

    try {
      // grab the url that will be used for authorization
      const authorizeUrl = oauth2Client.generateAuthUrl({
        // "online" (default) or "offline" (gets refresh_token)
        access_type: "online",
        // If you only need one scope you can pass it as a string
        scope: OAUTH_SCOPES.join(" "),
        state: req.query.redirect,
      });

      return res.redirect(authorizeUrl);
    } catch (error) {
      console.log("Error while getting Google redirect url:", error);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  /**
   * @route   GET /api/auth/google/callback
   * @desc    Authenticate users using Google OAuth
   * @access  Public
   */
  router.get("/callback", async (req, res, next) => {
    const { code } = req.query;
    try {
      const response = await oauth2Client.getToken(code);

      // If no tokens were found, code was invalid
      if (!response.tokens)
        return next(new Error("Invalid callback, please try again later!"));

      // Get google profile with access token
      const profileResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${response.tokens.access_token}`
      );

      // Get profile from response
      const profile = profileResponse.data;
      const conditions = { provider: "google", providerId: profile.id };
      const dbUser = await User.findOne(conditions);

      const profilename = profile.name;

      // See if user has logged in before
      if (dbUser) {
        // Update user info
        let user_avatar = dbUser.avatarLastUpdate == 0 ? profile.picture : dbUser.avatar;

        await User.updateOne(
          conditions,
          {
            $set: {
              // username: profilename.replace(".gg", "x").replace(".GG", "x").replace("CSGO", "x").replace("csgo", "x").replace(".COM", "x").replace(".com", "x").replace(".NET", "x").replace(".net", "x").replace("porn", "x").replace("PORN", "x").replace("nigga", "x").replace("nigger", "x").replace("niger", "x").replace("niga", "x").replace(".", "").substring(0, 16), // Cut username to 16 chars
              avatar: user_avatar,
            },
          },
          {
            upsert: true,
            setDefaultsOnInsert: true,
          }
        );

        if (parseInt(dbUser.banExpires) > new Date().getTime())
          return res.redirect(`${FRONTEND_URL}/banned`);

        // Create JWT Payload
        const payload = {
          user: {
            id: dbUser.id,
          },
        };

        // Sign and return the JWT token
        jwt.sign(
          payload,
          authentication.jwtSecret,
          { expiresIn: authentication.jwtExpirationTime },
          (error, token) => {
            if (error) throw error;

            // Generate a new identifier
            const identifier = v4();

            // Add token to state
            addTokenToState(identifier, token);

            // If this was from admin panel redirect to that
            const redirectBase =
              req.query.state === "adminpanel"
                ? ADMINPANEL_URL
                : req.query.state === "adminpanel-dev"
                  ? "http://localhost:8080"
                  : FRONTEND_URL;
            const redirectUrl = `${redirectBase}/login?token=${identifier}`;

            return res.redirect(redirectUrl);
          }
        );
      } else {
        // First time logging in
        let newUser = new User({
          provider: "google",
          providerId: profile.id,

          username: profilename.replace(".gg", "x").replace(".GG", "x").replace("CSGO", "x").replace("csgo", "x").replace(".COM", "x").replace(".com", "x").replace(".NET", "x").replace(".net", "x").replace("porn", "x").replace("PORN", "x").replace("nigga", "x").replace("nigger", "x").replace("niger", "x").replace("niga", "x").replace(".", "").substring(0, 16), // Cut username to 16 chars
          avatar: profile.picture,
        });

        // Save the user
        await newUser.save();

        // Create JWT Payload
        const payload = {
          user: {
            id: newUser.id,
          },
        };

        // Sign and return the JWT token
        jwt.sign(
          payload,
          authentication.jwtSecret,
          { expiresIn: authentication.jwtExpirationTime },
          (error, token) => {
            if (error) throw error;

            // Generate a new identifier
            const identifier = v4();

            // Add token to state
            addTokenToState(identifier, token);

            // If this was from admin panel redirect to that
            const redirectBase =
              req.query.state === "adminpanel"
                ? ADMINPANEL_URL
                : req.query.state === "adminpanel-dev"
                  ? "http://localhost:8080"
                  : FRONTEND_URL;
            const redirectUrl = `${redirectBase}/login?token=${identifier}`;

            return res.redirect(redirectUrl);
          }
        );
      }
    } catch (error) {
      console.log("Error while signing-in user with Google:", error);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  // Export router
  return router;
};
