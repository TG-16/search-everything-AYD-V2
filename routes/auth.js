const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const registerValidation = require("../middlewares/validators/registerValidator");
const loginValidation = require("../middlewares/validators/loginValidator");

router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);

module.exports = router;
