const express = require("express");
const router = express.Router();
const {
  initiateGoogleAuth,
  handleGoogleCallback,
  register,
  login,
  resetPassword,
  realResetPassword,
} = require("../controllers/auth.controller");
const registerValidation = require("../middlewares/validators/register.validator");
const loginValidation = require("../middlewares/validators/login.validator");
const {
  resetPasswordValidator,
  reseEmailValidator,
} = require("../middlewares/validators/resetPassword.validator");

router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.post("/restPassword", reseEmailValidator, resetPassword);
router.post("/realResetPassword", resetPasswordValidator, realResetPassword);

// When users click "Login with Google", your frontend points here:
router.get("/google", initiateGoogleAuth);

// This must EXACTLY match the GOOGLE_REDIRECT_URL you put in your Google Console:
router.get("/google/callback", handleGoogleCallback);

module.exports = router;
