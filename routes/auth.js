const express = require("express");
const router = express.Router();
const {
  register,
  login,
  resetPassword,
  realResetPassword,
} = require("../controllers/authController");
const registerValidation = require("../middlewares/validators/registerValidator");
const loginValidation = require("../middlewares/validators/loginValidator");
const {
  resetPasswordValidator,
  reseEmailValidator,
} = require("../middlewares/validators/resetPasswordValidator");

router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.post("/restPassword", reseEmailValidator, resetPassword);
router.post("/realResetPassword", resetPasswordValidator, realResetPassword)

module.exports = router;
