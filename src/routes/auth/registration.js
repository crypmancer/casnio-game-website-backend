// Require Dependencies
import express from 'express'
import jwt from 'jsonwebtoken'
import {v4} from 'uuid'
import md5 from 'md5'
import { authentication, site } from '../../config/index.js'

import User from '../../models/User.js'
import {verifyRecaptchaResponse} from '../../controllers/recaptcha.js'

import {
  addIPAddress,
  hasAlreadyCreatedAccount,
} from  "../../controllers/ip_addresses.js";

import nodemailer from "nodemailer";

const router = express.Router()

let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "adashufflecom@gmail.com",
    pass: "dryxllwabydtuvmk",
  },
});

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

export default addTokenToState => {
  router.post("/login", async (req, res, next) => {
    try {
      const encryptedPassword = encryptPassword(req.body.password);
      const conditions = {
        providerId: req.body.email,
        password: encryptedPassword,
      };
      const dbUser = await User.findOne(conditions);

      if (!dbUser)
        return res.json({
          success: false,
          error: `Email or password incorrect!`,
        });

      // check REcaptcha
      // let valid = await verifyRecaptchaResponse(req.body.recaptcha);
      // if (!valid)
      //   return res.json({
      //     success: false,
      //     error: `reCAPTCHA failed, try again!`,
      //     recaptcha: true,
      //   });
      //

      if (parseInt(dbUser.banExpires) > new Date().getTime())
        return res.json({ redirect: `${FRONTEND_URL}/banned` });

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

          return res.json({ redirect: redirectUrl });
        }
      );
    } catch (error) {
      console.log("Error while signing-in user:", error);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  router.post("/reset_password", async (req, res, next) => {
    try {
      // check if email is already in db
      const dbUser = await User.findOne({ providerId: req.body.email });
      if (!dbUser)
        return res.json({
          error: `We could't find any account associated with this email address!`,
        });

      // get expiress from code
      if (dbUser.forgotExpires - Date.now() < 0)
        return res.json({
          error: `This token expired, try requesting a new one!`,
          code: true,
        });
      if (dbUser.forgotToken != req.body.code)
        return res.json({ error: `This token is invalid!` });

      if (req.body.password.length < 8)
        return res.json({
          error: "The new password has to be at least 8 characters long!",
        });
      if (req.body.password.length > 30)
        return res.json({
          error: "The new password is too long! Make it shorter.",
        });

      // check REcaptcha
      let valid = await verifyRecaptchaResponse(req.body.recaptcha);
      if (!valid)
        return res.json({
          success: false,
          error: `reCAPTCHA verification failed, try again!`,
          recaptcha: true,
        });

      let new_password = encryptPassword(req.body.password);

      await User.updateOne(
        {
          providerId: req.body.email,
        },
        {
          $set: {
            password: new_password,
            forgotToken: null,
            forgotExpires: 0,
          },
        }
      );

      res.json({ success: true });
    } catch (e) {
      console.log("Internal server error - reset_password:", e);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  router.post("/forgot_password", async (req, res, next) => {
    try {
      // check if email is already in db
      const dbUser = await User.findOne({ providerId: req.body.email });
      if (!dbUser)
        return res.json({
          error: `We could't find any account associated with this email address!`,
        });

      // check REcaptcha
      let valid = await verifyRecaptchaResponse(req.body.recaptcha);
      if (!valid)
        return res.json({
          success: false,
          error: `reCAPTCHA verification failed, try again!`,
          recaptcha: true,
        });
      //

      if (dbUser.forgotExpires > Date.now())
        return res.json({
          error: `You've already requested a token, check your email!`,
        });

      let security_code = md5(Date.now() + Math.random());

      let fglink = `${FRONTEND_URL}/registration?email=${req.body.email}&code=${security_code}`;

      let info = await transporter.sendMail({
        from: '"adashuffle.com" <noreplyadashufflecom@gmail.com>',
        to: req.body.email,
        subject: "Security Token",
        html: `
          <div style="font-size: 18px;">
            <div>You requested a password reset on your adashuffle.com account.</div>
            <br/>
            <div>To complete please visit this link:</div>
            <div style="font-weight: bold;"><a href="${fglink}" target="_blank">${fglink}</a></div>
            <br/>
            <div>You can copy the <span style="font-weight: bold;">Security Token</span> manually:</div>
            <div style="font-weight: bold;">${security_code}</div>
            <br/>
            <div>If you did not request the password reset then please just ignore this email.</div>
          </div>
        `,
      });

      if (!info.messageId)
        return res.json({
          success: false,
          error: `An error ocurred while sending the email to reset the password!`,
        });

      await User.updateOne(
        { providerId: req.body.email },
        {
          $set: {
            forgotToken: security_code,
            forgotExpires: Date.now() + 600000,
          },
        }
      );

      res.json({ success: true });
    } catch (e) {
      console.log("Internal server error - forgot_password:", e);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  router.post("/register", async (req, res, next) => {
    try {
      // ip address
      let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      let is_banned = await hasAlreadyCreatedAccount(ip);

      if (is_banned)
        return res.json({
          error: `You have already created an account on this IP!`,
        });

      // check if email is already in db
      const dbUser = await User.findOne({ providerId: req.body.email });
      if (dbUser)
        return res.json({ error: `This email address is already in use!` });

      // checks
      let username = req.body.username
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      if (username.length < 3 || username.length > 16)
        return res.json({
          error: "The username has to be between 3 and 16 characters!",
        });
      if (!validateEmail(req.body.email))
        return res.json({ error: `Invalid email address!` });
      if (req.body.password.length < 8)
        return res.json({
          error: "The password has to be at least 8 characters long!",
        });
      if (req.body.password.length > 30)
        return res.json({
          error: "The password is too long! Make it shorter.",
        });

      // let valid = await verifyRecaptchaResponse(req.body.recaptcha);
      // if (!valid)
      //   return res.json({
      //     success: false,
      //     error: `reCAPTCHA failed, try again!`,
      //     recaptcha: true,
      //   });
      

      const avatars = [
        "https://i.imgur.com/GZx07Tc.png",
        "https://i.imgur.com/u43Wujr.png",
        "https://i.imgur.com/apOrNq9.png",
        "https://i.imgur.com/FCgT9XI.png",
        "https://i.imgur.com/J8sbtgK.png",
      ];

      const random_avatar = avatars.sort(() => 0.5 - Math.random())[0];

      let newUser = new User({
        provider: "user",
        providerId: req.body.email,
        username: req.body.username,
        password: encryptPassword(req.body.password),
        avatar: random_avatar,
      });

      // Save the user
      await newUser.save();

      // Insert IP registered
      await addIPAddress(ip);

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

          return res.json({ redirect: redirectUrl });
        }
      );
    } catch (error) {
      console.log("Error on register error:", error);
      return next(new Error("Internal Server Error, please try again later."));
    }
  });

  return router;
};

function encryptPassword(password) {
  return md5("BestAuthSystemv1.0InTheBuilding-" + password);
}

const validateEmail = email => {
  return email.match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );
};
