// Import Dependencies
import express from "express";
import SteamAuth from "node-steam-openid";
import jwt from "jsonwebtoken";
import {v4} from "uuid";
import {site, authentication} from "../../config/index.js";
import User from "../../models/User.js";

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

// Setup Steam oAuth client
const steam = new SteamAuth({
  realm: BACKEND_URL, // Site name displayed to users on logon
  returnUrl: `${BACKEND_URL}/api/auth/steam/callback`, // Your return route
  apiKey: authentication.steam.apiKey, // Steam API key
});

export default addTokenToState => {
  /**
   * @route   /api/auth/steam
   * @desc    Redirect to authenticate using Steam OpenID
   * @access  Public
   */
  const router = express.Router();
  router.get("/", async (req, res, next) => {
    try {
      const URL = await steam.getRedirectUrl();
      const redirectUrl = URL;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.log("Error while getting Steam redirect url:", error);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  /**
   * @route   GET /api/auth/steam/callback/
   * @desc    Authenticate users using Steam OpenID
   * @access  Public
   */
  router.get("/callback", async (req, res, next) => {
    try {
      const user = await steam.authenticate(req);
      const conditions = { provider: "steam", providerId: user.steamid };
      const dbUser = await User.findOne(conditions);

      const profilename = user.username;

      // See if user has logged in before
      if (dbUser) {
        // Update user info
        let user_avatar =
          dbUser.avatarLastUpdate == 0 ? user.avatar.large : dbUser.avatar;

        await User.updateOne(
          conditions,
          {
            $set: {
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
              req.query.state === "adminpanel" ? ADMINPANEL_URL : FRONTEND_URL;
            const redirectUrl = `${redirectBase}/login?token=${identifier}`;

            return res.redirect(redirectUrl);
          }
        );
      } else {
        // First time logging in
        let newUser = new User({
          provider: "steam",
          providerId: user.steamid,
          username: profilename
            .replace(/\.gg|\.GG|CSGO|csgo|\.COM|\.com|\.NET|\.net|porn|PORN|nigga|nigger|niger|niga|\./gi, "x")
            .substring(0, 16),
          avatar: user.avatar.large,
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
              req.query.state === "adminpanel" ? ADMINPANEL_URL : FRONTEND_URL;
            const redirectUrl = `${redirectBase}/login?token=${identifier}`;

            return res.redirect(redirectUrl);
          }
        );
      }
    } catch (error) {
      console.log("Error while signing-in user with Steam:", error);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  // Export router
  return router;
};
